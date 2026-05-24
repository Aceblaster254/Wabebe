import Link from 'next/link';
import './TripRow.css';

export default function TripRow({ trip }) {
  // Format the departure time nicely
  const dep = new Date(trip.departure_at);
  const timeStr = dep.toLocaleTimeString('en-KE', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  // Relative time — "in 12 min" or "in 1h 20m"
  const minutesAway = Math.round((dep - new Date()) / 60000);
  let relativeStr;
  if (minutesAway < 60) {
    relativeStr = `in ${minutesAway} min`;
  } else {
    const h = Math.floor(minutesAway / 60);
    const m = minutesAway % 60;
    relativeStr = m === 0 ? `in ${h}h` : `in ${h}h ${m}m`;
  }

  // Seat availability tone
  const seats = trip.seats_available;
  const isFull = seats === 0;
  const isLow = seats > 0 && seats <= 5;
  const seatToneClass = isFull ? 'full' : isLow ? 'low' : '';

  return (
    <Link
      href={isFull ? '#' : `/book/${trip.trip_id}`}
      className={`trip-row ${isFull ? 'trip-row-full' : ''}`}
      onClick={(e) => isFull && e.preventDefault()}
    >
      {/* Time */}
      <div className="trip-time">
        <div className="trip-time-main">{timeStr}</div>
        <div className="trip-time-relative">{relativeStr}</div>
      </div>

      {/* Bus details */}
      <div className="trip-bus">
        <div className="trip-bus-fleet">{trip.bus_fleet_number}</div>
        {trip.bus_nickname && (
          <div className="trip-bus-nickname">"{trip.bus_nickname}"</div>
        )}
      </div>

      {/* Seats remaining */}
      <div className={`trip-seats ${seatToneClass}`}>
        {isFull ? (
          <span>Full</span>
        ) : (
          <>
            <span className="trip-seats-num">{seats}</span>
            <span className="trip-seats-lbl">{seats === 1 ? 'seat' : 'seats'} left</span>
          </>
        )}
      </div>

      {/* Arrow */}
      <div className="trip-arrow">
        {isFull ? '' : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        )}
      </div>
    </Link>
  );
}