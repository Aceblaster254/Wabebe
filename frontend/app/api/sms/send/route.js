import { NextResponse } from 'next/server';
import AfricasTalking from 'africastalking';
import { createClient } from '@supabase/supabase-js';

// Initialize Africa's Talking with credentials from env
const africasTalking = AfricasTalking({
  apiKey: process.env.AFRICASTALKING_API_KEY,
  username: process.env.AFRICASTALKING_USERNAME
});

const sms = africasTalking.SMS;

// Server-side Supabase client with service role (bypasses RLS for logging)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * POST /api/sms/send
 * Body: { phone, message, purpose, purpose_ref_id? }
 *
 * Sends an SMS via Africa's Talking, logs the attempt, returns status.
 *
 * Note: This route is called by our own Supabase functions or server code.
 * There is NO client-side authorization check here yet — the endpoint should
 * NOT be exposed as a public API. In production, we'd add a shared secret
 * or make this only callable from Supabase Edge Functions.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { phone, message, purpose, purpose_ref_id } = body;

    // Basic validation
    if (!phone || !message || !purpose) {
      return NextResponse.json(
        { error: 'phone, message, and purpose are required' },
        { status: 400 }
      );
    }

    // Normalize phone to +254 format
    let normalizedPhone = phone.trim();
    if (normalizedPhone.startsWith('0')) {
      normalizedPhone = '+254' + normalizedPhone.slice(1);
    } else if (normalizedPhone.startsWith('254')) {
      normalizedPhone = '+' + normalizedPhone;
    } else if (!normalizedPhone.startsWith('+')) {
      normalizedPhone = '+254' + normalizedPhone;
    }

    // Log the attempt first (queued state)
    const { data: logEntry, error: logInsertError } = await supabase
      .from('sms_log')
      .insert({
        phone: normalizedPhone,
        message,
        purpose,
        status: 'queued',
        purpose_ref_id: purpose_ref_id || null
      })
      .select()
      .single();

    if (logInsertError) {
      console.error('Failed to log SMS attempt:', logInsertError);
      // Continue anyway — logging failure shouldn't block the send
    }

    // Send via Africa's Talking
    let atResponse;
    try {
      atResponse = await sms.send({
        to: [normalizedPhone],
        message,
        from: process.env.AFRICASTALKING_SENDER_ID || undefined
      });
    } catch (sendError) {
      console.error('AT send error:', sendError);

      // Update log entry with failure
      if (logEntry) {
        await supabase.from('sms_log').update({
          status: 'failed',
          failure_reason: sendError.message || 'AT send error',
          provider_response: { error: sendError.message }
        }).eq('id', logEntry.id);
      }

      return NextResponse.json(
        { error: 'Failed to send SMS', details: sendError.message },
        { status: 500 }
      );
    }

    // Parse the AT response
    // Structure: { SMSMessageData: { Message: string, Recipients: [{ statusCode, status, cost, ... }] } }
    const recipients = atResponse?.SMSMessageData?.Recipients || [];
    const recipient = recipients[0] || {};

    // Cost format is "KES 0.8000" — extract to cents
    let costCents = null;
    if (recipient.cost) {
      const match = recipient.cost.match(/(\d+(?:\.\d+)?)/);
      if (match) {
        costCents = Math.round(parseFloat(match[1]) * 100);
      }
    }

    // Determine status from AT response
    // statusCode 100-102 = success (queued/sent)
    // statusCode 401+ = failure
    const statusCode = recipient.statusCode;
    const isSuccess = statusCode >= 100 && statusCode < 200;

    // Update log entry
    if (logEntry) {
      await supabase.from('sms_log').update({
        status: isSuccess ? 'sent' : 'failed',
        provider_message_id: recipient.messageId || null,
        provider_response: atResponse,
        cost_cents: costCents,
        sent_at: isSuccess ? new Date().toISOString() : null,
        failure_reason: isSuccess ? null : recipient.status || 'Unknown failure'
      }).eq('id', logEntry.id);
    }

    return NextResponse.json({
      ok: isSuccess,
      sms_log_id: logEntry?.id,
      provider_message_id: recipient.messageId,
      status: recipient.status,
      cost: recipient.cost
    });

  } catch (error) {
    console.error('SMS route error:', error);
    return NextResponse.json(
      { error: 'Internal error', details: error.message },
      { status: 500 }
    );
  }
}