'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import RouteCard from './RouteCard';
import './PopularRoutes.css';

export default function PopularRoutes() {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRoutes() {
      // Step 1: Fetch all active routes
      const { data: routeData, error: routeError } = await supabase
        .from('routes')
        .select('id, code, name, frequency_label')
        .eq('active', true)
        .order('code');

      if (routeError || !routeData) {
        console.error('Could not load routes:', routeError);
        setLoading(false);
        return;
      }

      // Step 2: For each route, find the next upcoming trip and count its booked seats
      const routesWithSeats = await Promise.all(
        routeData.map(async (route) => {
          // Find the very next trip for this route
          const { data: nextTrip } = await supabase
            .from('trips')
            .select('id')
            .eq('route_id', route.id)
            .eq('status', 'scheduled')
            .gt('departure_at', new Date().toISOString())
            .order('departure_at', { ascending: true })
            .limit(1)
            .maybeSingle();

          // If there's no upcoming trip, don't compute seats
          if (!nextTrip) {
            return { ...route, seatsAvailable: null };
          }

          // Count how many seats are already booked on that trip
            const { data: bookedCount, error: countError } = await supabase
            .rpc('count_trip_bookings', { p_trip_id: nextTrip.id });

            // A 33-seater bus minus the conductor seat = 32 bookable seats
            const TOTAL_BOOKABLE_SEATS = 32;
            const seatsAvailable = TOTAL_BOOKABLE_SEATS - (bookedCount || 0);
            
            return { ...route, seatsAvailable };

        })
      );

      setRoutes(routesWithSeats);
      setLoading(false);
    }

    loadRoutes();
  }, []);

  return (
    <section className="block">
      <div className="section-head">
        <div className="section-head-left">
          <div className="section-eyebrow">Popular routes</div>
          <h2 className="section-title">
            Where Nairobi is <em>going today.</em>
          </h2>
        </div>

        <Link href="/routes" className="section-link">
          All routes
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {loading ? (
        <div className="route-grid-loading">Loading routes...</div>
      ) : (
        <div className="route-grid">
          {routes.map((route) => (
            <RouteCard
              key={route.id}
              code={route.code}
              name={route.name}
              frequencyLabel={route.frequency_label}
              seatsAvailable={route.seatsAvailable}
            />
          ))}
        </div>
      )}
    </section>
  );
}