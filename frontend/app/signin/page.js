'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { requestOtp, verifyOtp } from '@/lib/auth/session';
import { useAuth } from '@/hooks/useAuth';
import './signin.css';

export default function SignInPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [step, setStep] = useState('phone');
  const searchParams = useSearchParams();
  const [phone, setPhone] = useState(() => searchParams.get('phone') || '');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const [result, setResult] = useState(null);

  // Bounce already-signed-in users away — but only if they arrived HERE while signed in.
  // If we just completed the flow (step !== 'phone'), do NOT redirect; let the welcome/returning card render.
  useEffect(() => {
    if (!authLoading && user && step === 'phone') {
      router.push('/my-bookings');
    }
  }, [user, authLoading, router, step]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  async function handlePhoneSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!phone.trim()) { setError('Enter your phone number.'); return; }

    setSubmitting(true);
    try {
      const data = await requestOtp(phone.trim());
      if (data.error === 'invalid_phone') {
        setError('Phone number format looks wrong. Use digits only, e.g. 0712345678.');
      } else if (data.error === 'rate_limited') {
        setError(data.message || 'Too many code requests. Try again in an hour.');
      } else if (data.ok) {
        setDevCode(data.dev_code);
        setStep('code');
        setCountdown(30);
      }
    } catch (err) { setError(err.message); }
    setSubmitting(false);
  }

  async function handleCodeSubmit(e) {
    e.preventDefault();
    setError(null);
    if (code.length !== 6) { setError('The code should be 6 digits.'); return; }

    setSubmitting(true);
    try {
      const data = await verifyOtp(phone.trim(), code.trim());

      if (data.error === 'wrong_code') {
        setError(`Wrong code. ${data.attempts_remaining} tries left.`);
        setCode('');
      } else if (data.error === 'too_many_attempts') {
        setError('Too many wrong tries. Request a new code.');
        setStep('phone'); setCode('');
      } else if (data.error === 'no_active_code') {
        setError('Code expired. Request a new one.');
        setStep('phone'); setCode('');
      } else if (data.ok) {
        setResult(data);
        // Route to different welcome experiences
        setStep(data.user.is_new_user ? 'welcome' : 'returning');
      }
    } catch (err) { setError(err.message); }
    setSubmitting(false);
  }

  async function handleResend() {
    if (countdown > 0) return;
    setError(null); setCode(''); setSubmitting(true);
    try {
      const data = await requestOtp(phone.trim());
      if (data.ok) { setDevCode(data.dev_code); setCountdown(30); }
      else if (data.error === 'rate_limited') setError(data.message);
    } catch (err) { setError(err.message); }
    setSubmitting(false);
  }

  if (authLoading) return <main className="si-page"><div className="si-loading">Checking session…</div></main>;

  // === Step 1: enter phone ===
  if (step === 'phone') {
    return (
      <main className="si-page">
        <div className="si-card">
          <div className="si-header">
            <div className="si-eyebrow">Wabebe accounts</div>
            <h1 className="si-title">Sign in or sign up</h1>
            <p className="si-sub">
              Enter your phone number. We'll send you a 6-digit code.
              New here? An account is created automatically — nothing extra to set up.
            </p>
          </div>

          <form onSubmit={handlePhoneSubmit} className="si-form">
            <div className="si-field">
              <label htmlFor="si-phone" className="si-label">Phone number</label>
              <input
                id="si-phone" type="tel" className="si-input"
                value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="07XX XXX XXX or +254 7XX XXX XXX"
                autoComplete="tel" inputMode="tel" autoFocus required
              />
            </div>
            {error && <div className="si-error">{error}</div>}
            <button type="submit" className="si-submit" disabled={submitting}>
              {submitting ? 'Sending code…' : 'Send verification code'}
            </button>
          </form>

          <div className="si-benefits">
            <div className="si-benefits-title">Why sign up?</div>
            <ul>
              <li><strong>See every booking ever.</strong> No more phone + reference lookups.</li>
              <li><strong>Book faster.</strong> Your details are saved.</li>
              <li><strong>Loyalty rewards.</strong> Points on every ride, redeemable for free trips.</li>
              <li><strong>Verified means trusted.</strong> Faster support if things go wrong.</li>
            </ul>
          </div>
        </div>
      </main>
    );
  }

  // === Step 2: enter code ===
  if (step === 'code') {
    return (
      <main className="si-page">
        <div className="si-card">
          <div className="si-header">
            <div className="si-eyebrow">Verify</div>
            <h1 className="si-title">Enter the code</h1>
            <p className="si-sub">
              We sent a 6-digit code to <strong>{phone}</strong>. It's valid for 5 minutes.
            </p>
          </div>

          {devCode && (
            <div className="si-devcode">
              <span className="si-devcode-label">DEV mode</span>
              <span>Your code is <code>{devCode}</code></span>
            </div>
          )}

          <form onSubmit={handleCodeSubmit} className="si-form">
            <div className="si-field">
              <label htmlFor="si-code" className="si-label">6-digit code</label>
              <input
                id="si-code" type="text" className="si-input si-input-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456" inputMode="numeric" autoComplete="one-time-code"
                autoFocus maxLength={6} required
              />
            </div>
            {error && <div className="si-error">{error}</div>}
            <button type="submit" className="si-submit" disabled={submitting || code.length !== 6}>
              {submitting ? 'Verifying…' : 'Verify & sign in'}
            </button>
          </form>

          <div className="si-resend">
            {countdown > 0 ? (
              <span className="si-resend-wait">Resend code in {countdown}s</span>
            ) : (
              <button type="button" onClick={handleResend} className="si-resend-btn" disabled={submitting}>
                Resend code
              </button>
            )}
            <button type="button" onClick={() => { setStep('phone'); setCode(''); setError(null); }} className="si-back-btn">
              ← Use a different number
            </button>
          </div>
        </div>
      </main>
    );
  }

  // === Step 3a: new-user multi-slide welcome ===
  if (step === 'welcome') {
    return <NewUserWelcome result={result} onSubmitName={async (name) => {
        if (name) {
        const { updateMyName } = await import('@/lib/auth/session');
        await updateMyName(name);
        }
    }} />;
    }

  // === Step 3b: returning user welcome ===
  if (step === 'returning') {
    const priorCount = result?.user?.prior_booking_count ?? 0;
    const displayName = user?.full_name || result?.user?.phone;

    return (
      <main className="si-page">
        <div className="si-card si-welcome-returning">
          <div className="si-check-wrap">
            <div className="si-check">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
            </div>
          </div>

          <div className="si-header" style={{textAlign: 'center'}}>
            <div className="si-eyebrow">Signed in</div>
            <h1 className="si-title">Welcome back</h1>
            <p className="si-sub">
              You're signed in as <strong>{displayName}</strong>.
            </p>
          </div>

          {priorCount > 0 && (
            <div className="si-claim-notice">
              <div className="si-claim-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              </div>
              <div className="si-claim-text">
                <strong>{priorCount} past booking{priorCount === 1 ? '' : 's'} found under this number.</strong>
                <p>They've been linked to your account. If any weren't yours, contact dispatch to remove them.</p>
              </div>
            </div>
          )}

          <div className="si-actions">
            <Link href="/my-bookings" className="si-cta-primary">See my bookings →</Link>
            <Link href="/" className="si-cta-secondary">Book a new ride</Link>
          </div>
        </div>
      </main>
    );
  }

  return null;
}

/* =====================================================================
   Multi-slide onboarding for brand-new users
   ===================================================================== */
function NewUserWelcome({ result, onSubmitName }) {
  const [slideIdx, setSlideIdx] = useState(0);
  const [name, setName] = useState('');
  const [nameSaved, setNameSaved] = useState(false);
  const [savingName, setSavingName] = useState(false);

  const slides = [
    // Slide 0 — Welcome + name capture
    {
      key: 'welcome',
      icon: (
        <div className="si-check-wrap si-check-anim">
          <div className="si-check">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
          </div>
        </div>
      ),
      eyebrow: 'Welcome',
      title: 'Welcome to Wabebe',
      subtitle: 'You\'re in. Let\'s make Nairobi a little easier to move through.',
      body: (
        <div className="si-name-capture">
          {nameSaved ? (
            <p className="si-name-thanks">Thanks, <strong>{name}</strong>.</p>
          ) : (
            <>
              <label htmlFor="si-name" className="si-label">What should we call you?</label>
              <input
                id="si-name" type="text" className="si-input"
                value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Your name (optional)"
                autoComplete="given-name" maxLength={60}
              />
              <div className="si-name-actions">
                <button
                  type="button"
                  className="si-name-save"
                  disabled={!name.trim() || savingName}
                  onClick={async () => {
                    setSavingName(true);
                    await onSubmitName(name.trim());
                    setNameSaved(true);
                    setSavingName(false);
                  }}
                >
                  {savingName ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  className="si-name-skip"
                  onClick={() => setSlideIdx(1)}
                >
                  Skip for now →
                </button>
              </div>
            </>
          )}
        </div>
      )
    },

    // Slide 1 — Continuity
    {
      key: 'continuity',
      icon: (
        <div className="si-feature-icon si-feature-green">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="16" rx="2"/>
            <path d="M8 2v4M16 2v4M3 10h18"/>
          </svg>
        </div>
      ),
      eyebrow: 'Continuity',
      title: 'Your bookings, always with you',
      subtitle: 'Every trip you book is saved to your account.',
      body: (
        <p className="si-feature-body">
          Switch phones, clear your browser, borrow a friend's device — your bookings, boarding passes,
          and history are all right where you left them. No more searching for reference codes on scraps of paper.
        </p>
      )
    },

    // Slide 2 — Live tracking
    {
      key: 'tracking',
      icon: (
        <div className="si-feature-icon si-feature-amber">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        </div>
      ),
      eyebrow: 'Live tracking',
      title: 'Watch your bus on the map',
      subtitle: 'Real GPS from the conductor\'s phone, in real time.',
      body: (
        <p className="si-feature-body">
          Every trip has a live map. See exactly where your bus is, how far away it is,
          and roughly how many minutes until it reaches your stop. No more standing at the stage guessing.
        </p>
      )
    },

    // Slide 3 — Loyalty (honest)
    {
      key: 'loyalty',
      icon: (
        <div className="si-feature-icon si-feature-green">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </div>
      ),
      eyebrow: 'Coming soon',
      title: 'Loyalty rewards',
      subtitle: 'Points on every ride. Free trips when they stack up.',
      body: (
        <p className="si-feature-body">
          We're building a rewards system for regular riders. Every booking will earn points,
          and points redeem for free trips. Not live yet — but as soon as it launches,
          your account is ready to earn from day one.
        </p>
      )
    },

    // Slide 4 — CTA
    {
      key: 'cta',
      icon: (
        <div className="si-feature-icon si-feature-amber">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M13 5l7 7-7 7"/>
          </svg>
        </div>
      ),
      eyebrow: 'Ready',
      title: name ? `Ready to ride, ${name}?` : 'Ready to ride?',
      subtitle: 'Your account is set up. Nairobi awaits.',
      body: (
        <div className="si-actions" style={{marginTop: 8}}>
          <Link href="/" className="si-cta-primary">Book a ride →</Link>
          <Link href="/my-bookings" className="si-cta-secondary">Go to my bookings</Link>
        </div>
      )
    }
  ];

  const slide = slides[slideIdx];
  const isLast = slideIdx === slides.length - 1;

  return (
    <main className="si-page">
      <div className="si-card si-onboarding">
        <button
          type="button"
          className="si-skip-all"
          onClick={() => setSlideIdx(slides.length - 1)}
          style={{visibility: isLast ? 'hidden' : 'visible'}}
        >
          Skip
        </button>

        <div key={slide.key} className="si-slide">
          {slide.icon}
          <div className="si-slide-header">
            <div className="si-eyebrow">{slide.eyebrow}</div>
            <h1 className="si-title">{slide.title}</h1>
            <p className="si-sub">{slide.subtitle}</p>
          </div>
          <div className="si-slide-body">
            {slide.body}
          </div>
        </div>

        {!isLast && (
          <div className="si-slide-nav">
            <div className="si-dots">
              {slides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`si-dot ${i === slideIdx ? 'si-dot-active' : ''}`}
                  onClick={() => setSlideIdx(i)}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>
            <button
              type="button"
              className="si-next"
              onClick={() => setSlideIdx(slideIdx + 1)}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </main>
  );
}