'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import './my-bookings.css';

export default function MyBookingsPage() {
  const [phone, setPhone] = useState('');
  const [reference, setReference] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [filter, setFilter] = useState('upcoming'); // 'upcoming' | 'all'

  async function handleLookup(e) {
    e.preventDefault();
    if (!phone.trim() || !reference.trim()) return;

    setLoading(true);
    setError(null);

    const { data, error: rpcError } = await supabase.rpc('get_my_bookings', {
      p_phone: phone.trim(),
      p_reference: reference.trim()
    });

    setLoading(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    if (data?.error === 'invalid_phone') {
      setError('Phone number format looks wrong. Use digits only, e.g. 0712345678.');
      return;
    }

    if (data?.error === 'no_match') {
      setError("We couldn't find a booking matching that phone and reference. Double-check both.");
      return;
    }

    setResult(data);
  }

  function handleSignOut() {
    setResult(null);
    setPhone('');
    setReference('');
    setError(null);
  }

  // Locked state — show lookup form
  if (!result) {
    return (
      <main className="mb-page">
        <div className="mb-locked">
          <h1 className="mb-title">Find my booking</h1>
          <p className="mb-sub">
            Enter the phone number you booked with and your booking reference.
            You'll find the reference on your boarding pass.
          </p>

          <form className="mb-form" onSubmit={handleLookup}>
            <div className="mb-field">
              <label className="mb-label" htmlFor="mb-phone">Phone number</label>
              <input
                id="mb-phone"
                type="tel"
                className="mb-input"
                placeholder="07XX XXX XXX or +254 7XX XXX XXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                inputMode="tel"
                required
              />
            </div>

            <div className="mb-field">
              <label className="mb-label" htmlFor="mb-ref">Booking reference</label>
              <input
                id="mb-ref"
                type="text"
                className="mb-input mb-input-ref"
                placeholder="ABC12345"
                value={reference}
                onChange={(e) => setReference(e.target.value.toUpperCase())}
                maxLength={12}
                required
              />
              <span className="mb-hint">8 characters · case-insensitive</span>
            </div>

            {error && <div className="mb-error">{error}</div>}

            <button type="submit" className="mb-submit" disabled={loading}>
              {loading ? 'Looking up…' : 'Find my booking'}
            </button>
          </form>

          <div className="mb-help">
            <p>Lost your reference? Look on the boarding pass you received — it's the 8-character code under the QR. Or contact dispatch.</p>
          </div>
        </div>
      </main>
    );
  }

  // Unlocked — list view
  const { bookings, phone: displayPhone } = result;

  const now = new Date();
  const upcoming = bookings.filter(b => {
    if (b.status !== 'confirmed' && b.status !== 'boarded') return false;
    return new Date(b.trip.departure_at) > new Date(now.getTime() - 1000 * 60 * 60); // within last hour counts as "upcoming"
  });
  const past = bookings.filter(b => !upcoming.includes(b));

  const visible = filter === 'upcoming' ? upcoming : bookings;

  return (
    <main className="mb-page">
      <div className="mb-unlocked">
        <div className="mb-header">
          <h1 className="mb-title">My bookings</h1>
          <button className="mb-signout" onClick={handleSignOut}>Sign out</button>
        </div>
        <p className="mb-sub mb-sub-tight">Showing bookings for {displayPhone}</p>

        <div className="mb-filter">
          <button
            className={`mb-filter-btn ${filter === 'upcoming' ? 'mb-filter-active' : ''}`}
            onClick={() => setFilter('upcoming')}
          >
            Upcoming ({upcoming.length})
          </button>
          <button
            className={`mb-filter-btn ${filter === 'all' ? 'mb-filter-active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({bookings.length})
          </button>
        </div>

        {visible.length === 0 ? (
          <div className="mb-empty">
            <p>
              {filter === 'upcoming'
                ? "You don't have any upcoming bookings."
                : "No bookings found."}
            </p>
            <Link href="/" className="mb-book-cta">Book a ride →</Link>
          </div>
        ) : (
          <div className="mb-list">
            {visible.map(booking => (
              <BookingRow key={booking.id} booking={booking} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function BookingRow({ booking }) {
  const dep = new Date(booking.trip.departure_at);
  const now = new Date();
  const minutesUntil = Math.round((dep - now) / 60000);

  const timeStr = dep.toLocaleString('en-KE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  // Status badge
  let statusLabel, statusClass;
  if (booking.status === 'cancelled') {
    statusLabel = 'Cancelled';
    statusClass = 'mb-status-cancelled';
  } else if (booking.status === 'no_show') {
    statusLabel = 'No-show';
    statusClass = 'mb-status-noshow';
  } else if (booking.status === 'boarded') {
    statusLabel = 'Boarded ✓';
    statusClass = 'mb-status-boarded';
  } else if (booking.trip.status === 'completed') {
    statusLabel = 'Trip completed';
    statusClass = 'mb-status-done';
  } else if (booking.trip.status === 'in_transit') {
    statusLabel = 'In transit';
    statusClass = 'mb-status-transit';
  } else if (minutesUntil < 0) {
    statusLabel = 'Departed';
    statusClass = 'mb-status-done';
  } else if (minutesUntil < 60) {
    statusLabel = `in ${minutesUntil} min`;
    statusClass = 'mb-status-soon';
  } else {
    statusLabel = 'Upcoming';
    statusClass = 'mb-status-upcoming';
  }

  const isTrackable = ['confirmed', 'boarded'].includes(booking.status)
    && booking.trip.status === 'in_transit';

  return (
    <div className={`mb-row ${booking.status === 'cancelled' ? 'mb-row-cancelled' : ''}`}>
      <div className="mb-row-main">
        <div className="mb-row-route">
          <div className="mb-row-code">Route {booking.trip.route_code}</div>
          <div className="mb-row-name">{booking.trip.route_name}</div>
        </div>

        <div className={`mb-row-status ${statusClass}`}>{statusLabel}</div>
      </div>

      <div className="mb-row-meta">
        <span><strong>Seat {booking.seat_id}</strong></span>
        <span>·</span>
        <span>{timeStr}</span>
      </div>

      <div className="mb-row-bus">
        Bus {booking.trip.bus_fleet_number}
        {booking.trip.bus_nickname && <em> "{booking.trip.bus_nickname}"</em>}
      </div>

      {booking.boarding_label && (
        <div className="mb-row-boarding">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          Boarding at {booking.boarding_label}
        </div>
      )}

      <div className="mb-row-actions">
        <Link href={`/boarding-pass/${booking.id}`} className="mb-action-primary">
          View boarding pass
        </Link>
        {isTrackable && (
          <Link href={`/track/${booking.id}`} className="mb-action-secondary">
            Track bus
          </Link>
        )}
      </div>

      <div className="mb-row-ref">Ref: <code>{booking.reference}</code></div>
    </div>
  );
}