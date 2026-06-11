'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import TripRow from '@/components/TripRow';
import './route-detail.css';

export default function RouteDetailPage() {
  const params = useParams();
  const code = params.code;

  const [route, setRoute] = useState(null);
  const [stops, setStops] = useState([]);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadEverything() {
      // 1. Fetch the route info
      const { data: routeData, error: routeError } = await supabase
        .from('routes')
        .select('id, code, name, description, frequency_label')
        .eq('code', code)
        .eq('active', true)
        .maybeSingle();

      if (routeError || !routeData) {
        setError('Route not found');
        setLoading(false);
        return;
      }
      setRoute(routeData);

      // 2. Fetch the stops along the route
      const { data: stopsData } = await supabase
        .from('route_stops')
        .select('sequence, stops(id, name, short_name)')
        .eq('route_id', routeData.id)
        .order('sequence');

      if (stopsData) {
        setStops(stopsData.map(rs => rs.stops));
      }

      // 3. Fetch upcoming trips via the RPC
      const { data: tripsData, error: tripsError } = await supabase
        .rpc('get_upcoming_trips_for_route', { p_route_code: code, p_limit: 30 });

      if (!tripsError && tripsData) {
        setTrips(tripsData);
      }

      setLoading(false);
    }

    loadEverything();

    // Refresh trips every 60 seconds so seat counts stay live
    const interval = setInterval(async () => {
      const { data } = await supabase.rpc('get_upcoming_trips_for_route', {
        p_route_code: code,
        p_limit: 30
      });
      if (data) setTrips(data);
    }, 60000);

    return () => clearInterval(interval);
  }, [code]);

  // Loading state
  if (loading) {
    return (
      <main className="route-detail">
        <div className="route-detail-loading">Loading route details…</div>
      </main>
    );
  }

  // Error state — route doesn't exist
  if (error || !route) {
    return (
      <main className="route-detail">
        <div className="route-detail-error">
          <h1>Route not found</h1>
          <p>We couldn't find a route with code "{code}".</p>
          <Link href="/" className="back-home">← Back to home</Link>
        </div>
      </main>
    );
  }

  // Split route name like "CBD → Rongai" into From and To
  const parts = route.name.split('→').map(s => s.trim());
  const from = parts[0] || route.name;
  const to = parts[1] || '';

  return (
    <main className="route-detail">
      {/* Header / hero */}
      <section className="rd-hero">
        <div className="rd-hero-inner">
          <Link href="/" className="rd-back">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </Link>

          <div className="rd-route-num">Route {route.code}</div>
          <h1 className="rd-route-name">
            {from} <span className="rd-route-arrow">→</span> {to}
          </h1>

          {route.description && (
            <p className="rd-route-desc">{route.description}</p>
          )}

          <div className="rd-meta">
            <div className="rd-meta-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              {route.frequency_label}
            </div>
            <div className="rd-meta-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              {stops.length} stops
            </div>
          </div>

          {/* Stop list — horizontal scroll on mobile */}
          {stops.length > 0 && (
            <div className="rd-stops">
              {stops.map((stop, idx) => (
                <div key={stop.id} className="rd-stop">
                  <div className="rd-stop-dot"></div>
                  <div className="rd-stop-name">{stop.short_name || stop.name}</div>
                  {idx < stops.length - 1 && <div className="rd-stop-line"></div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Trip list */}
      <section className="rd-trips">
        <div className="rd-trips-inner">
          <div className="rd-trips-head">
            <h2 className="rd-trips-title">Upcoming trips</h2>
            <div className="rd-trips-count">
              {trips.length} {trips.length === 1 ? 'trip' : 'trips'} available
            </div>
          </div>

          {trips.length === 0 ? (
            <div className="rd-trips-empty">
              No upcoming trips on this route right now. Check back soon.
            </div>
          ) : (
            <div className="rd-trips-list">
              {trips.map(trip => (
                <TripRow
                  key={trip.trip_id}
                  trip={trip}
                  stops={stops.map((s, i) => ({ ...s, sequence: i + 1 }))}
                  originStopId={stops[0]?.id}
                  routeId={route?.id}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}