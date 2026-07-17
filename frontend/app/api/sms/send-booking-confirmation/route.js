import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * POST /api/sms/send-booking-confirmation
 * Body: { booking_ids: string[] }
 *
 * Fetches each booking's details, formats confirmation SMS, sends it.
 * Returns per-booking status so the frontend can show warnings for failed sends.
 */
export async function POST(request) {
  try {
    const { booking_ids } = await request.json();

    if (!Array.isArray(booking_ids) || booking_ids.length === 0) {
      return NextResponse.json(
        { error: 'booking_ids array required' },
        { status: 400 }
      );
    }

    // Fetch bookings with all details we need for the SMS
    const { data: bookings, error: fetchError } = await supabase
      .from('bookings')
      .select(`
        id,
        reference,
        seat_id,
        boarding_label_user,
        boarding_label_auto,
        passenger_name_override,
        users:user_id (phone, full_name),
        trips (
          departure_at,
          routes (code, name),
          buses (fleet_number, nickname)
        ),
        stops:boarding_stop_id (name)
      `)
      .in('id', booking_ids);

    if (fetchError || !bookings) {
      console.error('Failed to fetch bookings:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch booking details' },
        { status: 500 }
      );
    }

    // Send SMS per booking, collect results
    // Track phones we've already sent to in this batch to avoid duplicates
    const phonesSent = new Set();
    const results = [];

    for (const b of bookings) {
    const passengerPhone = b.users?.phone;
    // The name shown in SMS: override if present (e.g. "Junior"), else the user's full name
    const passengerName = b.passenger_name_override || b.users?.full_name || 'passenger';
    const route = b.trips?.routes;
    const bus = b.trips?.buses;
    const boardingLabel =
        b.stops?.name ||
        b.boarding_label_user ||
        b.boarding_label_auto ||
        'the origin stop';

    if (!passengerPhone) {
        results.push({ booking_id: b.id, ok: false, error: 'no_phone' });
        continue;
    }

    const dep = new Date(b.trips.departure_at);
    const timeStr = dep.toLocaleTimeString('en-KE', {
        hour: 'numeric', minute: '2-digit', hour12: true
    });
    const dateStr = dep.toLocaleDateString('en-KE', {
        weekday: 'short', day: 'numeric', month: 'short'
    });

    const trackUrl = `${new URL('/track/', request.url).toString()}${b.id}`;

    // If this phone already got an SMS in this batch, send a "you booked for X" style
    // instead of a duplicate personal confirmation.
    let message;
    if (phonesSent.has(passengerPhone)) {
        message = `Wabebe: You booked seat ${b.seat_id} for ${passengerName} on Route ${route.code} ${dateStr} ${timeStr}. Ref: ${b.reference}. Their boarding pass: ${trackUrl}`;
    } else {
        message = `Wabebe: Seat ${b.seat_id} on Route ${route.code} ${dateStr} ${timeStr} confirmed. Ref: ${b.reference}. Boarding: ${boardingLabel}. ${trackUrl}`;
    }

    phonesSent.add(passengerPhone);

    const smsRes = await fetch(smsEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
        phone: passengerPhone,
        message,
        purpose: 'booking_confirmation',
        purpose_ref_id: b.id
        })
    });

    const smsData = await smsRes.json();
    results.push({
        booking_id: b.id,
        ok: !!smsData.ok,
        error: smsData.error || null,
        sms_log_id: smsData.sms_log_id
    });
    }

    return NextResponse.json({ ok: true, results });

  } catch (error) {
    console.error('Booking confirmation SMS error:', error);
    return NextResponse.json(
      { error: 'Internal error', details: error.message },
      { status: 500 }
    );
  }
}