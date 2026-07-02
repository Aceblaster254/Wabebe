'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabase';
import './boarding-pass.css';

export default function BoardingPassPage() {
  const params = useParams();
  const bookingId = params.bookingId;

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  useEffect(() => {
    if (!bookingId) return;

    async function load() {
      const { data, error } = await supabase
        .rpc('get_booking_detail', { p_booking_id: bookingId });

      if (error || !data || data.length === 0) {
        setError('Boarding pass not found');
        setLoading(false);
        return;
      }

      setBooking(data[0]);
      setLoading(false);
    }

    load();
  }, [bookingId]);

  async function handleCancel() {
    setCancelling(true);
    const { error } = await supabase.rpc('cancel_booking', {
      p_booking_id: bookingId,
      p_reason: 'Passenger cancelled'
    });

    if (error) {
      alert(`Could not cancel: ${error.message}`);
      setCancelling(false);
      setShowCancelConfirm(false);
      return;
    }

    const { data } = await supabase.rpc('get_booking_detail', { p_booking_id: bookingId });
    if (data && data[0]) setBooking(data[0]);
    setCancelling(false);
    setShowCancelConfirm(false);
  }

  if (loading) {
    return (
      <main className="bp-page">
        <div className="bp-loading">Loading your boarding pass…</div>
      </main>
    );
  }

  if (error || !booking) {
    return (
      <main className="bp-page">
        <div className="bp-error">
          <h1>Boarding pass not found</h1>
          <p>This pass may have been cancelled, or the link is incorrect.</p>
          <Link href="/" className="bp-back-btn">← Back to home</Link>
        </div>
      </main>
    );
  }

  const dep = new Date(booking.trip_departure_at);
  const now = new Date();
  const minutesUntilDeparture = Math.round((dep - now) / 60000);

  const timeStr = dep.toLocaleTimeString('en-KE', {
    hour: 'numeric', minute: '2-digit', hour12: true
  });
  const dateStr = dep.toLocaleDateString('en-KE', {
    weekday: 'long', day: 'numeric', month: 'long'
  });

  const canCancelFreely = minutesUntilDeparture > 10;
  const canCancelLate = minutesUntilDeparture > 0 && minutesUntilDeparture <= 10;
  const departed = minutesUntilDeparture <= 0;

  const qrPayload = `wabebe:${booking.reference}`;

  const isCancelled = booking.status === 'cancelled';
  const isNoShow = booking.status === 'no_show';
  const isBoarded = booking.status === 'boarded';

  return (
    <main className="bp-page">
      <div className="bp-inner">

        {booking.status === 'confirmed' && (
          <div className="bp-success">
            <div className="bp-success-tick">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div className="bp-success-text">
              <strong>Booking confirmed</strong>
              <span>Show this pass to the conductor when boarding</span>
            </div>
          </div>
        )}

        {isCancelled && (
          <div className="bp-banner bp-banner-cancelled">
            <strong>This booking was cancelled.</strong>
            <span>Your seat has been released.</span>
          </div>
        )}
        {isNoShow && (
          <div className="bp-banner bp-banner-noshow">
            <strong>Marked as no-show.</strong>
            <span>You didn't board within the 2-minute window. A booking restriction may apply.</span>
          </div>
        )}
        {isBoarded && (
          <div className="bp-banner bp-banner-boarded">
            <strong>You boarded this trip.</strong>
            <span>Safe travels.</span>
          </div>
        )}

        <div className={`bp-ticket ${isCancelled || isNoShow ? 'bp-ticket-void' : ''}`}>

          <div className="bp-ticket-top">
            <div className="bp-route-block">
              <div className="bp-route-num">Route {booking.route_code}</div>
              <div className="bp-route-name">{booking.route_name}</div>
            </div>
            <div className="bp-ref">
              <div className="bp-ref-label">Booking ref</div>
              <div className="bp-ref-code">{booking.reference}</div>
            </div>
          </div>

          <div className="bp-perf"></div>

          <div className="bp-ticket-body">
            <div className="bp-ticket-details">
              <div className="bp-detail">
                <div className="bp-detail-key">Passenger</div>
                <div className="bp-detail-val">{booking.passenger_name}</div>
              </div>

              <div className="bp-detail-row">
                <div className="bp-detail">
                  <div className="bp-detail-key">Departs</div>
                  <div className="bp-detail-val bp-departs">{timeStr}</div>
                  <div className="bp-detail-sub">{dateStr}</div>
                </div>

                <div className="bp-detail">
                  <div className="bp-detail-key">Seat</div>
                  <div className="bp-detail-val bp-seat">{booking.seat_id}</div>
                </div>
              </div>

              <div className="bp-detail-row">
                <div className="bp-detail">
                  <div className="bp-detail-key">Bus</div>
                  <div className="bp-detail-val">
                    {booking.bus_fleet_number}
                    {booking.bus_nickname && <span className="bp-nickname"> "{booking.bus_nickname}"</span>}
                  </div>
                </div>

                <div className="bp-detail">
                  <div className="bp-detail-key">Plate</div>
                  <div className="bp-detail-val bp-plate">{booking.bus_plate}</div>
                </div>
              </div>

              <div className="bp-detail">
                <div className="bp-detail-key">Boarding at</div>
                <div className="bp-detail-val bp-boarding-stop">
                  {booking.boarding_stop_name
                    || booking.boarding_label_user
                    || booking.boarding_label_auto
                    || 'Origin'}
                </div>
                {booking.boarding_label_user && booking.boarding_label_auto && (
                  <div className="bp-detail-sub">{booking.boarding_label_auto}</div>
                )}
                {(booking.alighting_stop_name || booking.alighting_label_user || booking.alighting_label_auto) && (
                  <div className="bp-detail-sub" style={{ marginTop: 8 }}>
                    Getting off at{' '}
                    {booking.alighting_stop_name
                      || booking.alighting_label_user
                      || booking.alighting_label_auto}
                  </div>
                )}
              </div>
            </div>

            <div className="bp-qr">
              <div className="bp-qr-frame">
                <QRCodeSVG
                  value={qrPayload}
                  size={140}
                  fgColor="#0E1B17"
                  bgColor="transparent"
                  level="M"
                />
              </div>
              <div className="bp-qr-label">Scan to board</div>
            </div>
          </div>

          <div className="bp-ticket-foot">
            <span className="bp-foot-brand">Wabebe</span>
            <span className="bp-foot-meta">
              {booking.passenger_phone} · Pass valid for this trip only
            </span>
          </div>
        </div>

        {!isCancelled && !isNoShow && !isBoarded && (
          <div className="bp-actions">
            <Link href={`/track/${bookingId}`} className="bp-track-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              Track my bus
            </Link>

            {(canCancelFreely || canCancelLate) && (
              <button
                className={`bp-cancel-btn ${canCancelLate ? 'bp-cancel-btn-late' : ''}`}
                onClick={() => setShowCancelConfirm(true)}
                disabled={cancelling}
              >
                Cancel booking
              </button>
            )}

            {departed && (
              <div className="bp-departed-note">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                Trip has departed. The conductor will mark you boarded or no-show on the bus.
              </div>
            )}
          </div>
        )}

        {showCancelConfirm && (
          <div className="bp-modal-backdrop" onClick={() => setShowCancelConfirm(false)}>
            <div className="bp-modal" onClick={(e) => e.stopPropagation()}>
              <h3>Cancel this booking?</h3>
              {canCancelLate ? (
                <p className="bp-modal-warn">
                  Your bus departs in {minutesUntilDeparture} {minutesUntilDeparture === 1 ? 'minute' : 'minutes'}. Cancelling this close counts as a soft strike on your account.
                </p>
              ) : (
                <p>Your seat will be released. You can rebook anytime.</p>
              )}
              <div className="bp-modal-actions">
                <button className="bp-modal-keep" onClick={() => setShowCancelConfirm(false)} disabled={cancelling}>
                  Keep booking
                </button>
                <button className="bp-modal-cancel" onClick={handleCancel} disabled={cancelling}>
                  {cancelling ? 'Cancelling…' : 'Yes, cancel'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bp-help">
          Need help? <a href="https://wa.me/254700000000" className="bp-help-link">Message us on WhatsApp</a>
        </div>

        <div className="bp-recover-hint">
          Save your reference. You can look up this booking later from{' '}
          <Link href="/my-bookings" className="bp-recover-link">My bookings</Link>.
        </div>

      </div>
    </main>
  );
}