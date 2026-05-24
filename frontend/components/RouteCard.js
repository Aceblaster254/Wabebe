import Link from 'next/link';
import './RouteCard.css';

export default function RouteCard({ code, name, frequencyLabel, seatsAvailable }) {
  // Split the route name like "CBD → Rongai" into two halves for display
  const parts = name.split('→').map(s => s.trim());
  const from = parts[0] || name;
  const to = parts[1] || '';

  // Visual treatment: "low" if 5 or fewer seats remaining
  const isLow = seatsAvailable !== null && seatsAvailable <= 5;

  return (
    <Link href={`/routes/${code}`} className="route-card">
      <div className="route-num">Route {code}</div>

      {seatsAvailable !== null && (
        <div className={`route-seats ${isLow ? 'low' : ''}`}>
          {seatsAvailable} {seatsAvailable === 1 ? 'seat' : 'seats'}
        </div>
      )}

      <div className="route-path">
        {from}
        {to && (
          <>
            {' '}
            <span className="route-path-arrow">→</span>
            {' '}
            {to}
          </>
        )}
      </div>

      <div className="route-meta">
        <span className="route-meta-item">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          {frequencyLabel}
        </span>
      </div>
    </Link>
  );
}