'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/lib/supabase';
import './track.css';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export default function TrackPage() {
  const params = useParams();
  const bookingId = params.bookingId;

  const [view, setView] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const busMarkerRef = useRef(null);
  const passengerMarkerRef = useRef(null);
  const mapReadyRef = useRef(false);

  // ===== Data loading + realtime =====
  useEffect(() => {
    if (!bookingId) return;
    document.body.dataset.hideNav = 'true';

    async function loadView() {
      const { data, error: rpcError } = await supabase
        .rpc('get_track_view', { p_booking_id: bookingId });

      if (rpcError) {
        setError(rpcError.message);
        setLoading(false);
        return;
      }
      if (data?.error === 'booking_not_found') {
        setError('Booking not found');
        setLoading(false);
        return;
      }
      setView(data);
      setLoading(false);
    }

    loadView();

    const tripChannel = supabase
      .channel(`track-${bookingId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'gps_pings' },
        () => loadView())
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'trips' },
        () => loadView())
      .subscribe();

    const interval = setInterval(loadView, 20000);

    return () => {
      supabase.removeChannel(tripChannel);
      clearInterval(interval);
      delete document.body.dataset.hideNav;
    };
  }, [bookingId]);

  // ===== Map init (runs once, when view first arrives) =====
  useEffect(() => {
    if (!view) return;
    if (mapRef.current) {
    // Map exists, redraw whenever view updates
    if (mapReadyRef.current) {
        drawMap();
    } else {
        // Map exists but style still loading — wait
        mapRef.current.once('load', drawMap);
    }
    return;
    }
    if (!mapContainerRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [parseFloat(view.passenger_location.lng), parseFloat(view.passenger_location.lat)],
      zoom: 12,
      attributionControl: false
    });
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

    mapRef.current = map;

    map.on('load', () => {
      mapReadyRef.current = true;
      drawMap();
      fitBounds();
    });

    return () => {
      if (busMarkerRef.current) { busMarkerRef.current.remove(); busMarkerRef.current = null; }
      if (passengerMarkerRef.current) { passengerMarkerRef.current.remove(); passengerMarkerRef.current = null; }
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
      mapReadyRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  function drawMap() {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current || !view) return;

    const { passenger_location: passenger, stops, pings } = view;

    // --- Amber dashed route line ---
    const routeCoords = stops
      .filter(s => s.lat && s.lng)
      .map(s => [parseFloat(s.lng), parseFloat(s.lat)]);

    if (routeCoords.length >= 2) {
      const data = {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: routeCoords }
      };
      if (map.getSource('route-line')) {
        map.getSource('route-line').setData(data);
      } else {
        map.addSource('route-line', { type: 'geojson', data });
        map.addLayer({
          id: 'route-line-layer',
          type: 'line',
          source: 'route-line',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#C97B1E',
            'line-width': 4,
            'line-opacity': 0.5,
            'line-dasharray': [2, 2]
          }
        });
      }
    }

    // --- Bus marker (current position from latest ping) ---
    if (pings && pings.length > 0) {
      const lastPing = pings[pings.length - 1];
      const busPos = [parseFloat(lastPing.lng), parseFloat(lastPing.lat)];

      if (busMarkerRef.current) {
        busMarkerRef.current.setLngLat(busPos);
      } else {
        const el = document.createElement('div');
        el.className = 'tk-bus-marker';
        el.innerHTML = `
          <div class="tk-bus-pulse"></div>
          <div class="tk-bus-dot">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2">
              <rect x="4" y="6" width="16" height="12" rx="2"/>
              <circle cx="8" cy="18" r="1.5" fill="white"/>
              <circle cx="16" cy="18" r="1.5" fill="white"/>
            </svg>
          </div>
        `;
        busMarkerRef.current = new mapboxgl.Marker(el, { anchor: 'center' })
          .setLngLat(busPos)
          .addTo(map);
      }
    }

    // --- Passenger pin ---
    if (passenger.lat && passenger.lng) {
      const passPos = [parseFloat(passenger.lng), parseFloat(passenger.lat)];
      if (passengerMarkerRef.current) {
        passengerMarkerRef.current.setLngLat(passPos);
      } else {
        const el = document.createElement('div');
        el.className = 'tk-passenger-marker';
        el.innerHTML = `
          <svg width="22" height="28" viewBox="0 0 24 24" fill="none" stroke="#C97B1E" stroke-width="2.2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="#FAC775"/>
            <circle cx="12" cy="10" r="3" fill="white"/>
          </svg>
        `;
        passengerMarkerRef.current = new mapboxgl.Marker(el, { anchor: 'bottom' })
          .setLngLat(passPos)
          .addTo(map);
      }
    }
  }

  function fitBounds() {
    const map = mapRef.current;
    if (!map || !view) return;

    const { passenger_location: passenger, pings } = view;
    if (!pings || pings.length === 0) {
      map.flyTo({ center: [parseFloat(passenger.lng), parseFloat(passenger.lat)], zoom: 14 });
      return;
    }

    const lastPing = pings[pings.length - 1];
    const bounds = new mapboxgl.LngLatBounds();
    bounds.extend([parseFloat(passenger.lng), parseFloat(passenger.lat)]);
    bounds.extend([parseFloat(lastPing.lng), parseFloat(lastPing.lat)]);

    map.fitBounds(bounds, {
      padding: { top: 120, bottom: 240, left: 50, right: 50 },
      maxZoom: 14
    });
  }

  // ===== Render =====
  if (loading) {
    return (
      <main className="tk-page">
        <div className="tk-center">Loading your bus tracker…</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="tk-page">
        <div className="tk-error">
          <h1>Couldn't load tracking</h1>
          <p>{error}</p>
          <Link href="/" className="tk-back">← Back home</Link>
        </div>
      </main>
    );
  }

  const { booking, trip, passenger_location, pings, stops } = view;

  const tripStatus = trip.status;
  const hasGPS = pings.length > 0;
  const isCompleted = tripStatus === 'completed';
  const isCancelled = booking.status === 'cancelled' || booking.status === 'no_show';

  let etaMinutes = null;
let busPassedPassenger = false;

if (hasGPS && !isCompleted && !isCancelled) {
  const lastPing = pings[pings.length - 1];
  const busLat = parseFloat(lastPing.lat);
  const busLng = parseFloat(lastPing.lng);
  const passLat = parseFloat(passenger_location.lat);
  const passLng = parseFloat(passenger_location.lng);

  // Find which ping in our history was the closest to the passenger
  let closestDist = Infinity;
  let closestIdx = -1;
  pings.forEach((p, i) => {
    const d = haversine(parseFloat(p.lat), parseFloat(p.lng), passLat, passLng);
    if (d < closestDist) {
      closestDist = d;
      closestIdx = i;
    }
  });

  // If the closest ping is NOT the most recent one, the bus has passed
  // (we need at least 3 pings of history for this to be meaningful)
  if (pings.length >= 3 && closestIdx < pings.length - 1) {
    busPassedPassenger = true;
  }

  if (!busPassedPassenger) {
    const distMeters = haversine(busLat, busLng, passLat, passLng);
    const speedMps = lastPing.speed_mps || 8;
    etaMinutes = Math.max(0, Math.round((distMeters / speedMps) / 60));
  }
}

  let statusText, statusTone;
    if (isCancelled) {
    statusText = booking.status === 'cancelled' ? 'Booking cancelled' : 'Marked no-show';
    statusTone = 'tk-status-warn';
    } else if (isCompleted) {
    statusText = 'Trip completed';
    statusTone = 'tk-status-done';
    } else if (busPassedPassenger) {
    statusText = 'Bus has passed your stop';
    statusTone = 'tk-status-passed';
    } else if (!hasGPS && tripStatus === 'scheduled') {
    statusText = 'Bus hasn\'t started broadcasting yet';
    statusTone = 'tk-status-waiting';
    } else if (etaMinutes !== null && etaMinutes <= 1) {
    statusText = 'Bus is approaching your stop';
    statusTone = 'tk-status-arriving';
    } else if (etaMinutes !== null) {
    statusText = `Arrives in ~${etaMinutes} min`;
    statusTone = 'tk-status-tracking';
    } else {
    statusText = 'Tracking bus…';
    statusTone = 'tk-status-tracking';
    }

  return (
    <main className="tk-page">
      <div className="tk-map" ref={mapContainerRef}></div>

      <div className="tk-top">
        <Link href={`/boarding-pass/${booking.id}`} className="tk-back-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </Link>
        <div className="tk-top-info">
          <div className="tk-top-route">Route {trip.route_code} · {trip.route_name}</div>
          <div className="tk-top-meta">
            Seat {booking.seat_id} · {trip.bus_fleet_number}
            {trip.bus_nickname && <em> "{trip.bus_nickname}"</em>}
          </div>
        </div>
      </div>

      <div className={`tk-bottom ${statusTone}`}>
        <div className="tk-status">
          <div className="tk-status-icon">
            {isCancelled ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            ) : isCompleted ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
            )}
          </div>
          <div className="tk-status-text">{statusText}</div>
        </div>

        <div className="tk-boarding">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          Boarding at <strong>{passenger_location.label}</strong>
        </div>

        <button className="tk-late-btn" disabled title="Coming soon">
          I'm running late
          <span className="tk-late-coming">soon</span>
        </button>
      </div>
    </main>
  );
}

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

