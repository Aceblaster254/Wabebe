'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { signOut } from '@/lib/auth/session';
import './Nav.css';

export default function Nav() {
  const { user, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
    setMenuOpen(false);
    // Optionally navigate somewhere. For now stay put; user sees the "Sign in" button reappear.
  }

  const displayName = user?.full_name
  ? user.full_name.split(/\s+/)[0]  // first name only, for compactness
  : user?.id
    ? `User ${user.id.slice(0, 6)}`
    : null;

const initial = user?.full_name
  ? user.full_name.trim().charAt(0).toUpperCase()
  : (user?.id ? user.id.charAt(0).toUpperCase() : '?');

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link href="/" className="logo">
          <span className="logo-mark">W</span>
          <span>Wabebe</span>
        </Link>

        <div className="nav-links">
          <Link href="/routes">Routes</Link>
          <Link href="/my-bookings">My bookings</Link>
          <Link href="/help">Help</Link>

          <span className="nav-lang">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            EN
          </span>

          {loading ? (
            <span className="nav-user-placeholder" aria-hidden="true" />
          ) : user ? (
            <div className="nav-user-wrap">
              <button
                type="button"
                className="nav-user"
                onClick={() => setMenuOpen(o => !o)}
                aria-expanded={menuOpen}
              >
                <span className="nav-user-avatar">{initial}</span>
                <span className="nav-user-collapsed">{displayName}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </button>

              {menuOpen && (
                <>
                  <div className="nav-menu-backdrop" onClick={() => setMenuOpen(false)} />
                  <div className="nav-menu">
                    <div className="nav-menu-header">
                      <div className="nav-menu-avatar-large">{initial}</div>
                      <div className="nav-menu-header-text">
                        {user.full_name && <div className="nav-menu-name">{user.full_name}</div>}
                        <div className="nav-menu-phone">{formatPhoneKE(user.phone)}</div>
                      </div>
                    </div>

                    <div className="nav-menu-divider" />

                    <button
                      type="button"
                      className="nav-menu-signout"
                      onClick={handleSignOut}
                      disabled={signingOut}
                    >
                      {signingOut ? 'Signing out…' : 'Sign out'}
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Link href="/signin" className="nav-cta">Sign in</Link>
          )}
        </div>
      </div>
    </nav>     
  );
    /**
   * Format a Kenyan phone number for display.
   * '+254712345678' → '0712 345 678'
   * Anything non-Kenyan stays in international format.
   */
  function formatPhoneKE(phone) {
    if (!phone) return '';
    const p = phone.startsWith('+254')
      ? '0' + phone.slice(4)
      : phone;
    if (p.startsWith('0') && p.length === 10) {
      return `${p.slice(0, 4)} ${p.slice(4, 7)} ${p.slice(7)}`;
    }
    return phone;
  }
}