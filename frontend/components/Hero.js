import './Hero.css';

export default function Hero() {
  return (
    <div className="hero-copy">
      <div className="eyebrow reveal d1">
        <span className="eyebrow-dot"></span>
        Free during launch · Nairobi
      </div>

      <h1 className="hero-title reveal d2">
        Reserve your seat.<br />
        Track your bus. <em>Board with confidence.</em>
      </h1>

      <p className="hero-sub reveal d3">
        Wabebe brings order to Nairobi's commute. Pick the exact seat you want, see exactly where your bus is, and stop wondering when it'll arrive.
      </p>

      <div className="hero-trust reveal d4">
        <div className="hero-trust-item">
          <span className="hero-trust-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </span>
          Pick your exact seat
        </div>

        <div className="hero-trust-item">
          <span className="hero-trust-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </span>
          Live bus tracking
        </div>

        <div className="hero-trust-item">
          <span className="hero-trust-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </span>
          Cancel any time
        </div>
      </div>
    </div>
  );
}