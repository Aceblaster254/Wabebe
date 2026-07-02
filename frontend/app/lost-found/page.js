'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import PageShell from '@/components/PageShell';
import './lost-found.css';

export default function LostFoundPage() {
  const [reporterName, setReporterName] = useState('');
  const [reporterPhone, setReporterPhone] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [bookingReference, setBookingReference] = useState('');
  const [seatId, setSeatId] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!reporterName.trim() || !reporterPhone.trim() || !itemDescription.trim()) {
      setError('Please fill in your name, phone, and a description of the item.');
      return;
    }

    setSubmitting(true);

    const { data, error: rpcError } = await supabase.rpc('submit_lost_item_report', {
      p_reporter_name: reporterName.trim(),
      p_reporter_phone: reporterPhone.trim(),
      p_item_description: itemDescription.trim(),
      p_booking_reference: bookingReference.trim() || null,
      p_seat_id: seatId.trim() || null,
      p_notes: notes.trim() || null
    });

    setSubmitting(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    if (data?.error === 'invalid_phone') {
      setError('Phone number format looks wrong. Use digits only, e.g. 0712345678.');
      return;
    }
    if (data?.error === 'name_too_short') {
      setError('Please enter your full name.');
      return;
    }
    if (data?.error === 'description_too_short') {
      setError('Please describe the item in a few more words.');
      return;
    }

    setSuccess({
      autoFilled: data.auto_filled
    });
  }

  if (success) {
    return (
      <PageShell
        eyebrow="Lost & Found"
        title="Report received"
        subtitle="Thank you. Dispatch will review your report as soon as possible."
      >
        <p>
          We've logged your lost item report. Here's what happens next:
        </p>
        <ul>
          <li>Dispatch checks with the conductor of that trip.</li>
          <li>If your item was found, we'll contact you within 24 hours to arrange collection.</li>
          <li>If not, we'll follow up to let you know so you can plan next steps.</li>
        </ul>
        {success.autoFilled && (
          <div className="ps-box">
            <div className="ps-box-title">Trip details auto-filled</div>
            <p style={{ margin: 0 }}>
              We matched your booking reference to your trip. Dispatch will know exactly which bus and route to check.
            </p>
          </div>
        )}
        <p style={{ marginTop: 24 }}>
          If it's urgent, reach out on <Link href="/contact">WhatsApp</Link> to speed things up.
        </p>
      </PageShell>
    );
  }

  return (
    <PageShell
      eyebrow="Lost & Found"
      title="Left something on the bus?"
      subtitle="Tell us what happened. The more you can remember, the better our chances of finding it."
    >
      <form className="lf-form" onSubmit={handleSubmit}>

        <div className="lf-section">
          <h3 className="lf-section-title">Your details</h3>

          <div className="lf-field">
            <label htmlFor="lf-name" className="lf-label">Your name</label>
            <input
              id="lf-name"
              type="text"
              className="lf-input"
              value={reporterName}
              onChange={(e) => setReporterName(e.target.value)}
              placeholder="e.g. Amina Wanjiku"
              autoComplete="name"
              required
            />
          </div>

          <div className="lf-field">
            <label htmlFor="lf-phone" className="lf-label">Phone number</label>
            <input
              id="lf-phone"
              type="tel"
              className="lf-input"
              value={reporterPhone}
              onChange={(e) => setReporterPhone(e.target.value)}
              placeholder="07XX XXX XXX"
              autoComplete="tel"
              inputMode="tel"
              required
            />
            <span className="lf-hint">We'll call this number if we find your item.</span>
          </div>
        </div>

        <div className="lf-section">
          <h3 className="lf-section-title">Which trip?</h3>

          <div className="lf-field">
            <label htmlFor="lf-ref" className="lf-label">
              Booking reference <span className="lf-optional">(optional but recommended)</span>
            </label>
            <input
              id="lf-ref"
              type="text"
              className="lf-input lf-input-ref"
              value={bookingReference}
              onChange={(e) => setBookingReference(e.target.value.toUpperCase())}
              placeholder="ABC12345"
              maxLength={12}
            />
            <span className="lf-hint">
              If you provide this, we'll auto-fill your trip details. Find it on your boarding pass.
            </span>
          </div>

          <div className="lf-field">
            <label htmlFor="lf-seat" className="lf-label">
              Seat number <span className="lf-optional">(if you remember)</span>
            </label>
            <input
              id="lf-seat"
              type="text"
              className="lf-input lf-input-seat"
              value={seatId}
              onChange={(e) => setSeatId(e.target.value.toUpperCase())}
              placeholder="e.g. 3B"
              maxLength={4}
            />
          </div>
        </div>

        <div className="lf-section">
          <h3 className="lf-section-title">The item</h3>

          <div className="lf-field">
            <label htmlFor="lf-desc" className="lf-label">Describe the item</label>
            <textarea
              id="lf-desc"
              className="lf-textarea"
              value={itemDescription}
              onChange={(e) => setItemDescription(e.target.value)}
              placeholder="e.g. Black leather backpack with a red zipper. Contains a laptop, notebook, and house keys."
              rows={4}
              required
            />
            <span className="lf-hint">Be specific. Color, brand, size, contents — anything unique.</span>
          </div>

          <div className="lf-field">
            <label htmlFor="lf-notes" className="lf-label">
              Anything else <span className="lf-optional">(optional)</span>
            </label>
            <textarea
              id="lf-notes"
              className="lf-textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Where you were sitting, when you noticed it was missing, anything else that might help."
              rows={3}
            />
          </div>
        </div>

        {error && <div className="lf-error">{error}</div>}

        <button type="submit" className="lf-submit" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit report'}
        </button>

        <p className="lf-fine-print">
          By submitting, you consent to Wabebe holding this report for the purpose of returning your item.
          Reports are reviewed by dispatch during operating hours.
        </p>
      </form>
    </PageShell>
  );
}