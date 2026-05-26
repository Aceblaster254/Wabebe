'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import './seat-map.css';

// Generate a per-browser session ID for holds (stays the same across reloads)
function getSessionId() {
  if (typeof window === 'undefined') return null;
  let id = localStorage.getItem('wabebe_session_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('wabebe_session_id', id);
  }
  return id;
}

export default function SeatMapPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.tripId;

  const [trip, setTrip] = useState(null);
  const [seats, setSeats] = useState([]);
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [holdExpiresAt, setHoldExpiresAt] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const sessionIdRef = useRef(null);

  // Fetch trip + bus details once
  useEffect(() => {
    async function loadTrip() {
      const { data, error } = await supabase
        .from('trips')
        .select(`
          id,
          departure_at,
          status,
          buses (fleet_number, plate, nickname, bus_layouts (seat_map)),
          routes (code, name)
        `)
        .eq('id', tripId)
        .maybeSingle();

      if (error || !data) {
        setError('Trip not found');
        setLoading(false);
        return;
      }

      setTrip(data);
      setLoading(false);
    }

    sessionIdRef.current = getSessionId();
    loadTrip();
  }, [tripId]);

  // Load seat status and subscribe to live updates
  useEffect(() => {
    if (!tripId) return;

    async function loadSeats() {
      const { data, error } = await supabase
        .rpc('get_seat_status', { p_trip_id: tripId });

      if (!error && data) {
        setSeats(data);
      }
    }

    loadSeats();

    // Subscribe to seat_holds and bookings changes for this trip
    const channel = supabase
      .channel(`trip-${tripId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'seat_holds', filter: `trip_id=eq.${tripId}` },
        () => loadSeats()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings', filter: `trip_id=eq.${tripId}` },
        () => loadSeats()
      )
      .subscribe();

    // Also refresh every 10 seconds as a fallback in case a hold quietly expires
    const interval = setInterval(loadSeats, 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [tripId]);

  // Hold countdown timer
  useEffect(() => {
    if (!holdExpiresAt) {
      setSecondsLeft(0);
      return;
    }

    function updateCountdown() {
      const remaining = Math.max(0, Math.floor((holdExpiresAt - Date.now()) / 1000));
      setSecondsLeft(remaining);

      if (remaining === 0) {
        // Hold expired — release UI state
        setSelectedSeat(null);
        setHoldExpiresAt(null);
      }
    }

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [holdExpiresAt]);

  // Handle seat tap
  async function selectSeat(seat) {
    if (busy) return;
    if (seat.status === 'taken' || seat.status === 'booked' || seat.status === 'conductor') return;

    setBusy(true);

    // If a different seat is already selected, release that hold first
    if (selectedSeat && selectedSeat !== seat.id) {
      await supabase.rpc('release_seat_hold', {
        p_trip_id: tripId,
        p_seat_id: selectedSeat
      });
    }

    // Try to place a new hold
    const { data: success, error: holdError } = await supabase.rpc('hold_seat', {
      p_trip_id: tripId,
      p_seat_id: seat.id,
      p_session_id: sessionIdRef.current
    });

    if (holdError) {
      console.error('Hold failed:', holdError);
      // If user isn't logged in we get an auth error — for v1.0 we'll send them through login first
      if (holdError.message?.includes('logged in')) {
        router.push(`/login?next=/book/${tripId}`);
      }
      setBusy(false);
      return;
    }

    if (!success) {
      // Someone else got it first
      setBusy(false);
      // Refresh to show the latest state
      const { data } = await supabase.rpc('get_seat_status', { p_trip_id: tripId });
      if (data) setSeats(data);
      return;
    }

    // Success — update local state
    setSelectedSeat(seat.id);
    setHoldExpiresAt(Date.now() + 2 * 60 * 1000); // 2 minutes
    setBusy(false);
  }

  async function cancelSelection() {
    if (!selectedSeat) return;
    setBusy(true);
    await supabase.rpc('release_seat_hold', {
      p_trip_id: tripId,
      p_seat_id: selectedSeat
    });
    setSelectedSeat(null);
    setHoldExpiresAt(null);
    setBusy(false);
  }

  function continueToConfirm() {
    if (!selectedSeat) return;
    router.push(`/book/${tripId}/confirm?seat=${selectedSeat}`);
  }

  // ===== Render =====

  if (loading) {
    return <main className="seat-map-page"><div className="sm-loading">Loading bus details…</div></main>;
  }

  if (error || !trip) {
    return (
      <main className="seat-map-page">
        <div className="sm-error">
          <h1>Trip not available</h1>
          <p>This trip may have departed or been cancelled.</p>
          <Link href="/" className="sm-back-home">← Back to home</Link>
        </div>
      </main>
    );
  }

  const seatMap = trip.buses?.bus_layouts?.seat_map || [];
  const dep = new Date(trip.departure_at);
  const timeStr = dep.toLocaleTimeString('en-KE', { hour: 'numeric', minute: '2-digit', hour12: true });

  // Group seats by row for grid rendering
  const seatsByRow = {};
  for (const layoutSeat of seatMap) {
    const status = seats.find(s => s.seat_id === layoutSeat.id);
    const row = layoutSeat.row;
    if (!seatsByRow[row]) seatsByRow[row] = [];
    seatsByRow[row].push({
      ...layoutSeat,
      status: status?.status || 'available',
      heldByMe: status?.held_by_me || false
    });
  }

  const rowNumbers = Object.keys(seatsByRow).map(Number).sort((a, b) => a - b);

  return (
    <main className="seat-map-page">
      {/* Header */}
      <div className="sm-header">
        <div className="sm-header-inner">
          <Link href={`/routes/${trip.routes.code}`} className="sm-back">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back
          </Link>

          <div className="sm-trip-info">
            <div className="sm-trip-route">
              Route {trip.routes.code} · {trip.routes.name}
            </div>
            <div className="sm-trip-meta">
              <strong>{trip.buses.fleet_number}</strong>
              {trip.buses.nickname && <span> "{trip.buses.nickname}"</span>}
              <span className="sm-dot">·</span>
              <span>Departs {timeStr}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Title + legend */}
      <section className="sm-title-block">
        <h1 className="sm-title">Pick your seat</h1>
        <div className="sm-legend">
          <span className="sm-legend-item"><span className="sm-swatch sw-available"></span>Available</span>
          <span className="sm-legend-item"><span className="sm-swatch sw-selected"></span>Selected</span>
          <span className="sm-legend-item"><span className="sm-swatch sw-booked"></span>Booked</span>
          <span className="sm-legend-item"><span className="sm-swatch sw-conductor"></span>Conductor</span>
        </div>
      </section>

      {/* Bus diagram */}
      <section className="sm-bus">
        <div className="sm-bus-inner">
          <div className="sm-bus-front">
            <span>Door</span>
            <span>Front of bus</span>
            <span>Driver</span>
          </div>

          <div className="sm-grid">
            {rowNumbers.map(rowNum => {
              const isCockpit = rowNum === 1;
              const isBackRow = rowNumbers.indexOf(rowNum) === rowNumbers.length - 1;
              const rowSeats = seatsByRow[rowNum].sort((a, b) => a.col.localeCompare(b.col));

              return (
                <div
                  key={rowNum}
                  className={`sm-row ${isCockpit ? 'sm-row-cockpit' : ''} ${isBackRow ? 'sm-row-back' : ''}`}
                >
                  {isCockpit ? (
                    <>
                      {rowSeats.map(seat => (
                        <Seat key={seat.id} seat={seat} selectedSeat={selectedSeat} onClick={() => selectSeat(seat)} />
                      ))}
                      <div className="sm-spacer-wide"></div>
                      <div className="sm-driver">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"/>
                          <line x1="2" y1="12" x2="22" y2="12"/>
                          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                        </svg>
                      </div>
                    </>
                  ) : isBackRow ? (
                    rowSeats.map(seat => (
                      <Seat key={seat.id} seat={seat} selectedSeat={selectedSeat} onClick={() => selectSeat(seat)} />
                    ))
                  ) : (
                    <>
                      {/* Left side: A and B (or door placeholders) */}
                      {['A', 'B'].map(col => {
                        const seat = rowSeats.find(s => s.col === col);
                        return seat ? (
                          <Seat key={`${rowNum}${col}`} seat={seat} selectedSeat={selectedSeat} onClick={() => selectSeat(seat)} />
                        ) : (
                          <div key={`${rowNum}${col}-gap`} className="sm-seat-gap" title="Mid-door"></div>
                        );
                      })}

                      {/* Aisle */}
                      <div className="sm-aisle"></div>

                      {/* Right side: C and D (or door placeholders) */}
                      {['C', 'D'].map(col => {
                        const seat = rowSeats.find(s => s.col === col);
                        return seat ? (
                          <Seat key={`${rowNum}${col}`} seat={seat} selectedSeat={selectedSeat} onClick={() => selectSeat(seat)} />
                        ) : (
                          <div key={`${rowNum}${col}-gap`} className="sm-seat-gap" title="Mid-door"></div>
                        );
                      })}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <div className="sm-bus-rear">Rear of bus</div>
        </div>
      </section>

      {/* Summary / CTA */}
      <section className="sm-summary">
        {!selectedSeat ? (
          <div className="sm-summary-empty">Tap a seat above to begin</div>
        ) : (
          <div className="sm-summary-active">
            <div className="sm-summary-row">
              <div>
                <div className="sm-summary-label">Selected</div>
                <div className="sm-summary-seat">Seat {selectedSeat}</div>
              </div>
              <div className="sm-hold-timer">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                Held {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
              </div>
            </div>

            <div className="sm-summary-actions">
              <button onClick={cancelSelection} className="sm-btn-cancel" disabled={busy}>
                Cancel
              </button>
              <button onClick={continueToConfirm} className="sm-btn-confirm" disabled={busy}>
                Confirm seat →
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

// ============ SEAT BUTTON ============
function Seat({ seat, selectedSeat, onClick }) {
  const isSelected = selectedSeat === seat.id;
  const classes = ['sm-seat', `sm-seat-${seat.type}`, `sm-seat-${seat.status}`];
  if (isSelected) classes.push('sm-seat-selected');

  const disabled = seat.status === 'booked' || seat.type === 'conductor';

  return (
    <button
      type="button"
      className={classes.join(' ')}
      onClick={onClick}
      disabled={disabled}
      aria-label={`Seat ${seat.id}, ${seat.status}`}
      title={
        seat.type === 'conductor' ? 'Reserved for the conductor' :
        seat.status === 'booked' ? 'Already booked' :
        `Select seat ${seat.id}`
      }
    >
      {seat.type === 'conductor' ? 'C' : seat.id}
    </button>
  );
}