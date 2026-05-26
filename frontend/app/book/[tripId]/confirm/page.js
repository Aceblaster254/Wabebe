'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import './confirm.css';

function getSessionId() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('wabebe_session_id');
}

export default function ConfirmPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const tripId = params.tripId;
  const seatId = searchParams.get('seat');

  const [trip, setTrip] = useState(null);
  const [holdExpiresAt, setHoldExpiresAt] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // Load trip details and verify the hold
  useEffect(() => {
    if (!tripId || !seatId) {
      setError('Missing seat or trip');
      setLoading(false);
      return;
    }

    async function loadEverything() {
      // Fetch trip + bus + route
      const { data: tripData, error: tripError } = await supabase
        .from('trips')
        .select(`
          id,
          departure_at,
          status,
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

      // Find the hold for this session
      const sessionId = getSessionId();
      const { data: hold } = await supabase
        .from('seat_holds')
        .select('expires_at')
        .eq('trip_id', tripId)
        .eq('seat_id', seatId)
        .eq('session_id', sessionId)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (!hold) {
        setError('Your seat hold has expired. Please pick the seat again.');
        setLoading(false);
        return;
      }

      setHoldExpiresAt(new Date(hold.expires_at).getTime());
      setLoading(false);
    }

    loadEverything();
  }, [tripId, seatId]);

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

  async function submit(e) {
    e.preventDefault();
    setFormError(null);

    // Basic validation
    if (!name.trim() || name.trim().length < 2) {
      setFormError('Please enter your full name');
      return;
    }
    if (!phone.trim()) {
      setFormError('Please enter your phone number');
      return;
    }
    // Allow 9-13 digits with optional + prefix
    const cleaned = phone.trim().replace(/\s/g, '');
    if (!/^\+?[0-9]{9,13}$/.test(cleaned)) {
      setFormError('Phone number looks wrong. Use 0712345678 or +254712345678');
      return;
    }

    setSubmitting(true);

    const { data, error: bookingError } = await supabase.rpc(
      'create_booking_with_passenger',
      {
        p_trip_id: tripId,
        p_seat_id: seatId,
        p_session_id: getSessionId(),
        p_passenger_name: name.trim(),
        p_passenger_phone: cleaned
      }
    );

    if (bookingError) {
      setFormError(bookingError.message || 'Could not complete booking. Please try again.');
      setSubmitting(false);
      return;
    }

    if (!data) {
      setFormError('Booking failed unexpectedly. Please try again.');
      setSubmitting(false);
      return;
    }

    // Success — route to the boarding pass
    router.push(`/boarding-pass/${data.id}`);
  }

  // ===== Render =====

  if (loading) {
    return (
      <main className="confirm-page">
        <div className="cf-loading">Checking your hold…</div>
      </main>
    );
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

  return (
    <main className="confirm-page">
      <div className="cf-inner">

        {/* Header */}
        <div className="cf-head">
          <Link href={`/book/${tripId}`} className="cf-back">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back to seat map
          </Link>

          <div className="cf-step">Step 2 of 2</div>
        </div>

        <h1 className="cf-title">Almost there.</h1>
        <p className="cf-subtitle">
          We need your name and phone so the conductor can find you and send your boarding pass.
        </p>

        {/* Booking summary card */}
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
              <div className="cf-summary-key">Seat</div>
              <div className="cf-summary-val-seat">{seatId}</div>
            </div>
          </div>
        </div>

        {/* Form */}
        <form className="cf-form" onSubmit={submit}>
          <div className="cf-field">
            <label htmlFor="name" className="cf-label">Full name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Liam Mwangi"
              autoComplete="name"
              disabled={submitting}
            />
          </div>

          <div className="cf-field">
            <label htmlFor="phone" className="cf-label">Phone number</label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0712 345 678"
              autoComplete="tel"
              inputMode="tel"
              disabled={submitting}
            />
            <div className="cf-hint">We'll send your boarding pass here</div>
          </div>

          {formError && (
            <div className="cf-form-error">{formError}</div>
          )}

          <button type="submit" className="cf-confirm-btn" disabled={submitting || secondsLeft === 0}>
            {submitting ? 'Confirming…' : 'Confirm booking →'}
          </button>

          <div className="cf-policy">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            By booking, you agree to arrive within 2 minutes of departure. No-shows lead to a temporary booking suspension.
          </div>
        </form>
      </div>
    </main>
  );
}