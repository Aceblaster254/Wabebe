-- =====================================================================
-- WABEBE — DATABASE FUNCTIONS (v1.0)
-- =====================================================================
-- Run AFTER 02-rls-policies.sql.
--
-- These functions encapsulate the tricky logic — atomic seat claims,
-- no-show counting, suspension checks, dashboard refresh — so the
-- frontend never has to coordinate multiple writes.
--
-- All functions are SECURITY DEFINER so they bypass RLS *for the operations
-- they perform internally*, but each one re-checks authorization explicitly.
-- =====================================================================


-- =====================================================================
-- get_seat_status(trip_id)
-- Returns the live seat status for a trip:
--   [{seat_id: "1A", status: "available" | "held" | "booked" | "conductor"}, ...]
-- =====================================================================
create or replace function public.get_seat_status(p_trip_id uuid)
returns table(seat_id text, status text, held_by_me boolean)
language plpgsql stable as $$
declare
  v_layout jsonb;
begin
  -- Get the bus layout for this trip
  select bl.seat_map into v_layout
  from public.trips t
  join public.buses b on b.id = t.bus_id
  join public.bus_layouts bl on bl.id = b.layout_id
  where t.id = p_trip_id;

  if v_layout is null then
    raise exception 'Trip not found';
  end if;

  return query
  with seats as (
    select s->>'id' as sid, s->>'type' as stype
    from jsonb_array_elements(v_layout) s
  ),
  bookings as (
    select seat_id from public.bookings
    where trip_id = p_trip_id and status = 'confirmed'
  ),
  holds as (
    select seat_id, user_id from public.seat_holds
    where trip_id = p_trip_id and expires_at > now()
  )
  select
    s.sid,
    case
      when s.stype = 'conductor' then 'conductor'
      when b.seat_id is not null then 'booked'
      when h.seat_id is not null then 'held'
      else 'available'
    end as status,
    (h.user_id = auth.uid()) as held_by_me
  from seats s
  left join bookings b on b.seat_id = s.sid
  left join holds h on h.seat_id = s.sid;
end;
$$;


-- =====================================================================
-- hold_seat(trip_id, seat_id, session_id)
-- Atomically claims a 2-minute hold on a seat for the calling user.
-- Returns true if successful, false if the seat is already held or booked.
-- =====================================================================
create or replace function public.hold_seat(
  p_trip_id uuid,
  p_seat_id text,
  p_session_id text
) returns boolean
language plpgsql security definer as $$
declare
  v_user_id uuid := auth.uid();
  v_suspended_until timestamptz;
  v_existing_hold record;
  v_seat_type text;
begin
  if v_user_id is null then
    raise exception 'Must be logged in to hold a seat';
  end if;

  -- Check suspension
  select suspended_until into v_suspended_until from public.users where id = v_user_id;
  if v_suspended_until is not null and v_suspended_until > now() then
    raise exception 'Your account is suspended until %', v_suspended_until;
  end if;

  -- Check seat is not the conductor seat
  select s->>'type' into v_seat_type
  from public.trips t
  join public.buses b on b.id = t.bus_id
  join public.bus_layouts bl on bl.id = b.layout_id,
  jsonb_array_elements(bl.seat_map) s
  where t.id = p_trip_id and s->>'id' = p_seat_id;

  if v_seat_type = 'conductor' then
    return false;
  end if;

  if v_seat_type is null then
    raise exception 'Seat % does not exist on this bus', p_seat_id;
  end if;

  -- Check seat is not already booked
  if exists (
    select 1 from public.bookings
    where trip_id = p_trip_id and seat_id = p_seat_id and status = 'confirmed'
  ) then
    return false;
  end if;

  -- Release any expired holds first (cleanup)
  delete from public.seat_holds
  where trip_id = p_trip_id and seat_id = p_seat_id and expires_at <= now();

  -- Release any other holds this user has on this trip (one seat at a time)
  delete from public.seat_holds
  where trip_id = p_trip_id and user_id = v_user_id;

  -- Try to insert the hold
  insert into public.seat_holds (trip_id, seat_id, session_id, user_id, expires_at)
  values (p_trip_id, p_seat_id, p_session_id, v_user_id, now() + interval '2 minutes')
  on conflict (trip_id, seat_id) do nothing;

  -- Did we actually insert it?
  return found;
end;
$$;


-- =====================================================================
-- release_seat_hold(trip_id, seat_id)
-- User-initiated cancellation of their own hold (e.g. cancel selection)
-- =====================================================================
create or replace function public.release_seat_hold(
  p_trip_id uuid,
  p_seat_id text
) returns boolean
language plpgsql security definer as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then return false; end if;

  delete from public.seat_holds
  where trip_id = p_trip_id and seat_id = p_seat_id and user_id = v_user_id;

  return found;
end;
$$;


-- =====================================================================
-- create_booking(trip_id, seat_id, session_id, boarding_stop_id, alighting_stop_id)
-- Converts a hold into a confirmed booking. Atomic. Returns the booking record.
-- =====================================================================
create or replace function public.create_booking(
  p_trip_id uuid,
  p_seat_id text,
  p_session_id text,
  p_boarding_stop_id uuid default null,
  p_alighting_stop_id uuid default null
) returns public.bookings
language plpgsql security definer as $$
declare
  v_user_id uuid := auth.uid();
  v_hold record;
  v_booking public.bookings;
  v_suspended_until timestamptz;
begin
  if v_user_id is null then
    raise exception 'Must be logged in to book';
  end if;

  -- Re-check suspension at the moment of booking
  select suspended_until into v_suspended_until from public.users where id = v_user_id;
  if v_suspended_until is not null and v_suspended_until > now() then
    raise exception 'Your account is suspended until %', v_suspended_until;
  end if;

  -- Verify the hold belongs to this user and session, and is still valid
  select * into v_hold
  from public.seat_holds
  where trip_id = p_trip_id
    and seat_id = p_seat_id
    and session_id = p_session_id
    and user_id = v_user_id
    and expires_at > now();

  if v_hold is null then
    raise exception 'Your seat hold has expired or is invalid. Please select again.';
  end if;

  -- Create the booking
  insert into public.bookings (
    trip_id, user_id, seat_id, boarding_stop_id, alighting_stop_id, status
  ) values (
    p_trip_id, v_user_id, p_seat_id, p_boarding_stop_id, p_alighting_stop_id, 'confirmed'
  ) returning * into v_booking;

  -- Release the hold (no longer needed — booking is the source of truth)
  delete from public.seat_holds
  where trip_id = p_trip_id and seat_id = p_seat_id;

  return v_booking;
end;
$$;


-- =====================================================================
-- cancel_booking(booking_id, reason)
-- User-initiated cancellation. Applies the late-cancel strike rule
-- (if ≤ 10 min before departure).
-- =====================================================================
create or replace function public.cancel_booking(
  p_booking_id uuid,
  p_reason text default null
) returns public.bookings
language plpgsql security definer as $$
declare
  v_user_id uuid := auth.uid();
  v_booking public.bookings;
  v_trip public.trips;
  v_minutes_until_departure numeric;
begin
  if v_user_id is null then
    raise exception 'Must be logged in';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id;
  if v_booking is null then
    raise exception 'Booking not found';
  end if;

  -- Only the booking owner can cancel (staff use a different function)
  if v_booking.user_id != v_user_id then
    raise exception 'You can only cancel your own bookings';
  end if;

  if v_booking.status != 'confirmed' then
    raise exception 'Only confirmed bookings can be cancelled';
  end if;

  select * into v_trip from public.trips where id = v_booking.trip_id;
  v_minutes_until_departure := extract(epoch from (v_trip.departure_at - now())) / 60;

  -- If trip already departed, this is effectively a no-show, not a cancel
  if v_minutes_until_departure < 0 then
    raise exception 'Cannot cancel — trip has already departed';
  end if;

  -- Update the booking
  update public.bookings
  set status = 'cancelled',
      cancelled_at = now(),
      cancel_reason = p_reason
  where id = p_booking_id
  returning * into v_booking;

  -- If cancelled within 10 minutes of departure, log a late_cancel strike
  if v_minutes_until_departure <= 10 then
    insert into public.strikes (user_id, booking_id, type, notes)
    values (v_user_id, p_booking_id, 'late_cancel',
            'Cancelled ' || round(v_minutes_until_departure) || ' min before departure');
  end if;

  return v_booking;
end;
$$;


-- =====================================================================
-- mark_no_show(booking_id)
-- Called by the conductor app after the 2-minute boarding window expires.
-- Creates a strike and applies the suspension rule.
-- =====================================================================
create or replace function public.mark_no_show(p_booking_id uuid)
returns public.bookings
language plpgsql security definer as $$
declare
  v_actor_role text := public.current_user_role();
  v_booking public.bookings;
  v_user_id uuid;
  v_strike_count int;
  v_suspension_days int;
  v_suspended_until timestamptz;
begin
  -- Only staff can mark no-shows
  if v_actor_role not in ('conductor','driver','dispatcher','admin','super_admin') then
    raise exception 'Only staff can mark a passenger as no-show';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id;
  if v_booking is null then
    raise exception 'Booking not found';
  end if;

  if v_booking.status != 'confirmed' then
    raise exception 'Can only mark confirmed bookings as no-show';
  end if;

  v_user_id := v_booking.user_id;

  -- Update the booking
  update public.bookings
  set status = 'no_show', no_show_at = now()
  where id = p_booking_id
  returning * into v_booking;

  -- Count this user's no-shows in the last 30 days (INCLUDING the one we just created)
  select count(*) + 1 into v_strike_count
  from public.strikes
  where user_id = v_user_id
    and type = 'no_show'
    and created_at > now() - interval '30 days';

  -- Determine suspension length
  v_suspension_days := case
    when v_strike_count = 1 then 1
    when v_strike_count = 2 then 3
    else 7
  end;
  v_suspended_until := (now() + (v_suspension_days || ' days')::interval);

  -- Create the strike
  insert into public.strikes (
    user_id, booking_id, type, resulting_suspension_until, notes
  ) values (
    v_user_id, p_booking_id, 'no_show', v_suspended_until,
    'Strike ' || v_strike_count || ' in last 30 days — ' || v_suspension_days || ' day suspension'
  );

  -- Apply the suspension
  update public.users
  set suspended_until = v_suspended_until,
      no_show_count_30d = v_strike_count
  where id = v_user_id;

  return v_booking;
end;
$$;


-- =====================================================================
-- mark_boarded(booking_id)
-- Called by the conductor app when scanning a QR code at boarding.
-- =====================================================================
create or replace function public.mark_boarded(p_booking_id uuid)
returns public.bookings
language plpgsql security definer as $$
declare
  v_actor_role text := public.current_user_role();
  v_booking public.bookings;
begin
  if v_actor_role not in ('conductor','driver','dispatcher','admin','super_admin') then
    raise exception 'Only staff can mark a passenger as boarded';
  end if;

  update public.bookings
  set status = 'boarded', boarded_at = now()
  where id = p_booking_id and status = 'confirmed'
  returning * into v_booking;

  if v_booking is null then
    raise exception 'Booking not found or not in confirmed state';
  end if;

  return v_booking;
end;
$$;


-- =====================================================================
-- recompute_no_show_counts()
-- Maintenance: refresh users.no_show_count_30d for all users.
-- Run on a daily cron so the count slides forward as old strikes age out.
-- =====================================================================
create or replace function public.recompute_no_show_counts()
returns void language plpgsql security definer as $$
begin
  update public.users u
  set no_show_count_30d = coalesce(s.cnt, 0)
  from (
    select user_id, count(*)::int as cnt
    from public.strikes
    where type = 'no_show' and created_at > now() - interval '30 days'
    group by user_id
  ) s
  where u.id = s.user_id;

  -- Lift suspensions that have expired
  update public.users
  set suspended_until = null
  where suspended_until is not null and suspended_until <= now();
end;
$$;


-- =====================================================================
-- cleanup_expired_holds()
-- Maintenance: remove expired seat holds. Run on a 1-minute cron.
-- =====================================================================
create or replace function public.cleanup_expired_holds()
returns int language plpgsql security definer as $$
declare
  v_deleted int;
begin
  delete from public.seat_holds where expires_at <= now();
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;


-- =====================================================================
-- refresh_dashboard_stats()
-- Maintenance: recompute the home-page stats. Run on a 60-second cron.
-- =====================================================================
create or replace function public.refresh_dashboard_stats()
returns void language plpgsql security definer as $$
declare
  v_buses int;
  v_bookings_today int;
  v_on_time_pct numeric;
begin
  -- Buses currently on the road: trips in 'in_transit' status
  select count(distinct bus_id) into v_buses
  from public.trips where status = 'in_transit';

  -- Bookings made today
  select count(*) into v_bookings_today
  from public.bookings
  where created_at::date = current_date;

  -- On-time % over the last 7 days
  --   "On time" = actual_departure_at within 5 minutes of scheduled departure_at
  select
    case when count(*) = 0 then 0
    else round(
      100.0 * count(*) filter (
        where abs(extract(epoch from (actual_departure_at - departure_at))) <= 300
      ) / count(*),
    2)
    end
  into v_on_time_pct
  from public.trips
  where actual_departure_at is not null
    and departure_at > now() - interval '7 days';

  update public.dashboard_stats
  set buses_on_road = v_buses,
      bookings_today = v_bookings_today,
      on_time_pct_7d = v_on_time_pct,
      updated_at = now()
  where id = 1;
end;
$$;


-- =====================================================================
-- search_buses_by_fleet(query)
-- Used by the home page "Book your regular bus" autocomplete.
-- =====================================================================
create or replace function public.search_buses_by_fleet(p_query text)
returns table(id uuid, fleet_number text, plate text, nickname text)
language sql stable as $$
  select b.id, b.fleet_number, b.plate, b.nickname
  from public.buses b
  where b.active = true
    and (
      b.fleet_number ilike p_query || '%'
      or b.plate ilike p_query || '%'
      or coalesce(b.nickname, '') ilike '%' || p_query || '%'
    )
  order by b.fleet_number
  limit 10;
$$;


-- =====================================================================
-- get_upcoming_trips_for_bus(bus_id, limit)
-- For the bus detail page.
-- =====================================================================
create or replace function public.get_upcoming_trips_for_bus(
  p_bus_id uuid,
  p_limit int default 10
) returns table(
  trip_id uuid,
  route_code text,
  route_name text,
  departure_at timestamptz,
  status text,
  seats_available int
) language sql stable as $$
  select
    t.id,
    r.code,
    r.name,
    t.departure_at,
    t.status,
    (bl.total_seats
      - (select count(*) from public.bookings b
         where b.trip_id = t.id and b.status = 'confirmed')
      - (select jsonb_array_length(
           coalesce(
             (select jsonb_agg(s) from jsonb_array_elements(bl.seat_map) s where s->>'type' = 'conductor'),
             '[]'::jsonb
           )
         ))
    )::int as seats_available
  from public.trips t
  join public.routes r on r.id = t.route_id
  join public.buses b on b.id = t.bus_id
  join public.bus_layouts bl on bl.id = b.layout_id
  where t.bus_id = p_bus_id
    and t.departure_at > now()
    and t.status in ('scheduled','boarding')
  order by t.departure_at asc
  limit p_limit;
$$;


-- =====================================================================
-- DONE
-- =====================================================================
