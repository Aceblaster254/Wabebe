'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import './seat-map.css';

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
  const searchParams = useSearchParams();
  const tripId = params.tripId;

  const boardingStopId = searchParams.get('boarding_stop');
  const alightingStopId = searchParams.get('alighting_stop');
  const boardingLat = searchParams.get('boarding_lat');
  const boardingLng = searchParams.get('boarding_lng');
  const boardingLabelAuto = searchParams.get('boarding_label_auto');
  const boardingLabelUser = searchParams.get('boarding_label_user');
  const alightingLat = searchParams.get('alighting_lat');
  const alightingLng = searchParams.get('alighting_lng');
  const alightingLabelAuto = searchParams.get('alighting_label_auto');
  const alightingLabelUser = searchParams.get('alighting_label_user');

  const [trip, setTrip] = useState(null);
  const [seats, setSeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // Selection state
  const [multiMode, setMultiMode] = useState(false);
  const [selectedSeats, setSelectedSeats] = useState([]); // works for both modes: [] or [id] or [id, id]
  const [holdExpiresAt, setHoldExpiresAt] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const sessionIdRef = useRef(null);

  // Load trip
  useEffect(() => {
    async function loadTrip() {
      const { data, error } = await supabase
        .from('trips')
        .select(`
          id, departure_at, status,
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

  // Load seats + subscribe to updates
  useEffect(() => {
    if (!tripId) return;

    async function loadSeats() {
      const { data, error } = await supabase.rpc('get_seat_status', { p_trip_id: tripId });
      if (!error && data) setSeats(data);
    }

    loadSeats();

    const channel = supabase
      .channel(`trip-${tripId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'seat_holds', filter: `trip_id=eq.${tripId}` },
        () => loadSeats())
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'bookings', filter: `trip_id=eq.${tripId}` },
        () => loadSeats())
      .subscribe();

    const interval = setInterval(loadSeats, 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [tripId]);

  // Countdown ticker
  useEffect(() => {
    if (!holdExpiresAt) { setSecondsLeft(0); return; }

    function tick() {
      const remaining = Math.max(0, Math.floor((holdExpiresAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) {
        setSelectedSeats([]);
        setHoldExpiresAt(null);
      }
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [holdExpiresAt]);

  // Handle mode toggle
  async function handleToggleMulti(nextEnabled) {
    // Release any current selection when switching modes to keep state clean
    if (selectedSeats.length > 0) {
      await releaseAllSelected();
    }
    setMultiMode(nextEnabled);
  }

  async function releaseAllSelected() {
    if (selectedSeats.length === 0) return;
    if (selectedSeats.length === 1) {
      await supabase.rpc('release_seat_hold', {
        p_trip_id: tripId,
        p_seat_id: selectedSeats[0]
      });
    } else {
      await supabase.rpc('release_seats', {
        p_trip_id: tripId,
        p_seat_ids: selectedSeats,
        p_session_id: sessionIdRef.current
      });
    }
    setSelectedSeats([]);
    setHoldExpiresAt(null);
  }

  // Tap a seat
  async function selectSeat(seat) {
    if (busy) return;
    if (seat.status === 'taken' || seat.status === 'booked' || seat.status === 'conductor') return;

    setBusy(true);

    if (!multiMode) {
      // === SINGLE-SELECT MODE (original behavior) ===
      // Replace any existing selection with this seat
      const already = selectedSeats.includes(seat.id);
      if (already) {
        // Tapping the same seat again releases it
        await supabase.rpc('release_seat_hold', {
          p_trip_id: tripId,
          p_seat_id: seat.id
        });
        setSelectedSeats([]);
        setHoldExpiresAt(null);
        setBusy(false);
        return;
      }

      // Different seat — release the old one first, then hold the new one
      if (selectedSeats.length > 0) {
        await supabase.rpc('release_seat_hold', {
          p_trip_id: tripId,
          p_seat_id: selectedSeats[0]
        });
      }
      const { data: success, error: holdError } = await supabase.rpc('hold_seat', {
        p_trip_id: tripId,
        p_seat_id: seat.id,
        p_session_id: sessionIdRef.current
      });

      if (holdError) {
        console.error('Hold failed:', holdError);
        setBusy(false);
        return;
      }
      if (!success) {
        // Race — someone else got it
        const { data } = await supabase.rpc('get_seat_status', { p_trip_id: tripId });
        if (data) setSeats(data);
        setBusy(false);
        return;
      }

      setSelectedSeats([seat.id]);
      setHoldExpiresAt(Date.now() + 2 * 60 * 1000);
      setBusy(false);
      return;
    }

    // === MULTI-SELECT MODE ===
    const already = selectedSeats.includes(seat.id);

    if (already) {
      // Tapping a selected seat removes it from the group
      await supabase.rpc('release_seats', {
        p_trip_id: tripId,
        p_seat_ids: [seat.id],
        p_session_id: sessionIdRef.current
      });
      const next = selectedSeats.filter(s => s !== seat.id);
      setSelectedSeats(next);
      if (next.length === 0) setHoldExpiresAt(null);
      setBusy(false);
      return;
    }

    // Cap at 2 seats
    if (selectedSeats.length >= 2) {
      // Ignore extra taps — user must remove a seat first
      setBusy(false);
      return;
    }

    // Add this seat via hold_seats_multi (both the existing + new seat, atomically)
    const nextSelection = [...selectedSeats, seat.id];
    const { data: result, error: holdError } = await supabase.rpc('hold_seats_multi', {
      p_trip_id: tripId,
      p_seat_ids: nextSelection,
      p_session_id: sessionIdRef.current
    });

    if (holdError || !result?.ok) {
      console.error('Multi-hold failed:', holdError || result);
      const { data } = await supabase.rpc('get_seat_status', { p_trip_id: tripId });
      if (data) setSeats(data);
      setBusy(false);
      return;
    }

    setSelectedSeats(nextSelection);
    setHoldExpiresAt(Date.now() + 2 * 60 * 1000);
    setBusy(false);
  }

  function continueToConfirm() {
    if (selectedSeats.length === 0) return;

    const params = new URLSearchParams();
    // Pass seats as comma-separated string: seat=2A,2B (or single: seat=2A)
    params.set('seat', selectedSeats.join(','));

    if (boardingStopId) params.append('boarding_stop', boardingStopId);
    if (boardingLat && boardingLng) {
      params.append('boarding_lat', boardingLat);
      params.append('boarding_lng', boardingLng);
      if (boardingLabelAuto) params.append('boarding_label_auto', boardingLabelAuto);
      if (boardingLabelUser) params.append('boarding_label_user', boardingLabelUser);
    }
    if (alightingStopId) params.append('alighting_stop', alightingStopId);
    if (alightingLat && alightingLng) {
      params.append('alighting_lat', alightingLat);
      params.append('alighting_lng', alightingLng);
      if (alightingLabelAuto) params.append('alighting_label_auto', alightingLabelAuto);
      if (alightingLabelUser) params.append('alighting_label_user', alightingLabelUser);
    }

    router.push(`/book/${tripId}/confirm?${params.toString()}`);
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
  const canContinue = selectedSeats.length > 0 && !busy;

  return (
    <main className="seat-map-page">
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

      <section className="sm-title-block">
        <h1 className="sm-title">Pick your seat</h1>
        <div className="sm-legend">
          <span className="sm-legend-item"><span className="sm-swatch sw-available"></span>Available</span>
          <span className="sm-legend-item"><span className="sm-swatch sw-selected"></span>Selected</span>
          <span className="sm-legend-item"><span className="sm-swatch sw-booked"></span>Booked</span>
          <span className="sm-legend-item"><span className="sm-swatch sw-conductor"></span>Conductor</span>
        </div>
      </section>

      {/* Multi-mode toggle */}
      <div className="sm-multi-toggle">
        <label className="sm-multi-label">
          <input
            type="checkbox"
            checked={multiMode}
            onChange={(e) => handleToggleMulti(e.target.checked)}
            disabled={busy}
          />
          <span className="sm-toggle-switch"></span>
          <span className="sm-toggle-text">
            <strong>Book for me + 1 other</strong>
            <span className="sm-toggle-hint">
              {multiMode ? 'Pick 2 seats. You\'ll enter details for both on the next screen.' : 'Turn on to pick two seats and add a second passenger.'}
            </span>
          </span>
        </label>
      </div>

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
                        <Seat key={seat.id} seat={seat} selectedSeats={selectedSeats} onClick={() => selectSeat(seat)} />
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
                      <Seat key={seat.id} seat={seat} selectedSeats={selectedSeats} onClick={() => selectSeat(seat)} />
                    ))
                  ) : (
                    <>
                      {['A', 'B'].map(col => {
                        const seat = rowSeats.find(s => s.col === col);
                        return seat ? (
                          <Seat key={`${rowNum}${col}`} seat={seat} selectedSeats={selectedSeats} onClick={() => selectSeat(seat)} />
                        ) : (
                          <div key={`${rowNum}${col}-gap`} className="sm-seat-gap" title="Mid-door"></div>
                        );
                      })}
                      <div className="sm-aisle"></div>
                      {['C', 'D'].map(col => {
                        const seat = rowSeats.find(s => s.col === col);
                        return seat ? (
                          <Seat key={`${rowNum}${col}`} seat={seat} selectedSeats={selectedSeats} onClick={() => selectSeat(seat)} />
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

      {/* Summary */}
      <section className="sm-summary">
        {selectedSeats.length === 0 ? (
          <div className="sm-summary-empty">
            {multiMode ? 'Tap 2 seats above to begin' : 'Tap a seat above to begin'}
          </div>
        ) : (
          <div className="sm-summary-active">
            <div className="sm-summary-row">
              <div>
                <div className="sm-summary-label">
                  {selectedSeats.length === 1 ? 'Selected' : `${selectedSeats.length} seats selected`}
                </div>
                <div className="sm-summary-seat">
                  {selectedSeats.map(s => `Seat ${s}`).join(' + ')}
                </div>
              </div>
              <div className="sm-hold-timer">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                Held {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
              </div>
            </div>

            <div className="sm-summary-actions">
              <button onClick={releaseAllSelected} className="sm-btn-cancel" disabled={busy}>
                Clear
              </button>
              <button onClick={continueToConfirm} className="sm-btn-confirm" disabled={!canContinue}>
                {multiMode && selectedSeats.length < 2
                  ? `Continue with 1 seat →`
                  : selectedSeats.length === 2
                    ? 'Continue with 2 seats →'
                    : 'Confirm seat →'}
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

// ============ SEAT BUTTON ============
function Seat({ seat, selectedSeats, onClick }) {
  const isSelected = selectedSeats.includes(seat.id);
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