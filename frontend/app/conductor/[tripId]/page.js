'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useGPSBroadcaster } from '@/hooks/useGPSBroadcaster';
import { useParams, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import './conductor.css';

export default function ConductorPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const tripId = params.tripId;
  const token = searchParams.get('token');

  const [view, setView] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionBooking, setActionBooking] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  const loadView = useCallback(async () => {
    if (!tripId || !token) {
      setError('Missing token');
      setLoading(false);
      return;
    }

    const { data, error: rpcError } = await supabase.rpc('get_conductor_trip_view', {
      p_trip_id: tripId,
      p_token: token
    });

    if (rpcError) {
      setError(rpcError.message);
      setLoading(false);
      return;
    }

    if (data?.error === 'invalid_token') {
      setError('Invalid or expired access link');
      setLoading(false);
      return;
    }

    setView(data);
    setLoading(false);
  }, [tripId, token]);

  useEffect(() => {
    loadView();

    if (!tripId || !token) return;

    const channel = supabase
      .channel(`conductor-${tripId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'bookings', filter: `trip_id=eq.${tripId}` },
        () => loadView()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'trips', filter: `id=eq.${tripId}` },
        () => loadView()
      )
      .subscribe();

    const interval = setInterval(loadView, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [tripId, token, loadView]);

  async function handleStartTrip() {
    setBusy(true);
    const { error } = await supabase.rpc('start_trip', { p_trip_id: tripId, p_token: token });
    if (error) alert(`Could not start: ${error.message}`);
    await loadView();
    setBusy(false);
    setConfirmAction(null);
  }

  async function handleCompleteTrip() {
    setBusy(true);
    const { error } = await supabase.rpc('complete_trip', { p_trip_id: tripId, p_token: token });
    if (error) alert(`Could not complete: ${error.message}`);
    await loadView();
    setBusy(false);
    setConfirmAction(null);
  }

  async function handleBoard(booking) {
    setBusy(true);
    const { error } = await supabase.rpc('conductor_mark_boarded', {
      p_trip_id: tripId,
      p_booking_id: booking.id,
      p_token: token
    });
    if (error) alert(`Could not mark boarded: ${error.message}`);
    await loadView();
    setBusy(false);
    setActionBooking(null);
  }

  async function handleNoShow(booking, forceEarly = false) {
    setBusy(true);
    const { data, error } = await supabase.rpc('conductor_mark_no_show', {
      p_trip_id: tripId,
      p_booking_id: booking.id,
      p_token: token,
      p_force_early: forceEarly
    });

    if (error) {
      alert(`Could not mark no-show: ${error.message}`);
    } else if (data?.success === false && data?.reason === 'too_early') {
      const secs = data.seconds_remaining;
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      alert(`Too early. ${m}:${String(s).padStart(2,'0')} of the waiting window remaining.`);
    }

    await loadView();
    setBusy(false);
    setConfirmAction(null);
    setActionBooking(null);
  }

  

  // GPS broadcasting — active only when trip is in_transit
  const tripInTransit = view?.trip?.status === 'in_transit';
  const gps = useGPSBroadcaster({
    tripId,
    token,
    active: tripInTransit
  });

  if (loading) {
    return <main className="cd-page"><div className="cd-center">Loading conductor view…</div></main>;
  }

  if (error) {
    return (
      <main className="cd-page">
        <div className="cd-error">
          <h1>Access denied</h1>
          <p>{error}</p>
          <p className="cd-error-hint">Ask dispatch to send a fresh link.</p>
        </div>
      </main>
    );
  }

  const { trip, layout, bookings, stops } = view;
  const isScheduled = trip.status === 'scheduled';
  const isInTransit = trip.status === 'in_transit';
  const isCompleted = trip.status === 'completed';

  const confirmedBookings = bookings.filter(b => b.status === 'confirmed');
  const boardedCount = bookings.filter(b => b.status === 'boarded').length;
  const noShowCount = bookings.filter(b => b.status === 'no_show').length;
  const totalSold = bookings.filter(b => b.status !== 'cancelled').length;

  const dep = new Date(trip.departure_at);
  const timeStr = dep.toLocaleTimeString('en-KE', { hour: 'numeric', minute: '2-digit', hour12: true });

  const atOrigin = trip.current_stop_id === trip.origin_stop_id;
  const windowSeconds = isScheduled || atOrigin ? 300 : 120;
  let secondsAtStop = 0;
  if (trip.current_stop_arrived_at) {
    secondsAtStop = Math.floor((Date.now() - new Date(trip.current_stop_arrived_at).getTime()) / 1000);
  } else if (isScheduled) {
    secondsAtStop = Math.floor((Date.now() - dep.getTime()) / 1000);
  }
  const canMarkNoShow = secondsAtStop >= windowSeconds;
  const noShowAvailableInSeconds = Math.max(0, windowSeconds - secondsAtStop);

  const seatLookup = {};
  for (const layoutSeat of (layout || [])) {
    const bookingsOnSeat = bookings.filter(b => b.seat_id === layoutSeat.id);
    const activeBooking =
      bookingsOnSeat.find(b => b.status === 'confirmed') ||
      bookingsOnSeat.find(b => b.status === 'boarded') ||
      bookingsOnSeat.find(b => b.status === 'no_show') ||
      bookingsOnSeat[0] || null;
    seatLookup[layoutSeat.id] = { ...layoutSeat, booking: activeBooking };
  }

  const rows = {};
  for (const seat of Object.values(seatLookup)) {
    if (!rows[seat.row]) rows[seat.row] = [];
    rows[seat.row].push(seat);
  }
  const rowNumbers = Object.keys(rows).map(Number).sort((a,b)=>a-b);

  return (
    <main className="cd-page">
      <div className="cd-inner">

        <div className="cd-header">
          <div className="cd-route">
            <div className="cd-route-num">Route {trip.route_code}</div>
            <div className="cd-route-name">{trip.route_name}</div>
          </div>
          <div className={`cd-status cd-status-${trip.status}`}>
            {trip.status === 'scheduled' && 'Not started'}
            {trip.status === 'in_transit' && 'In transit'}
            {trip.status === 'completed' && 'Completed'}
            {trip.status === 'cancelled' && 'Cancelled'}
          </div>
        </div>

        <div className="cd-meta">
          <div className="cd-meta-item">
            <span className="cd-meta-key">Bus</span>
            <span className="cd-meta-val">
              {trip.bus_fleet_number}
              {trip.bus_nickname && <em> "{trip.bus_nickname}"</em>}
            </span>
          </div>
          <div className="cd-meta-item">
            <span className="cd-meta-key">Departs</span>
            <span className="cd-meta-val">{timeStr}</span>
          </div>
        </div>

        {tripInTransit && <GPSStatus gps={gps} />}

        {tripInTransit && trip.current_stop_name && (
          <div className="cd-current-stop">
            <div className="cd-current-stop-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
            <div className="cd-current-stop-text">
              At <strong>{trip.current_stop_name}</strong>
              {trip.current_stop_arrived_at && (
                <span className="cd-current-stop-time">
                  · {Math.floor(secondsAtStop/60)}:{String(secondsAtStop%60).padStart(2,'0')}
                </span>
              )}
            </div>
          </div>
        )}

        <div className="cd-controls">
          {isScheduled && (
            <button
              className="cd-btn-primary"
              onClick={() => setConfirmAction({ type: 'start' })}
              disabled={busy}
            >
              Start trip
            </button>
          )}
          {isInTransit && (
            <button
              className="cd-btn-danger"
              onClick={() => setConfirmAction({ type: 'complete' })}
              disabled={busy}
            >
              Complete trip
            </button>
          )}
          {isCompleted && (
            <div className="cd-completed-note">Trip completed. Token expires soon.</div>
          )}
        </div>

        <div className="cd-stats">
          <div className="cd-stat">
            <div className="cd-stat-num">{totalSold}</div>
            <div className="cd-stat-lbl">Booked</div>
          </div>
          <div className="cd-stat">
            <div className="cd-stat-num">{boardedCount}</div>
            <div className="cd-stat-lbl">Boarded</div>
          </div>
          <div className="cd-stat">
            <div className="cd-stat-num">{confirmedBookings.length}</div>
            <div className="cd-stat-lbl">Pending</div>
          </div>
          <div className="cd-stat">
            <div className="cd-stat-num">{noShowCount}</div>
            <div className="cd-stat-lbl">No-show</div>
          </div>
        </div>

        <div className="cd-section-title">Seat map · tap to act</div>
        <div className="cd-bus">
          <div className="cd-bus-grid">
            {rowNumbers.map(rowNum => {
              const isCockpit = rowNum === 1;
              const isBackRow = rowNumbers.indexOf(rowNum) === rowNumbers.length - 1;
              const rowSeats = rows[rowNum].sort((a,b)=>a.col.localeCompare(b.col));

              return (
                <div
                  key={rowNum}
                  className={`cd-row ${isCockpit?'cd-row-cockpit':''} ${isBackRow?'cd-row-back':''}`}
                >
                  {isCockpit ? (
                    <>
                      {rowSeats.map(seat => (
                        <ConductorSeat key={seat.id} seat={seat} onTap={() => seat.booking && setActionBooking(seat.booking)} />
                      ))}
                      <div className="cd-spacer-wide"></div>
                      <div className="cd-driver">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"/>
                          <line x1="2" y1="12" x2="22" y2="12"/>
                          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                        </svg>
                      </div>
                    </>
                  ) : isBackRow ? (
                    rowSeats.map(seat => (
                      <ConductorSeat key={seat.id} seat={seat} onTap={() => seat.booking && setActionBooking(seat.booking)} />
                    ))
                  ) : (
                    <>
                      {['A','B'].map(col => {
                        const seat = rowSeats.find(s => s.col === col);
                        return seat ? (
                          <ConductorSeat key={seat.id} seat={seat} onTap={() => seat.booking && setActionBooking(seat.booking)} />
                        ) : (
                          <div key={`${rowNum}${col}-gap`} className="cd-seat-gap"></div>
                        );
                      })}
                      <div className="cd-aisle"></div>
                      {['C','D'].map(col => {
                        const seat = rowSeats.find(s => s.col === col);
                        return seat ? (
                          <ConductorSeat key={seat.id} seat={seat} onTap={() => seat.booking && setActionBooking(seat.booking)} />
                        ) : null;
                      })}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="cd-section-title">Passengers ({bookings.filter(b=>b.status!=='cancelled').length})</div>
        <div className="cd-passenger-list">
          {bookings.filter(b => b.status !== 'cancelled').length === 0 && (
            <div className="cd-empty">No bookings yet.</div>
          )}
          {bookings
            .filter(b => b.status !== 'cancelled')
            .sort((a,b) => {
              const order = { confirmed: 0, boarded: 1, no_show: 2 };
              return (order[a.status] ?? 3) - (order[b.status] ?? 3);
            })
            .map(b => (
              <PassengerRow
                key={b.id}
                booking={b}
                onTap={() => b.status === 'confirmed' && setActionBooking(b)}
              />
            ))
          }
        </div>

      </div>

      {actionBooking && (
        <div className="cd-sheet-backdrop" onClick={() => setActionBooking(null)}>
          <div className="cd-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="cd-sheet-handle"></div>

            <div className="cd-sheet-header">
              <div>
                <div className="cd-sheet-seat">Seat {actionBooking.seat_id}</div>
                <div className="cd-sheet-name">{actionBooking.passenger_name}</div>
                <div className="cd-sheet-phone">{actionBooking.passenger_phone}</div>
              </div>
              <div className="cd-sheet-ref">
                <div className="cd-sheet-ref-lbl">Ref</div>
                <div className="cd-sheet-ref-code">{actionBooking.reference}</div>
              </div>
            </div>

            {(actionBooking.boarding_stop_name || actionBooking.boarding_label_user || actionBooking.boarding_label_auto) && (
              <div className="cd-sheet-boarding">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
                <span>Boarding at <strong>{actionBooking.boarding_stop_name || actionBooking.boarding_label_user || actionBooking.boarding_label_auto}</strong></span>
              </div>
            )}

            <div className={`cd-sheet-status cd-sheet-status-${actionBooking.status}`}>
              {actionBooking.status === 'confirmed' && 'Waiting to board'}
              {actionBooking.status === 'boarded' && 'Boarded ✓'}
              {actionBooking.status === 'no_show' && 'Marked no-show'}
            </div>

            {actionBooking.status === 'confirmed' && (
              <div className="cd-sheet-actions">
                <button
                  className="cd-btn-primary cd-btn-large"
                  onClick={() => handleBoard(actionBooking)}
                  disabled={busy}
                >
                  Mark boarded
                </button>

                {canMarkNoShow ? (
                  <button
                    className="cd-btn-secondary cd-btn-noshow"
                    onClick={() => setConfirmAction({ type: 'noshow', booking: actionBooking, forceEarly: false })}
                    disabled={busy}
                  >
                    Mark no-show
                  </button>
                ) : (
                  <button
                    className="cd-btn-secondary cd-btn-noshow"
                    onClick={() => setConfirmAction({ type: 'noshow', booking: actionBooking, forceEarly: true })}
                    disabled={busy}
                  >
                    No-show (early — {Math.floor(noShowAvailableInSeconds/60)}:{String(noShowAvailableInSeconds%60).padStart(2,'0')} left)
                  </button>
                )}
              </div>
            )}

            <button className="cd-sheet-close" onClick={() => setActionBooking(null)}>Cancel</button>
          </div>
        </div>
      )}

      {confirmAction && (
        <div className="cd-modal-backdrop" onClick={() => setConfirmAction(null)}>
          <div className="cd-modal" onClick={(e) => e.stopPropagation()}>
            {confirmAction.type === 'start' && (
              <>
                <h3>Start the trip?</h3>
                <p>Marks the bus as in transit. Live tracking starts. Passengers see "boarding now".</p>
                <div className="cd-modal-actions">
                  <button onClick={() => setConfirmAction(null)} disabled={busy}>Cancel</button>
                  <button className="cd-btn-primary" onClick={handleStartTrip} disabled={busy}>
                    {busy ? 'Starting…' : 'Yes, start'}
                  </button>
                </div>
              </>
            )}

            {confirmAction.type === 'complete' && (
              <>
                <h3>Complete the trip?</h3>
                <p>Marks the trip as done. You won't be able to mark anyone boarded after this.</p>
                <div className="cd-modal-actions">
                  <button onClick={() => setConfirmAction(null)} disabled={busy}>Cancel</button>
                  <button className="cd-btn-danger" onClick={handleCompleteTrip} disabled={busy}>
                    {busy ? 'Completing…' : 'Yes, complete'}
                  </button>
                </div>
              </>
            )}

            {confirmAction.type === 'noshow' && (
              <>
                <h3>Mark {confirmAction.booking.passenger_name} as no-show?</h3>
                {confirmAction.forceEarly ? (
                  <p className="cd-warn">
                    The {windowSeconds === 300 ? '5-minute' : '2-minute'} waiting window hasn't elapsed yet. This passenger will be able to dispute the no-show. No suspension will be applied automatically — admin will review.
                  </p>
                ) : (
                  <p>This will be recorded as a strike. The passenger may be temporarily suspended from booking based on their recent history.</p>
                )}
                <div className="cd-modal-actions">
                  <button onClick={() => setConfirmAction(null)} disabled={busy}>Cancel</button>
                  <button className="cd-btn-danger" onClick={() => handleNoShow(confirmAction.booking, confirmAction.forceEarly)} disabled={busy}>
                    {busy ? 'Marking…' : 'Yes, no-show'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function ConductorSeat({ seat, onTap }) {
  const status = seat.booking?.status || 'empty';
  const isConductor = seat.type === 'conductor';

  let displayClass = 'cd-seat-empty';
  if (isConductor) displayClass = 'cd-seat-conductor';
  else if (status === 'confirmed') displayClass = 'cd-seat-confirmed';
  else if (status === 'boarded') displayClass = 'cd-seat-boarded';
  else if (status === 'no_show') displayClass = 'cd-seat-noshow';

  return (
    <button
      type="button"
      className={`cd-seat ${displayClass}`}
      onClick={onTap}
      disabled={isConductor || !seat.booking}
      title={seat.booking ? `${seat.booking.passenger_name} (${status})` : 'Empty'}
    >
      {isConductor ? 'C' : seat.id}
    </button>
  );
}

function PassengerRow({ booking, onTap }) {
  const isActionable = booking.status === 'confirmed';

  // Resolve boarding label: official stop name, user-typed, or auto-geocoded
  const boardingLabel =
    booking.boarding_stop_name
    || booking.boarding_label_user
    || booking.boarding_label_auto
    || null;

  return (
    <div
      className={`cd-prow cd-prow-${booking.status} ${isActionable ? 'cd-prow-actionable' : ''}`}
      onClick={isActionable ? onTap : undefined}
    >
      <div className="cd-prow-seat">{booking.seat_id}</div>
      <div className="cd-prow-info">
        <div className="cd-prow-name">{booking.passenger_name}</div>
        <div className="cd-prow-phone">{booking.passenger_phone}</div>
        {boardingLabel && (
          <div className="cd-prow-boarding">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            {boardingLabel}
          </div>
        )}
      </div>
      <div className="cd-prow-status">
        {booking.status === 'confirmed' && 'Pending'}
        {booking.status === 'boarded' && '✓ Boarded'}
        {booking.status === 'no_show' && 'No-show'}
        {booking.no_show_disputable && <span className="cd-prow-disputable"> (disputable)</span>}
      </div>
    </div>
  );
}

function GPSStatus({ gps }) {
  const { permission, broadcasting, lastPing, error, isMoving, requestPermission } = gps;

  // First-time: ask for permission
  if (permission === 'prompt' || permission === 'unknown') {
    return (
      <div className="cd-gps cd-gps-prompt">
        <div className="cd-gps-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="2" x2="12" y2="6"/>
            <line x1="12" y1="18" x2="12" y2="22"/>
            <line x1="2" y1="12" x2="6" y2="12"/>
            <line x1="18" y1="12" x2="22" y2="12"/>
          </svg>
        </div>
        <div className="cd-gps-text">
          <strong>Share location with passengers</strong>
          <p>So they can see when the bus is approaching their stop.</p>
        </div>
        <button onClick={requestPermission} className="cd-gps-grant">Allow</button>
      </div>
    );
  }

  // Denied: explain how to fix
  if (permission === 'denied') {
    return (
      <div className="cd-gps cd-gps-denied">
        <div className="cd-gps-icon">⚠</div>
        <div className="cd-gps-text">
          <strong>Location is blocked</strong>
          <p>Open browser site settings and allow location, then refresh.</p>
        </div>
      </div>
    );
  }

  // Granted but not yet broadcasting (waiting for first fix)
  if (!broadcasting && !lastPing) {
    return (
      <div className="cd-gps cd-gps-waiting">
        <div className="cd-gps-dot cd-gps-dot-waiting"></div>
        <div className="cd-gps-text-inline">Waiting for GPS…</div>
      </div>
    );
  }

  // Active broadcasting
  const secsSince = lastPing ? Math.round((Date.now() - lastPing.ts) / 1000) : null;
  const ageText = secsSince === null
    ? '—'
    : secsSince < 60
      ? `${secsSince}s ago`
      : `${Math.round(secsSince / 60)}m ago`;

  return (
    <div className="cd-gps cd-gps-active">
      <div className="cd-gps-dot cd-gps-dot-live"></div>
      <div className="cd-gps-text-inline">
        Broadcasting · <strong>{isMoving ? 'moving' : 'idle'}</strong> · last sent {ageText}
        {lastPing?.accuracy_m && (
          <span className="cd-gps-acc"> · {Math.round(lastPing.accuracy_m)}m accuracy</span>
        )}
      </div>
      {error && <span className="cd-gps-err" title={error}>⚠</span>}
    </div>
  );
}


