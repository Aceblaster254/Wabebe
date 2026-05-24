-- =====================================================================
-- WABEBE — ROW-LEVEL SECURITY POLICIES (v1.0)
-- =====================================================================
-- Run this AFTER 01-schema.sql.
--
-- Supabase principle: every table that contains user data has RLS enabled.
-- The "anon" role (unauthenticated) is highly restricted.
-- The "authenticated" role (logged-in users) sees only their own data.
-- Service role (server-side) bypasses RLS — use it sparingly.
--
-- We use a helper function to read the requester's role from the users table.
-- =====================================================================

-- =====================================================================
-- HELPER: get the current user's role (from public.users)
-- =====================================================================
create or replace function public.current_user_role()
returns text language sql stable security definer as $$
  select coalesce(
    (select role from public.users where id = auth.uid()),
    'anon'
  );
$$;

create or replace function public.current_user_is_staff()
returns boolean language sql stable security definer as $$
  select coalesce(
    (select role in ('conductor','driver','dispatcher','admin','super_admin')
     from public.users where id = auth.uid()),
    false
  );
$$;


-- =====================================================================
-- USERS
-- =====================================================================
alter table public.users enable row level security;

-- Anyone can read basic info about themselves
drop policy if exists users_self_read on public.users;
create policy users_self_read on public.users
  for select using (auth.uid() = id);

-- Staff can read all users (for support / dispatch)
drop policy if exists users_staff_read on public.users;
create policy users_staff_read on public.users
  for select using (public.current_user_is_staff());

-- Users can update their own name and language
drop policy if exists users_self_update on public.users;
create policy users_self_update on public.users
  for update using (auth.uid() = id)
  with check (auth.uid() = id and role = (select role from public.users where id = auth.uid()));
-- The role-protection in WITH CHECK prevents a user from escalating their own role.

-- Admins can update any user
drop policy if exists users_admin_update on public.users;
create policy users_admin_update on public.users
  for update using (public.current_user_role() in ('admin','super_admin'));


-- =====================================================================
-- STOPS — public read, staff write
-- =====================================================================
alter table public.stops enable row level security;

drop policy if exists stops_public_read on public.stops;
create policy stops_public_read on public.stops
  for select using (true);

drop policy if exists stops_staff_write on public.stops;
create policy stops_staff_write on public.stops
  for all using (public.current_user_role() in ('dispatcher','admin','super_admin'));


-- =====================================================================
-- ROUTES — public read, staff write
-- =====================================================================
alter table public.routes enable row level security;

drop policy if exists routes_public_read on public.routes;
create policy routes_public_read on public.routes
  for select using (true);

drop policy if exists routes_staff_write on public.routes;
create policy routes_staff_write on public.routes
  for all using (public.current_user_role() in ('dispatcher','admin','super_admin'));


-- =====================================================================
-- ROUTE_STOPS — public read, staff write
-- =====================================================================
alter table public.route_stops enable row level security;

drop policy if exists route_stops_public_read on public.route_stops;
create policy route_stops_public_read on public.route_stops
  for select using (true);

drop policy if exists route_stops_staff_write on public.route_stops;
create policy route_stops_staff_write on public.route_stops
  for all using (public.current_user_role() in ('dispatcher','admin','super_admin'));


-- =====================================================================
-- BUS_LAYOUTS — public read, admin write
-- =====================================================================
alter table public.bus_layouts enable row level security;

drop policy if exists bus_layouts_public_read on public.bus_layouts;
create policy bus_layouts_public_read on public.bus_layouts
  for select using (true);

drop policy if exists bus_layouts_admin_write on public.bus_layouts;
create policy bus_layouts_admin_write on public.bus_layouts
  for all using (public.current_user_role() in ('admin','super_admin'));


-- =====================================================================
-- BUSES — public read, staff write
-- Fleet numbers are intentionally public — that's the whole point.
-- =====================================================================
alter table public.buses enable row level security;

drop policy if exists buses_public_read on public.buses;
create policy buses_public_read on public.buses
  for select using (true);

drop policy if exists buses_staff_write on public.buses;
create policy buses_staff_write on public.buses
  for all using (public.current_user_role() in ('dispatcher','admin','super_admin'));


-- =====================================================================
-- TRIPS — public read, staff write
-- =====================================================================
alter table public.trips enable row level security;

drop policy if exists trips_public_read on public.trips;
create policy trips_public_read on public.trips
  for select using (true);

drop policy if exists trips_staff_write on public.trips;
create policy trips_staff_write on public.trips
  for all using (public.current_user_role() in ('dispatcher','admin','super_admin'));

-- Drivers and conductors can update trips they're assigned to (status, actual times)
drop policy if exists trips_assigned_update on public.trips;
create policy trips_assigned_update on public.trips
  for update using (
    auth.uid() = driver_id or auth.uid() = conductor_id
  );


-- =====================================================================
-- SEAT_HOLDS — read public (so the seat map can show them as taken)
-- but only the holder or service role can write
-- =====================================================================
alter table public.seat_holds enable row level security;

-- Anyone can SEE that a seat is held (used by the live seat map)
drop policy if exists seat_holds_public_read on public.seat_holds;
create policy seat_holds_public_read on public.seat_holds
  for select using (true);

-- Authenticated users can place a hold for themselves
drop policy if exists seat_holds_insert on public.seat_holds;
create policy seat_holds_insert on public.seat_holds
  for insert with check (auth.uid() = user_id);

-- Users can delete their own hold (cancelling selection)
drop policy if exists seat_holds_self_delete on public.seat_holds;
create policy seat_holds_self_delete on public.seat_holds
  for delete using (auth.uid() = user_id);


-- =====================================================================
-- BOOKINGS — users see their own; staff see all
-- =====================================================================
alter table public.bookings enable row level security;

-- Passengers see only their own bookings
drop policy if exists bookings_self_read on public.bookings;
create policy bookings_self_read on public.bookings
  for select using (auth.uid() = user_id);

-- Staff see all bookings (for support, conductor scanning, etc.)
drop policy if exists bookings_staff_read on public.bookings;
create policy bookings_staff_read on public.bookings
  for select using (public.current_user_is_staff());

-- Users can create bookings for themselves
drop policy if exists bookings_self_insert on public.bookings;
create policy bookings_self_insert on public.bookings
  for insert with check (auth.uid() = user_id);

-- Users can cancel their own bookings (status change handled by a function)
drop policy if exists bookings_self_update on public.bookings;
create policy bookings_self_update on public.bookings
  for update using (auth.uid() = user_id);

-- Staff can update any booking (e.g. conductor marks as boarded/no-show)
drop policy if exists bookings_staff_update on public.bookings;
create policy bookings_staff_update on public.bookings
  for update using (public.current_user_is_staff());


-- =====================================================================
-- STRIKES — users see their own; staff see all
-- =====================================================================
alter table public.strikes enable row level security;

drop policy if exists strikes_self_read on public.strikes;
create policy strikes_self_read on public.strikes
  for select using (auth.uid() = user_id);

drop policy if exists strikes_staff_all on public.strikes;
create policy strikes_staff_all on public.strikes
  for all using (public.current_user_is_staff());


-- =====================================================================
-- GPS_PINGS — public read (so passengers can track), staff write
-- =====================================================================
alter table public.gps_pings enable row level security;

drop policy if exists gps_pings_public_read on public.gps_pings;
create policy gps_pings_public_read on public.gps_pings
  for select using (true);

drop policy if exists gps_pings_driver_insert on public.gps_pings;
create policy gps_pings_driver_insert on public.gps_pings
  for insert with check (
    public.current_user_role() in ('driver','conductor','dispatcher','admin','super_admin')
  );


-- =====================================================================
-- AUDIT_LOG — read by admin/super_admin only; service-role inserts
-- =====================================================================
alter table public.audit_log enable row level security;

drop policy if exists audit_log_admin_read on public.audit_log;
create policy audit_log_admin_read on public.audit_log
  for select using (public.current_user_role() in ('admin','super_admin'));


-- =====================================================================
-- DASHBOARD_STATS — public read, service-role write
-- =====================================================================
alter table public.dashboard_stats enable row level security;

drop policy if exists dashboard_stats_public_read on public.dashboard_stats;
create policy dashboard_stats_public_read on public.dashboard_stats
  for select using (true);


-- =====================================================================
-- DONE
-- =====================================================================
