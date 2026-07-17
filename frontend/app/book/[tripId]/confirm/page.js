'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { getSessionToken } from '@/lib/auth/session';
import './confirm.css';

function getSessionId() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('wabebe_session_id');
}

function formatPhoneKE(phone) {
  if (!phone) return '';
  const p = phone.startsWith('+254') ? '0' + phone.slice(4) : phone;
  if (p.startsWith('0') && p.length === 10) {
    return `${p.slice(0, 4)} ${p.slice(4, 7)} ${p.slice(7)}`;
  }
  return phone;
}

export default function ConfirmPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const tripId = params.tripId;
  // Parse seat param — could be "2A" or "2A,2B"
  const seatIds = (searchParams.get('seat') || '').split(',').filter(Boolean);

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
  const [holdExpiresAt, setHoldExpiresAt] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Passenger forms — one per seat
  // passengers[i] = { name, phone, bookingForSelf }
  const [passengers, setPassengers] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const [anonBookingCount, setAnonBookingCount] = useState(0);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);

  const isSignedIn = !!user;
  const isMulti = seatIds.length > 1;

  // Initialize passenger forms based on seat count
  useEffect(() => {
    if (seatIds.length === 0) return;
    setPassengers(prev => {
      if (prev.length === seatIds.length) return prev;
      return seatIds.map((_, i) => ({
        name: '',
        phone: '',
        // First passenger books for self by default (if signed in)
        bookingForSelf: i === 0 && isSignedIn
      }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seatIds.length, isSignedIn]);

  // Load trip + verify holds
  useEffect(() => {
    if (!tripId || seatIds.length === 0) {
      setError('Missing seat or trip');
      setLoading(false);
      return;
    }

    async function loadEverything() {
      const { data: tripData, error: tripError } = await supabase
        .from('trips')
        .select(`
          id, departure_at, status,
          buses (fleet_number, nickname),
          routes (code, name)
        `)
        .eq('id', tripId)
        .maybeSingle();

      if (tripError || !tripData) {
        setError('Trip not found');
        setLoading(false);
        return;
      }
      setTrip(tripData);

      // Verify holds for ALL seats
      const sessionId = getSessionId();
      const { data: holds } = await supabase
        .from('seat_holds')
        .select('seat_id, expires_at')
        .eq('trip_id', tripId)
        .eq('session_id', sessionId)
        .in('seat_id', seatIds)
        .gt('expires_at', new Date().toISOString());

      if (!holds || holds.length !== seatIds.length) {
        setError('Your seat hold has expired. Please pick the seat again.');
        setLoading(false);
        return;
      }

      // Use the earliest-expiring hold for the countdown
      const earliestExpiry = Math.min(...holds.map(h => new Date(h.expires_at).getTime()));
      setHoldExpiresAt(earliestExpiry);
      setLoading(false);
    }

    loadEverything();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  // Countdown ticker
  useEffect(() => {
    if (!holdExpiresAt) return;
    function tick() {
      const remaining = Math.max(0, Math.floor((holdExpiresAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) {
        setError('Your seat hold has expired. Please pick the seat again.');
      }
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [holdExpiresAt]);

  // Pre-fill first passenger from signed-in user (when bookingForSelf is true)
  useEffect(() => {
    if (!isSignedIn) return;
    if (passengers.length === 0) return;

    const first = passengers[0];
    if (first.bookingForSelf) {
      if (first.name !== (user.full_name || '') || first.phone !== (user.phone || '')) {
        setPassengers(prev => prev.map((p, i) =>
          i === 0 ? { ...p, name: user.full_name || '', phone: user.phone || '' } : p
        ));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, user?.full_name, user?.phone, passengers[0]?.bookingForSelf]);

  // Anon nudge — only fires for anon users on the FIRST passenger's phone
  useEffect(() => {
    if (isSignedIn) return;
    if (nudgeDismissed) return;
    if (passengers.length === 0) return;

    const phone = passengers[0]?.phone || '';
    const cleaned = phone.trim().replace(/\s/g, '');
    if (!/^\+?[0-9]{9,13}$/.test(cleaned)) {
      setAnonBookingCount(0);
      return;
    }

    let cancelled = false;
    const timeout = setTimeout(async () => {
      const { data, error } = await supabase.rpc('get_booking_count_by_phone', {
        p_phone: cleaned
      });
      if (!cancelled && !error && typeof data === 'number') {
        setAnonBookingCount(data);
      }
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [isSignedIn, nudgeDismissed, passengers[0]?.phone]);

  function updatePassenger(idx, field, value) {
    setPassengers(prev => prev.map((p, i) =>
      i === idx ? { ...p, [field]: value } : p
    ));
  }

  function toggleBookingForSelf(idx) {
    setPassengers(prev => prev.map((p, i) => {
      if (i !== idx) return p;
      const nextForSelf = !p.bookingForSelf;
      // Clear fields if turning "for someone else" on
      return {
        ...p,
        bookingForSelf: nextForSelf,
        name: nextForSelf ? (user?.full_name || '') : '',
        phone: nextForSelf ? (user?.phone || '') : ''
      };
    }));
  }

  async function submit(e) {
  e.preventDefault();
  setFormError(null);

  // Validate all passengers
  for (let i = 0; i < passengers.length; i++) {
    const p = passengers[i];
    if (!p.name.trim() || p.name.trim().length < 2) {
      setFormError(`Passenger ${i + 1}: please enter a full name`);
      return;
    }

    // Passenger 1 (or single-seat) always needs a phone
    // Passenger 2 can leave phone blank — we'll use passenger 1's phone
    const phoneRequired = i === 0 || !isMulti;

    if (phoneRequired && !p.phone.trim()) {
      setFormError(`Passenger ${i + 1}: please enter a phone number`);
      return;
    }

    if (p.phone.trim()) {
      const cleaned = p.phone.trim().replace(/\s/g, '');
      if (!/^\+?[0-9]{9,13}$/.test(cleaned)) {
        setFormError(`Passenger ${i + 1}: phone number looks wrong. Use 0712345678 or +254712345678`);
        return;
      }
    }
  }

    setSubmitting(true);

    // Build the batch payload
    const primaryPhone = passengers[0].phone.trim().replace(/\s/g, '');
    const batchPayload = passengers.map((p, i) => {
      const phoneEntered = p.phone.trim().replace(/\s/g, '');
      const usesPrimaryPhone = !phoneEntered && i > 0;

      return {
        seat_id: seatIds[i],
        passenger_name: p.name.trim(),
        passenger_phone: usesPrimaryPhone ? primaryPhone : phoneEntered,
        // If passenger 2 shares primary phone, override the users.full_name display
        passenger_name_override: usesPrimaryPhone ? p.name.trim() : null
      };
    });

    const { data, error: bookingError } = await supabase.rpc('create_bookings_batch', {
      p_trip_id: tripId,
      p_session_id: getSessionId(),
      p_passengers: batchPayload,
      p_boarding_stop_id: boardingStopId || null,
      p_alighting_stop_id: alightingStopId || null,
      p_boarding_lat: boardingLat ? parseFloat(boardingLat) : null,
      p_boarding_lng: boardingLng ? parseFloat(boardingLng) : null,
      p_boarding_label_user: boardingLabelUser || null,
      p_boarding_label_auto: boardingLabelAuto || null,
      p_alighting_lat: alightingLat ? parseFloat(alightingLat) : null,
      p_alighting_lng: alightingLng ? parseFloat(alightingLng) : null,
      p_alighting_label_user: alightingLabelUser || null,
      p_alighting_label_auto: alightingLabelAuto || null,
      p_booked_by_token: getSessionToken() || null
    });

    if (bookingError) {
      setFormError(bookingError.message || 'Could not complete booking. Please try again.');
      setSubmitting(false);
      return;
    }
    if (!data?.ok) {
      setFormError('Booking failed unexpectedly. Please try again.');
      setSubmitting(false);
      return;
    }

    // Fire booking confirmation SMS (fire-and-forget — we redirect regardless)
    const bookingIds = data.bookings.map(b => b.id);
    fetch('/api/sms/send-booking-confirmation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_ids: bookingIds })
    }).catch(err => console.error('SMS send failed:', err));

    // Multi-booking → land on my-bookings (per session 9 decision)
    // Single-booking → land on boarding pass (preserves existing flow)
    if (data.count === 1) {
      const bookingId = data.bookings[0].id;
      router.push(`/boarding-pass/${bookingId}`);
    } else {
      router.push('/my-bookings');
    }
  }

  // ===== Render =====

  if (loading) {
    return <main className="confirm-page"><div className="cf-loading">Checking your holds…</div></main>;
  }

  if (error) {
    return (
      <main className="confirm-page">
        <div className="cf-error">
          <h1>Something's not right</h1>
          <p>{error}</p>
          <Link href={`/book/${tripId}`} className="cf-back-btn">← Pick a seat again</Link>
        </div>
      </main>
    );
  }

  const dep = new Date(trip.departure_at);
  const timeStr = dep.toLocaleTimeString('en-KE', { hour: 'numeric', minute: '2-digit', hour12: true });
  const dateStr = dep.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' });

  const showAnonNudge = !isSignedIn && anonBookingCount >= 5 && !nudgeDismissed;

  return (
    <main className="confirm-page">
      <div className="cf-inner">

        <div className="cf-head">
          <Link href={`/book/${tripId}`} className="cf-back">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back to seat map
          </Link>
          <div className="cf-step">Step 2 of 2</div>
        </div>

        <h1 className="cf-title">
          {isMulti ? 'Almost there · 2 tickets' : 'Almost there.'}
        </h1>
        <p className="cf-subtitle">
          {isMulti
            ? 'Enter each passenger\'s name and phone. Both boarding passes are sent right after you confirm.'
            : 'We need a name and phone so the conductor can find you and send the boarding pass.'}
        </p>

        {/* Trip summary */}
        <div className="cf-summary">
          <div className="cf-summary-head">
            <div>
              <div className="cf-summary-label">Your trip</div>
              <div className="cf-summary-route">
                Route {trip.routes.code} · {trip.routes.name}
              </div>
            </div>
            <div className="cf-hold-timer">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
            </div>
          </div>

          <div className="cf-summary-grid">
            <div className="cf-summary-item">
              <div className="cf-summary-key">When</div>
              <div className="cf-summary-val">{dateStr}, {timeStr}</div>
            </div>
            <div className="cf-summary-item">
              <div className="cf-summary-key">Bus</div>
              <div className="cf-summary-val">
                {trip.buses.fleet_number}
                {trip.buses.nickname && <span className="cf-nickname"> "{trip.buses.nickname}"</span>}
              </div>
            </div>
            <div className="cf-summary-item cf-summary-seat">
              <div className="cf-summary-key">Seats</div>
              <div className="cf-summary-val-seat">
                {seatIds.join(' + ')}
              </div>
            </div>
          </div>
        </div>

        {/* Anon nudge (only for first passenger's phone) */}
        {showAnonNudge && (
          <div className="cf-nudge">
            <div className="cf-nudge-head">
              <div className="cf-nudge-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              </div>
              <div className="cf-nudge-title">
                You've booked with Wabebe <strong>{anonBookingCount}</strong> times.
              </div>
              <button
                type="button"
                className="cf-nudge-close"
                onClick={() => setNudgeDismissed(true)}
                aria-label="Dismiss"
              >×</button>
            </div>
            <p className="cf-nudge-body">
              An account would save your details, keep your bookings in one place, and set you up for loyalty rewards when they launch.
            </p>
            <div className="cf-nudge-actions">
              <Link href={`/signin?phone=${encodeURIComponent(passengers[0]?.phone || '')}`} className="cf-nudge-cta">
                Set up my account →
              </Link>
              <button
                type="button"
                className="cf-nudge-later"
                onClick={() => setNudgeDismissed(true)}
              >
                Maybe later
              </button>
            </div>
          </div>
        )}

        {/* Passenger forms */}
        <form className="cf-form" onSubmit={submit}>
          {passengers.map((passenger, idx) => (
            <PassengerForm
              key={idx}
              idx={idx}
              seatId={seatIds[idx]}
              passenger={passenger}
              isSignedIn={isSignedIn}
              isMulti={isMulti}
              user={user}
              onUpdate={(field, value) => updatePassenger(idx, field, value)}
              onToggleSelf={() => toggleBookingForSelf(idx)}
              disabled={submitting}
            />
          ))}

          {formError && <div className="cf-form-error">{formError}</div>}

          <button type="submit" className="cf-confirm-btn" disabled={submitting || secondsLeft === 0}>
            {submitting
              ? 'Confirming…'
              : isMulti
                ? 'Confirm both bookings →'
                : 'Confirm booking →'}
          </button>

          <div className="cf-policy">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            By booking, {isMulti ? 'each passenger' : 'you'} agree{isMulti ? '' : 's'} to arrive within 2 minutes of departure. No-shows lead to a temporary booking suspension.
          </div>
        </form>
      </div>
    </main>
  );
}

// ============ SINGLE PASSENGER FORM ============
function PassengerForm({ idx, seatId, passenger, isSignedIn, isMulti, user, onUpdate, onToggleSelf, disabled }) {
  const showToggle = isSignedIn && idx === 0 && !isMulti; // toggle only for single-seat signed-in flow
  const showSecondPassengerHeader = isMulti && idx === 1;
  const showFirstPassengerHeader = isMulti && idx === 0;
  const lockedFromAccount = isSignedIn && idx === 0 && passenger.bookingForSelf;

  return (
    <div className={`cf-passenger ${isMulti ? 'cf-passenger-multi' : ''}`}>
      {isMulti && (
        <div className="cf-passenger-header">
          <div className="cf-passenger-seat">Seat {seatId}</div>
          <div className="cf-passenger-label">
            {showFirstPassengerHeader
              ? (isSignedIn ? `Passenger 1 · You` : 'Passenger 1')
              : 'Passenger 2'}
          </div>
        </div>
      )}

      {/* Signed-in badge (single-seat mode only) */}
      {isSignedIn && !isMulti && (
        <div className={`cf-signed-badge ${passenger.bookingForSelf ? 'cf-badge-self' : 'cf-badge-other'}`}>
          <div className="cf-badge-icon">
            {passenger.bookingForSelf ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            )}
          </div>
          <div className="cf-badge-text">
            {passenger.bookingForSelf ? (
              user.full_name ? (
                <>Booking as <strong>{user.full_name}</strong></>
              ) : (
                <>Booking with your account · <strong>{formatPhoneKE(user.phone)}</strong></>
              )
            ) : (
              <>Booking for someone else</>
            )}
          </div>
        </div>
      )}

      <div className="cf-field">
        <label htmlFor={`name-${idx}`} className="cf-label">Full name</label>
        <input
          id={`name-${idx}`}
          type="text"
          value={passenger.name}
          onChange={(e) => onUpdate('name', e.target.value)}
          placeholder={idx === 1 ? "Your mom, friend, etc." : "Your name"}
          autoComplete={idx === 0 ? 'name' : 'off'}
          disabled={disabled || (lockedFromAccount && !!user?.full_name)}
        />
        {lockedFromAccount && user?.full_name && (
          <div className="cf-hint cf-hint-locked">From your account</div>
        )}
        {lockedFromAccount && !user?.full_name && (
          <div className="cf-hint">
            We don't have a name saved for you yet. Enter it once here.
          </div>
        )}
      </div>

      <div className="cf-field">
        <label htmlFor={`phone-${idx}`} className="cf-label">
          Phone number
          {isMulti && idx === 1 && (
            <span className="cf-optional-tag"> · optional</span>
          )}
        </label>
        <input
          id={`phone-${idx}`}
          type="tel"
          value={passenger.phone}
          onChange={(e) => onUpdate('phone', e.target.value)}
          placeholder={isMulti && idx === 1 ? "Leave blank if they don't have one" : "0712 345 678"}
          autoComplete={idx === 0 ? 'tel' : 'off'}
          inputMode="tel"
          disabled={disabled || lockedFromAccount}
        />
        <div className="cf-hint">
          {lockedFromAccount
            ? 'From your account · boarding pass goes here'
            : idx === 1
              ? (passenger.phone.trim()
                ? "This passenger's boarding pass goes here"
                : "No phone — you'll get both boarding pass links on your number")
              : "We'll send the boarding pass here"}
        </div>

        {isMulti && idx === 1 && !passenger.phone.trim() && passenger.name.trim() && (
          <div className="cf-passenger2-warn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>
              <strong>{passenger.name.trim()}</strong> won't get SMS or a boarding pass link.
              Save both boarding passes from your account and share theirs manually.
            </span>
          </div>
        )}
      </div>

      {showToggle && (
        <label className="cf-toggle">
          <input
            type="checkbox"
            checked={!passenger.bookingForSelf}
            onChange={onToggleSelf}
            disabled={disabled}
          />
          <span className="cf-toggle-switch"></span>
          <span className="cf-toggle-label">
            Book for someone else
            <span className="cf-toggle-hint">Their number gets the boarding pass, not yours.</span>
          </span>
        </label>
      )}
    </div>
  );
}