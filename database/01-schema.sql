-- =====================================================================
-- WABEBE — DATABASE SCHEMA (v1.0)
-- =====================================================================
-- Run this in Supabase SQL Editor as the FIRST migration.
-- This file is idempotent: safe to re-run (uses CREATE TABLE IF NOT EXISTS).
--
-- Design principles for v1.0:
--   - No money. No payments, no fares, no loyalty.
--   - Booking only. Seats, holds, no-shows, cancellations.
--   - Fleet numbers are first-class — users book by route OR by specific bus.
--   - Every change is auditable.
-- =====================================================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";


-- =====================================================================
-- USERS — passengers (admin/conductor/driver are also rows here, by role)
-- =====================================================================
create table if not exists public.users (
  id uuid primary key default uuid_generate_v4(),
  phone text unique not null,                -- "+254712345678" — E.164 format
  full_name text,
  role text not null default 'passenger'     -- passenger | conductor | driver | dispatcher | admin | super_admin
    check (role in ('passenger','conductor','driver','dispatcher','admin','super_admin')),
  no_show_count_30d int not null default 0,  -- denormalised: rolling 30-day count, recomputed by function
  suspended_until timestamptz,               -- null if not suspended; future timestamp if barred
  language text not null default 'en'        -- en | sw
    check (language in ('en','sw')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);
create index if not exists users_phone_idx on public.users(phone);
create index if not exists users_role_idx on public.users(role);
create index if not exists users_suspended_idx on public.users(suspended_until) where suspended_until is not null;


-- =====================================================================
-- STOPS — physical boarding/alighting points
-- =====================================================================
create table if not exists public.stops (
  id uuid primary key default uuid_generate_v4(),
  name text not null,                        -- "CBD — Kencom"
  short_name text,                           -- "Kencom"
  area text,                                 -- "Nairobi CBD" — for grouping
  lat double precision not null,
  lng double precision not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists stops_area_idx on public.stops(area);
create index if not exists stops_active_idx on public.stops(active);


-- =====================================================================
-- ROUTES — a named path with two endpoints
-- =====================================================================
create table if not exists public.routes (
  id uuid primary key default uuid_generate_v4(),
  code text unique not null,                 -- "33", "105", "11B" — the matatu route number
  name text not null,                        -- "CBD → Rongai"
  origin_stop_id uuid not null references public.stops(id) on delete restrict,
  destination_stop_id uuid not null references public.stops(id) on delete restrict,
  description text,
  frequency_label text,                      -- "Every 15 min" — display string
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists routes_code_idx on public.routes(code);
create index if not exists routes_active_idx on public.routes(active);


-- =====================================================================
-- ROUTE STOPS — ordered stops on a route
-- =====================================================================
create table if not exists public.route_stops (
  route_id uuid not null references public.routes(id) on delete cascade,
  stop_id uuid not null references public.stops(id) on delete restrict,
  sequence int not null,                     -- 1, 2, 3... in travel order
  primary key (route_id, stop_id),
  unique (route_id, sequence)
);
create index if not exists route_stops_route_idx on public.route_stops(route_id, sequence);


-- =====================================================================
-- BUS LAYOUTS — defines a seat map (reusable across many buses)
-- =====================================================================
-- seat_map is a JSON array of seat objects:
--   [{ "id": "1A", "row": 1, "col": "A", "type": "cockpit" },
--    { "id": "3B", "row": 3, "col": "B", "type": "conductor" },
--    { "id": "5C", "row": 5, "col": "C", "type": "regular" }, ...]
-- "type" is one of: cockpit | regular | conductor | back_row
-- =====================================================================
create table if not exists public.bus_layouts (
  id uuid primary key default uuid_generate_v4(),
  name text not null,                        -- "Standard 33-seater"
  total_seats int not null,
  seat_map jsonb not null,
  created_at timestamptz not null default now()
);


-- =====================================================================
-- BUSES — the physical vehicles in the fleet
-- =====================================================================
create table if not exists public.buses (
  id uuid primary key default uuid_generate_v4(),
  fleet_number text unique not null,         -- "KCB 245" — what passengers see
  plate text unique not null,                -- "KCB 245X" — official registration
  layout_id uuid not null references public.bus_layouts(id) on delete restrict,
  nickname text,                             -- "Mbao", "Citizen" — many Kenyan buses have one
  active boolean not null default true,
  notes text,                                -- maintenance notes, etc.
  created_at timestamptz not null default now()
);
create index if not exists buses_fleet_number_idx on public.buses(fleet_number);
create index if not exists buses_active_idx on public.buses(active);


-- =====================================================================
-- TRIPS — a specific bus on a specific route at a specific time
-- =====================================================================
create table if not exists public.trips (
  id uuid primary key default uuid_generate_v4(),
  route_id uuid not null references public.routes(id) on delete restrict,
  bus_id uuid not null references public.buses(id) on delete restrict,
  driver_id uuid references public.users(id) on delete set null,
  conductor_id uuid references public.users(id) on delete set null,
  departure_at timestamptz not null,
  estimated_arrival_at timestamptz,
  status text not null default 'scheduled'
    check (status in ('scheduled','boarding','in_transit','completed','cancelled')),
  cancel_reason text,
  actual_departure_at timestamptz,
  actual_completion_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists trips_route_departure_idx on public.trips(route_id, departure_at);
create index if not exists trips_bus_departure_idx on public.trips(bus_id, departure_at);
create index if not exists trips_status_idx on public.trips(status);
create index if not exists trips_departure_idx on public.trips(departure_at);


-- =====================================================================
-- SEAT HOLDS — temporary 2-minute locks while user is choosing/confirming
-- =====================================================================
-- Concurrency: insert with ON CONFLICT DO NOTHING.
-- If the row exists and expires_at > now(), the seat is held by someone else.
-- An expired hold is automatically ignored — released by the get_seat_status
-- function and cleaned by a cron job.
-- =====================================================================
create table if not exists public.seat_holds (
  trip_id uuid not null references public.trips(id) on delete cascade,
  seat_id text not null,                     -- "5C", matches bus_layouts.seat_map[].id
  session_id text not null,                  -- client-generated UUID; only this session can confirm
  user_id uuid references public.users(id) on delete set null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (trip_id, seat_id)
);
create index if not exists seat_holds_expires_idx on public.seat_holds(expires_at);


-- =====================================================================
-- BOOKINGS — a confirmed seat reservation on a trip
-- =====================================================================
create table if not exists public.bookings (
  id uuid primary key default uuid_generate_v4(),
  reference text unique not null default upper(substr(replace(uuid_generate_v4()::text,'-',''),1,8)),
  trip_id uuid not null references public.trips(id) on delete restrict,
  user_id uuid not null references public.users(id) on delete restrict,
  seat_id text not null,                     -- "5C"
  status text not null default 'confirmed'
    check (status in ('confirmed','cancelled','boarded','no_show')),
  boarding_stop_id uuid references public.stops(id) on delete set null,
  alighting_stop_id uuid references public.stops(id) on delete set null,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancel_reason text,
  boarded_at timestamptz,
  no_show_at timestamptz,
  -- Prevent double-booking of the same seat on the same trip
  unique (trip_id, seat_id)
);
create index if not exists bookings_user_idx on public.bookings(user_id, created_at desc);
create index if not exists bookings_trip_idx on public.bookings(trip_id);
create index if not exists bookings_status_idx on public.bookings(status);
create index if not exists bookings_reference_idx on public.bookings(reference);


-- =====================================================================
-- STRIKES — record of no-shows and late cancellations
-- =====================================================================
-- Used to compute users.no_show_count_30d and determine suspension length.
-- =====================================================================
create table if not exists public.strikes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  type text not null
    check (type in ('no_show','late_cancel')),
  resulting_suspension_until timestamptz,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists strikes_user_recent_idx on public.strikes(user_id, created_at desc);
create index if not exists strikes_type_idx on public.strikes(type);


-- =====================================================================
-- GPS PINGS — live location broadcasts from driver/conductor phones
-- =====================================================================
-- High-volume table; auto-prune older than 24h with a cron.
-- =====================================================================
create table if not exists public.gps_pings (
  id bigserial primary key,
  trip_id uuid not null references public.trips(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  speed_kph double precision,
  heading double precision,
  recorded_at timestamptz not null default now()
);
create index if not exists gps_pings_trip_recent_idx on public.gps_pings(trip_id, recorded_at desc);


-- =====================================================================
-- AUDIT LOG — every admin action, every override
-- =====================================================================
create table if not exists public.audit_log (
  id bigserial primary key,
  actor_id uuid references public.users(id) on delete set null,
  actor_role text,                           -- snapshot of role at time of action
  action text not null,                      -- "booking.override_cancel", "trip.cancel", etc.
  target_type text,                          -- "booking", "trip", "user"
  target_id text,                            -- UUID or other identifier as text
  before_state jsonb,
  after_state jsonb,
  notes text,
  at timestamptz not null default now()
);
create index if not exists audit_log_actor_idx on public.audit_log(actor_id, at desc);
create index if not exists audit_log_target_idx on public.audit_log(target_type, target_id);
create index if not exists audit_log_at_idx on public.audit_log(at desc);


-- =====================================================================
-- DASHBOARD STATS — materialised metrics for the home page status strip
-- =====================================================================
-- Refreshed by a scheduled function every 60 seconds.
-- =====================================================================
create table if not exists public.dashboard_stats (
  id int primary key default 1 check (id = 1),  -- single-row table
  buses_on_road int not null default 0,
  bookings_today int not null default 0,
  on_time_pct_7d numeric(5,2) not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.dashboard_stats (id) values (1) on conflict do nothing;


-- =====================================================================
-- UPDATED_AT TRIGGER — keep trips.updated_at fresh automatically
-- =====================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trips_updated_at on public.trips;
create trigger trips_updated_at
  before update on public.trips
  for each row execute function public.set_updated_at();


-- =====================================================================
-- DONE
-- =====================================================================
-- Next: run 02-rls-policies.sql, then 03-functions.sql, then 04-seed-data.sql
-- =====================================================================
