'use client';

import { supabase } from '@/lib/supabase';

const STORAGE_KEY = 'wabebe_session_token';
const USER_STORAGE_KEY = 'wabebe_session_user';

/**
 * Get the current session token from localStorage.
 * Returns null if not signed in.
 *
 * When we migrate to HTTP-only cookies, this changes to a fetch to /api/auth/me,
 * and callers keep working unchanged.
 */
export function getSessionToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY);
}

/**
 * Get the cached user object (from last successful auth check).
 * Fast; avoids a round-trip when you just need the phone or id.
 * If you need fresh data, use getCurrentUser() which hits the server.
 */
export function getCachedUser() {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Server-round-trip: verifies the token, gets fresh user info,
 * triggers sliding renewal, and updates the cache.
 * Returns null if not signed in or token is invalid.
 */
export async function getCurrentUser() {
  const token = getSessionToken();
  if (!token) return null;

  const { data, error } = await supabase.rpc('get_session_user', {
    p_token: token
  });

  if (error || !data?.ok) {
    // Session invalid — clear local storage
    clearSession();
    return null;
  }

  // Cache the user info
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
  return data.user;
}

/**
 * Request an OTP be sent to the given phone.
 * In dev mode, the code comes back in the response for testing.
 * In production, this returns { ok: true } only, and the code goes via SMS.
 */
export async function requestOtp(phone) {
  const response = await fetch('/api/auth/request-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to send code');
  }
  return data;
}

/**
 * Verify an OTP code and create a session.
 * On success, stores the token locally and returns user info.
 */
export async function verifyOtp(phone, code) {
  const { data, error } = await supabase.rpc('verify_otp_code', {
    p_phone: phone,
    p_code: code
  });

  if (error) throw new Error(error.message);

  if (data.ok) {
    // Store the session
    localStorage.setItem(STORAGE_KEY, data.session_token);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
    // Broadcast to other tabs / components
    notifyAuthChange();
  }

  return data;
}

/**
 * Sign out — revokes the server-side session and clears local storage.
 */
export async function signOut() {
  const token = getSessionToken();
  if (token) {
    // Fire and forget — we sign out locally regardless of server response
    try {
      await supabase.rpc('sign_out', { p_token: token });
    } catch {}
  }
  clearSession();
}

/**
 * Clear local session state without server call (used when server rejects the token)
 */
function clearSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
  notifyAuthChange();
}

/**
 * Update the current user's full name.
 * Returns the updated name on success, throws on failure.
 */
export async function updateMyName(fullName) {
  const token = getSessionToken();
  if (!token) throw new Error('Not signed in');

  const { data, error } = await supabase.rpc('update_my_name', {
    p_token: token,
    p_full_name: fullName
  });

  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);

  // Update cached user
  const cached = getCachedUser();
  if (cached) {
    cached.full_name = data.full_name;
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(cached));
    notifyAuthChange();
  }

  return data.full_name;
}

/**
 * Subscribe to auth state changes (sign in / sign out).
 * Returns an unsubscribe function.
 */
export function onAuthChange(callback) {
  if (typeof window === 'undefined') return () => {};
  const handler = () => callback(getCachedUser());
  window.addEventListener('wabebe-auth-change', handler);
  window.addEventListener('storage', (e) => {
    // Also fire when localStorage changes in another tab
    if (e.key === STORAGE_KEY || e.key === USER_STORAGE_KEY) handler();
  });
  return () => window.removeEventListener('wabebe-auth-change', handler);
}

function notifyAuthChange() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('wabebe-auth-change'));
}