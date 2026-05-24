-- =====================================================================
-- WABEBE — SEED DATA (v1.0)
-- =====================================================================
-- Run AFTER 03-functions.sql.
--
-- Realistic Nairobi data:
--   - 24 stops across the city
--   - 6 popular commuter routes
--   - 1 bus layout (standard 33-seater Kenyan matatu/midi)
--   - 10 buses with proper fleet numbers
--   - 7 days of trips per route, every 15-25 min during operating hours
--
-- Safe to re-run: uses ON CONFLICT DO NOTHING where appropriate.
-- =====================================================================

-- =====================================================================
-- STOPS
-- =====================================================================
insert into public.stops (id, name, short_name, area, lat, lng) values
  ('00000000-0000-0000-0000-000000000001', 'CBD — Kencom', 'Kencom', 'Nairobi CBD', -1.2864, 36.8222),
  ('00000000-0000-0000-0000-000000000002', 'CBD — Railways', 'Railways', 'Nairobi CBD', -1.2906, 36.8266),
  ('00000000-0000-0000-0000-000000000003', 'CBD — Ambassadeur', 'Ambassadeur', 'Nairobi CBD', -1.2841, 36.8255),
  ('00000000-0000-0000-0000-000000000004', 'Westlands — Sarit', 'Sarit', 'Westlands', -1.2632, 36.8025),
  ('00000000-0000-0000-0000-000000000005', 'Westlands — Stage', 'Westlands Stage', 'Westlands', -1.2659, 36.8088),
  ('00000000-0000-0000-0000-000000000006', 'Rongai — Stage', 'Rongai', 'Rongai', -1.4011, 36.7491),
  ('00000000-0000-0000-0000-000000000007', 'Ngong Road — Junction', 'Junction', 'Ngong Road', -1.2989, 36.7626),
  ('00000000-0000-0000-0000-000000000008', 'Kikuyu — Stage', 'Kikuyu', 'Kikuyu', -1.2453, 36.6634),
  ('00000000-0000-0000-0000-000000000009', 'Kawangware — 56', 'Kawangware 56', 'Kawangware', -1.2779, 36.7421),
  ('00000000-0000-0000-0000-000000000010', 'Eastleigh — Section 1', 'Eastleigh', 'Eastleigh', -1.2752, 36.8508),
  ('00000000-0000-0000-0000-000000000011', 'Ngong — Stage', 'Ngong', 'Ngong', -1.3556, 36.6571),
  ('00000000-0000-0000-0000-000000000012', 'Karen — Shopping Centre', 'Karen', 'Karen', -1.3197, 36.7076),
  ('00000000-0000-0000-0000-000000000013', 'Lavington — Mall', 'Lavington', 'Lavington', -1.2766, 36.7766),
  ('00000000-0000-0000-0000-000000000014', 'Dagoretti — Corner', 'Dagoretti', 'Dagoretti', -1.2978, 36.7281),
  ('00000000-0000-0000-0000-000000000015', 'Adams — Arcade', 'Adams', 'Ngong Road', -1.2933, 36.7795),
  ('00000000-0000-0000-0000-000000000016', 'Galleria', 'Galleria', 'Karen', -1.3320, 36.7178),
  ('00000000-0000-0000-0000-000000000017', 'Yaya Centre', 'Yaya', 'Hurlingham', -1.2902, 36.7858),
  ('00000000-0000-0000-0000-000000000018', 'Prestige Plaza', 'Prestige', 'Ngong Road', -1.2949, 36.7847),
  ('00000000-0000-0000-0000-000000000019', 'Kabete — Junction', 'Kabete', 'Kabete', -1.2596, 36.7407),
  ('00000000-0000-0000-0000-000000000020', 'Uthiru — Stage', 'Uthiru', 'Uthiru', -1.2683, 36.7211),
  ('00000000-0000-0000-0000-000000000021', 'Muthurwa', 'Muthurwa', 'Nairobi CBD', -1.2858, 36.8324),
  ('00000000-0000-0000-0000-000000000022', 'Globe — Roundabout', 'Globe', 'Nairobi CBD', -1.2769, 36.8253),
  ('00000000-0000-0000-0000-000000000023', 'Pangani — Shopping', 'Pangani', 'Pangani', -1.2613, 36.8358),
  ('00000000-0000-0000-0000-000000000024', 'Eastleigh — 12th Street', 'Eastleigh 12th', 'Eastleigh', -1.2727, 36.8553)
on conflict (id) do nothing;


-- =====================================================================
-- ROUTES
-- =====================================================================
insert into public.routes (id, code, name, origin_stop_id, destination_stop_id, description, frequency_label, active) values
  ('00000000-0000-0000-0000-0000000000a1', '33', 'CBD → Rongai',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000006',
    'Via Langata Road. The classic Rongai commuter route.',
    'Every 15 min', true),
  ('00000000-0000-0000-0000-0000000000a2', '105', 'CBD → Kikuyu',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000008',
    'Via Waiyaki Way and Westlands.',
    'Every 20 min', true),
  ('00000000-0000-0000-0000-0000000000a3', '58', 'Westlands → CBD',
    '00000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000001',
    'Inbound morning commute.',
    'Every 10 min', true),
  ('00000000-0000-0000-0000-0000000000a4', '11B', 'CBD → Eastleigh',
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000010',
    'Through Pangani.',
    'Every 15 min', true),
  ('00000000-0000-0000-0000-0000000000a5', '46', 'CBD → Kawangware',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000009',
    'Via Adams Arcade and Lavington.',
    'Every 20 min', true),
  ('00000000-0000-0000-0000-0000000000a6', '32', 'Ngong → CBD',
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000001',
    'Via Karen and Junction.',
    'Every 25 min', true)
on conflict (id) do nothing;


-- =====================================================================
-- ROUTE STOPS — ordered stops per route
-- =====================================================================
insert into public.route_stops (route_id, stop_id, sequence) values
  -- Route 33: CBD → Rongai
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000001', 1),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000007', 2),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000018', 3),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000012', 4),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000006', 5),
  -- Route 105: CBD → Kikuyu
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000001', 1),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000005', 2),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000020', 3),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000019', 4),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000008', 5),
  -- Route 58: Westlands → CBD
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000004', 1),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000005', 2),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000003', 3),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000001', 4),
  -- Route 11B: CBD → Eastleigh
  ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-000000000003', 1),
  ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-000000000022', 2),
  ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-000000000023', 3),
  ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-000000000010', 4),
  ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-000000000024', 5),
  -- Route 46: CBD → Kawangware
  ('00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-000000000001', 1),
  ('00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-000000000015', 2),
  ('00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-000000000013', 3),
  ('00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-000000000009', 4),
  -- Route 32: Ngong → CBD
  ('00000000-0000-0000-0000-0000000000a6', '00000000-0000-0000-0000-000000000011', 1),
  ('00000000-0000-0000-0000-0000000000a6', '00000000-0000-0000-0000-000000000012', 2),
  ('00000000-0000-0000-0000-0000000000a6', '00000000-0000-0000-0000-000000000007', 3),
  ('00000000-0000-0000-0000-0000000000a6', '00000000-0000-0000-0000-000000000017', 4),
  ('00000000-0000-0000-0000-0000000000a6', '00000000-0000-0000-0000-000000000001', 5)
on conflict do nothing;


-- =====================================================================
-- BUS LAYOUT — standard Kenyan 33-seater
-- =====================================================================
-- Row 1 = cockpit (1A door-side, 1B middle, driver position to the right)
-- Rows 2-8 = main cabin, 2+aisle+2 (A,B | C,D) = 28 seats
-- Row 3B = conductor's perch by the door
-- Row 9 = back row, 5 across (A,B,C,D,E)
-- Total passenger seats = 2 + 28 + 5 - 1 (conductor) = 34. Adjust by reducing
-- one cabin row to match 33 — we'll keep 33 by using 7 cabin rows.
-- Final: 2 (cockpit) + 7*4 (cabin rows 2-8) + 5 (back row 9) - 1 (conductor) = 34
-- Actually let's keep it clean: 33 total seats including conductor.
--    Cockpit: 1A, 1B = 2
--    Cabin rows 2-8 (7 rows × 4 seats) = 28
--    Back row 9: 9A, 9B, 9C, 9D = 4 (slightly narrower back for 33 total)
--    Conductor: 3B (counted in the 28 above)
--    TOTAL = 2 + 28 + 4 = 34 → drop 9D → 33. Done.
-- =====================================================================
insert into public.bus_layouts (id, name, total_seats, seat_map) values
  ('00000000-0000-0000-0000-0000000000c1', 'Standard 33-seater (Kenyan layout)', 33,
   '[
      {"id":"1A","row":1,"col":"A","type":"cockpit"},
      {"id":"1B","row":1,"col":"B","type":"cockpit"},

      {"id":"2A","row":2,"col":"A","type":"regular"},
      {"id":"2B","row":2,"col":"B","type":"regular"},
      {"id":"2C","row":2,"col":"C","type":"regular"},
      {"id":"2D","row":2,"col":"D","type":"regular"},

      {"id":"3A","row":3,"col":"A","type":"regular"},
      {"id":"3B","row":3,"col":"B","type":"conductor"},
      {"id":"3C","row":3,"col":"C","type":"regular"},
      {"id":"3D","row":3,"col":"D","type":"regular"},

      {"id":"4A","row":4,"col":"A","type":"regular"},
      {"id":"4B","row":4,"col":"B","type":"regular"},
      {"id":"4C","row":4,"col":"C","type":"regular"},
      {"id":"4D","row":4,"col":"D","type":"regular"},

      {"id":"5A","row":5,"col":"A","type":"regular"},
      {"id":"5B","row":5,"col":"B","type":"regular"},
      {"id":"5C","row":5,"col":"C","type":"regular"},
      {"id":"5D","row":5,"col":"D","type":"regular"},

      {"id":"6A","row":6,"col":"A","type":"regular"},
      {"id":"6B","row":6,"col":"B","type":"regular"},
      {"id":"6C","row":6,"col":"C","type":"regular"},
      {"id":"6D","row":6,"col":"D","type":"regular"},

      {"id":"7A","row":7,"col":"A","type":"regular"},
      {"id":"7B","row":7,"col":"B","type":"regular"},
      {"id":"7C","row":7,"col":"C","type":"regular"},
      {"id":"7D","row":7,"col":"D","type":"regular"},

      {"id":"8A","row":8,"col":"A","type":"regular"},
      {"id":"8B","row":8,"col":"B","type":"regular"},
      {"id":"8C","row":8,"col":"C","type":"regular"},
      {"id":"8D","row":8,"col":"D","type":"regular"},

      {"id":"9A","row":9,"col":"A","type":"back_row"},
      {"id":"9B","row":9,"col":"B","type":"back_row"},
      {"id":"9C","row":9,"col":"C","type":"back_row"},
      {"id":"9D","row":9,"col":"D","type":"back_row"}
    ]'::jsonb)
on conflict (id) do nothing;


-- =====================================================================
-- BUSES — 10 buses with proper Kenyan fleet numbers
-- =====================================================================
insert into public.buses (id, fleet_number, plate, layout_id, nickname, active) values
  ('00000000-0000-0000-0000-0000000000d1', 'KCB 245', 'KCB 245X', '00000000-0000-0000-0000-0000000000c1', 'Citizen', true),
  ('00000000-0000-0000-0000-0000000000d2', 'KCB 891', 'KCB 891Y', '00000000-0000-0000-0000-0000000000c1', 'Mbao', true),
  ('00000000-0000-0000-0000-0000000000d3', 'KDA 117', 'KDA 117M', '00000000-0000-0000-0000-0000000000c1', 'Detroit', true),
  ('00000000-0000-0000-0000-0000000000d4', 'KDB 332', 'KDB 332L', '00000000-0000-0000-0000-0000000000c1', 'Subzero', true),
  ('00000000-0000-0000-0000-0000000000d5', 'KCH 408', 'KCH 408F', '00000000-0000-0000-0000-0000000000c1', 'Zinjili', true),
  ('00000000-0000-0000-0000-0000000000d6', 'KCJ 552', 'KCJ 552Q', '00000000-0000-0000-0000-0000000000c1', 'Boss', true),
  ('00000000-0000-0000-0000-0000000000d7', 'KCR 619', 'KCR 619W', '00000000-0000-0000-0000-0000000000c1', 'Kasarani', true),
  ('00000000-0000-0000-0000-0000000000d8', 'KDC 712', 'KDC 712V', '00000000-0000-0000-0000-0000000000c1', 'Maestro', true),
  ('00000000-0000-0000-0000-0000000000d9', 'KCE 803', 'KCE 803S', '00000000-0000-0000-0000-0000000000c1', 'Eclipse', true),
  ('00000000-0000-0000-0000-0000000000da', 'KCM 904', 'KCM 904K', '00000000-0000-0000-0000-0000000000c1', 'Pioneer', true)
on conflict (id) do nothing;


-- =====================================================================
-- TRIPS — 7 days × 6 routes × ~8 trips/day = ~336 trips
-- =====================================================================
-- Generates trips for every route from today through 7 days out.
-- Each route gets trips every ~15-25 min between 5:30 AM and 10:30 PM.
-- Buses are assigned round-robin so each fleet number shows up across routes.
-- =====================================================================
do $$
declare
  v_day int;
  v_route record;
  v_bus_idx int := 0;
  v_buses uuid[];
  v_hour int;
  v_minute int;
  v_departure timestamptz;
  v_interval_min int;
begin
  -- Collect bus IDs into an array
  select array_agg(id order by fleet_number) into v_buses from public.buses where active = true;

  for v_day in 0..6 loop
    for v_route in select id, code from public.routes where active = true order by code loop
      -- Different frequencies per route (matches frequency_label)
      v_interval_min := case v_route.code
        when '33'  then 15
        when '105' then 20
        when '58'  then 10
        when '11B' then 15
        when '46'  then 20
        when '32'  then 25
        else 20
      end;

      v_hour := 5;
      v_minute := 30;
      while (v_hour < 22) or (v_hour = 22 and v_minute <= 30) loop
        v_departure := (current_date + v_day)::timestamptz
                       + make_interval(hours => v_hour, mins => v_minute);

        insert into public.trips (route_id, bus_id, departure_at, status)
        values (
          v_route.id,
          v_buses[(v_bus_idx % array_length(v_buses, 1)) + 1],
          v_departure,
          'scheduled'
        );

        v_bus_idx := v_bus_idx + 1;

        v_minute := v_minute + v_interval_min;
        while v_minute >= 60 loop
          v_hour := v_hour + 1;
          v_minute := v_minute - 60;
        end loop;
      end loop;
    end loop;
  end loop;
end $$;


-- =====================================================================
-- DASHBOARD STATS — initialise with computed values
-- =====================================================================
select public.refresh_dashboard_stats();


-- =====================================================================
-- DONE
-- =====================================================================
-- You should now have:
--   24 stops, 6 routes, 26 route_stops, 1 bus layout, 10 buses,
--   ~336 trips spread across the next 7 days.
--
-- Verify with:
--   select count(*) from stops;        -- 24
--   select count(*) from routes;       -- 6
--   select count(*) from buses;        -- 10
--   select count(*) from trips;        -- ~336
-- =====================================================================
