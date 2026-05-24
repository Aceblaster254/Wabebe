import Link from 'next/link';
import './Footer.css';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="foot-inner">
        <div className="foot-brand">
          <Link href="/" className="logo">
            <span className="logo-mark">W</span>
            <span>Wabebe</span>
          </Link>
          <p className="foot-tag">Bringing order to the way Nairobi moves.</p>
        </div>

        <div className="foot-col">
          <h4>Riders</h4>
          <ul>
            <li><Link href="/routes">All routes</Link></li>
            <li><Link href="/account">My bookings</Link></li>
            <li><Link href="/help">Help & FAQ</Link></li>
            <li><Link href="/lost-found">Lost & Found</Link></li>
          </ul>
        </div>

        <div className="foot-col">
          <h4>Company</h4>
          <ul>
            <li><Link href="/about">About</Link></li>
            <li><Link href="/contact">Contact</Link></li>
            <li><Link href="/careers">Careers</Link></li>
          </ul>
        </div>

        <div className="foot-col">
          <h4>Legal</h4>
          <ul>
            <li><Link href="/terms">Terms</Link></li>
            <li><Link href="/privacy">Privacy</Link></li>
            <li><Link href="/no-show-policy">No-show policy</Link></li>
          </ul>
        </div>
      </div>

      <div className="foot-bottom">
        <span>© {new Date().getFullYear()} Wabebe Sacco. Made in Nairobi.</span>
        <div className="foot-bottom-right">
          <a href="https://wa.me/254700000000" className="whatsapp-link">WhatsApp support</a>
          <span>v1.0</span>
        </div>
      </div>
    </footer>
  );
}