import Link from 'next/link';
import './Nav.css';

export default function Nav() {
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

          <Link href="/login" className="nav-cta">Sign in</Link>
        </div>
      </div>
    </nav>
  );
}