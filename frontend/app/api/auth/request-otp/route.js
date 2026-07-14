import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * POST /api/auth/request-otp
 * Body: { phone }
 *
 * Server-side OTP request. Generates the code via DB, sends it via SMS.
 * Never returns the code to the client.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { phone } = body;

    if (!phone) {
      return NextResponse.json({ error: 'phone is required' }, { status: 400 });
    }

    // Step 1: Generate code via DB function
    const { data: codeResult, error: dbError } = await supabase.rpc('send_verification_code', {
      p_phone: phone
    });

    if (dbError) {
      console.error('DB error requesting OTP:', dbError);
      return NextResponse.json({ error: 'Failed to generate code', details: dbError.message }, { status: 500 });
    }

    if (codeResult.error) {
      return NextResponse.json(codeResult, { status: 200 });
    }

    const { phone: normalizedPhone, dev_code, expires_in_seconds } = codeResult;

    // Step 2: Send SMS
    // We use the server's own origin to call our /api/sms/send endpoint
    const smsEndpoint = new URL('/api/sms/send', request.url).toString();

    const smsResponse = await fetch(smsEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: normalizedPhone,
        message: `Your Wabebe verification code is ${dev_code}. Valid for 5 minutes. Don't share this code with anyone.`,
        purpose: 'otp'
      })
    });

    const smsData = await smsResponse.json();

    if (!smsData.ok) {
      console.error('SMS send failed:', smsData);
      // The code is still valid in DB — user could retry
      return NextResponse.json(
        { error: 'Failed to send SMS', details: smsData.error },
        { status: 500 }
      );
    }

    // Return success — no code in the response
    return NextResponse.json({
      ok: true,
      phone: normalizedPhone,
      expires_in_seconds
    });

  } catch (error) {
    console.error('OTP route error:', error);
    return NextResponse.json({ error: 'Internal error', details: error.message }, { status: 500 });
  }
}