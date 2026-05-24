'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import './BookingCard.css';

export default function BookingCard() {
  const router = useRouter();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [date, setDate] = useState('Today');
  const [time, setTime] = useState('Now');

  function swapStops() {
    const temp = from;
    setFrom(to);
    setTo(temp);
  }

  function findBus(e) {
    e.preventDefault();
    // For now, just route to /routes with query params.
    // We'll wire this to real data soon.
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    router.push(`/routes?${params.toString()}`);
  }

  return (
    <div className="book-card reveal d3">
      <div className="book-label">Quick booking</div>
      <h2 className="book-title">Find your bus</h2>

      <form className="book-fields" onSubmit={findBus}>
        <div className="swap-row">
          <div className="book-field">
            <div className="book-field-label">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="3" />
                <circle cx="12" cy="12" r="9" />
              </svg>
              From
            </div>
            <input
              type="text"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder="CBD — Kencom"
              autoComplete="off"
            />
          </div>

          <button type="button" className="swap-btn" onClick={swapStops} aria-label="Swap stops">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="17 1 21 5 17 9" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <polyline points="7 23 3 19 7 15" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
          </button>

          <div className="book-field">
            <div className="book-field-label">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              To
            </div>
            <input
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="Rongai — Stage"
              autoComplete="off"
            />
          </div>
        </div>

        <div className="book-field-row">
          <div className="book-field">
            <div className="book-field-label">When</div>
            <select value={date} onChange={(e) => setDate(e.target.value)}>
              <option>Today</option>
              <option>Tomorrow</option>
              <option>Wed, 27 May</option>
              <option>Thu, 28 May</option>
            </select>
          </div>

          <div className="book-field">
            <div className="book-field-label">Time</div>
            <select value={time} onChange={(e) => setTime(e.target.value)}>
              <option>Now</option>
              <option>5:00 PM</option>
              <option>5:30 PM</option>
              <option>6:00 PM</option>
              <option>6:30 PM</option>
            </select>
          </div>
        </div>

        <button type="submit" className="find-btn">
          Find a bus
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </button>
      </form>

      <div className="book-foot">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        Your details are never shared with conductors or drivers
      </div>
    </div>
  );
}