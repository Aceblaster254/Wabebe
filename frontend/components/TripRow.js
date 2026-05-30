'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import './TripRow.css';

export default function TripRow({ trip, stops, originStopId }) {
  const router = useRouter();
  const [showStopPicker, setShowStopPicker] = useState(false);

  // Format the departure time nicely
  const dep = new Date(trip.departure_at);
  const timeStr = dep.toLocaleTimeString('en-KE', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  const minutesAway = Math.round((dep - new Date()) / 60000);
  let relativeStr;
  if (minutesAway < 60) {
    relativeStr = `in ${minutesAway} min`;
  } else {
    const h = Math.floor(minutesAway / 60);
    const m = minutesAway % 60;
    relativeStr = m === 0 ? `in ${h}h` : `in ${h}h ${m}m`;
  }

  const seats = trip.seats_available;
  const isFull = seats === 0;
  const isLow = seats > 0 && seats <= 5;
  const seatToneClass = isFull ? 'full' : isLow ? 'low' : '';

  function handleClick(e) {
    if (isFull) {
      e.preventDefault();
      return;
    }
    setShowStopPicker(true);
  }

  return (
    <>
      <div
        className={`trip-row ${isFull ? 'trip-row-full' : ''}`}
        onClick={handleClick}
        role="button"
        tabIndex={isFull ? -1 : 0}
      >
        <div className="trip-time">
          <div className="trip-time-main">{timeStr}</div>
          <div className="trip-time-relative">{relativeStr}</div>
        </div>

        <div className="trip-bus">
          <div className="trip-bus-fleet">{trip.bus_fleet_number}</div>
          {trip.bus_nickname && (
            <div className="trip-bus-nickname">"{trip.bus_nickname}"</div>
          )}
        </div>

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

        <div className="trip-arrow">
          {!isFull && (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          )}
        </div>
      </div>

      {showStopPicker && (
        <StopPickerModal
          stops={stops}
          originStopId={originStopId}
          tripId={trip.trip_id}
          timeStr={timeStr}
          fleetNumber={trip.bus_fleet_number}
          onClose={() => setShowStopPicker(false)}
          onConfirm={(boardingId, alightingId) => {
            const params = new URLSearchParams({ boarding: boardingId });
            if (alightingId) params.append('alighting', alightingId);
            router.push(`/book/${trip.trip_id}?${params.toString()}`);
          }}
        />
      )}
    </>
  );
}

function StopPickerModal({ stops, originStopId, timeStr, fleetNumber, onClose, onConfirm }) {
  const orderedStops = [...stops].sort((a, b) => a.sequence - b.sequence);
  const origin = stops.find(s => s.id === originStopId);

  const [boardingId, setBoardingId] = useState(originStopId);
  const [alightingId, setAlightingId] = useState('');
  const [boardingText, setBoardingText] = useState(origin?.name || '');
  const [alightingText, setAlightingText] = useState('');
  const [boardingOpen, setBoardingOpen] = useState(false);
  const [alightingOpen, setAlightingOpen] = useState(false);

  const boardingStop = stops.find(s => s.id === boardingId);
  const alightingStop = stops.find(s => s.id === alightingId);
  const boardingSeq = boardingStop?.sequence ?? 0;

  // Filtering
  const boardingCandidates = orderedStops.slice(0, -1);
  const alightingCandidates = orderedStops.filter(s => s.sequence > boardingSeq);

  function filterByText(list, query) {
    if (!query.trim()) return list;
    const q = query.toLowerCase().trim();
    return list.filter(s => s.name.toLowerCase().includes(q));
  }

  // For dropdown filtering: only filter if user is actively typing something
  // different from the selected stop name
  const boardingFiltered = boardingText === (boardingStop?.name || '')
    ? boardingCandidates
    : filterByText(boardingCandidates, boardingText);

  const alightingFiltered = alightingText === (alightingStop?.name || '')
    ? alightingCandidates
    : filterByText(alightingCandidates, alightingText);

  function pickBoarding(stop) {
    setBoardingId(stop.id);
    setBoardingText(stop.name);
    setBoardingOpen(false);

    // Clear alighting if it's no longer valid
    if (alightingId) {
      const alightSeq = stops.find(x => x.id === alightingId)?.sequence ?? 0;
      if (alightSeq <= stop.sequence) {
        setAlightingId('');
        setAlightingText('');
      }
    }
  }

  function pickAlighting(stop) {
    setAlightingId(stop.id);
    setAlightingText(stop.name);
    setAlightingOpen(false);
  }

  function clearBoarding() {
    setBoardingId('');
    setBoardingText('');
  }

  function clearAlighting() {
    setAlightingId('');
    setAlightingText('');
  }

  function handleConfirm(e) {
    e.preventDefault();
    if (!boardingId) {
      // Fall back to origin if user cleared it without picking
      onConfirm(originStopId, alightingId || null);
      return;
    }
    onConfirm(boardingId, alightingId || null);
  }

  return (
    <div className="sp-backdrop" onClick={onClose}>
      <div className="sp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sp-handle"></div>

        <h2 className="sp-title">Where will you board?</h2>
        <p className="sp-sub">Bus {fleetNumber} · {timeStr}</p>

        <form onSubmit={handleConfirm}>

          {/* Boarding */}
          <div className="sp-field">
            <label className="sp-label">Boarding stop</label>
            <div className="sp-combo">
              <input
                type="text"
                className="sp-input"
                value={boardingText}
                placeholder="Search or select a stop"
                onChange={(e) => {
                  setBoardingText(e.target.value);
                  setBoardingOpen(true);
                  // If they erase enough to no longer match the picked stop, deselect
                  if (boardingStop && e.target.value !== boardingStop.name) {
                    setBoardingId('');
                  }
                }}
                onFocus={() => setBoardingOpen(true)}
                onBlur={() => setTimeout(() => setBoardingOpen(false), 180)}
              />
              {boardingText && (
                <button
                  type="button"
                  className="sp-clear"
                  onMouseDown={(e) => { e.preventDefault(); clearBoarding(); }}
                  title="Clear"
                >
                  ×
                </button>
              )}
              {boardingOpen && (
                <div className="sp-dropdown">
                  {boardingFiltered.length === 0 ? (
                    <div className="sp-no-match">No matching stops</div>
                  ) : (
                    boardingFiltered.map(s => (
                      <button
                        type="button"
                        key={s.id}
                        className={`sp-option ${boardingId === s.id ? 'sp-option-selected' : ''}`}
                        onMouseDown={(e) => { e.preventDefault(); pickBoarding(s); }}
                      >
                        <span className="sp-stop-num">{s.sequence}</span>
                        <span className="sp-stop-name">{s.name}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Alighting */}
          <div className="sp-field">
            <label className="sp-label">
              Alighting stop <span className="sp-optional">(optional)</span>
            </label>
            {alightingCandidates.length === 0 ? (
              <p className="sp-empty">No stops available after your boarding point.</p>
            ) : (
              <div className="sp-combo">
                <input
                  type="text"
                  className="sp-input"
                  value={alightingText}
                  placeholder="Search or select a stop"
                  onChange={(e) => {
                    setAlightingText(e.target.value);
                    setAlightingOpen(true);
                    if (alightingStop && e.target.value !== alightingStop.name) {
                      setAlightingId('');
                    }
                  }}
                  onFocus={() => setAlightingOpen(true)}
                  onBlur={() => setTimeout(() => setAlightingOpen(false), 180)}
                />
                {alightingText && (
                  <button
                    type="button"
                    className="sp-clear"
                    onMouseDown={(e) => { e.preventDefault(); clearAlighting(); }}
                    title="Clear"
                  >
                    ×
                  </button>
                )}
                {alightingOpen && (
                  <div className="sp-dropdown">
                    {alightingFiltered.length === 0 ? (
                      <div className="sp-no-match">No matching stops</div>
                    ) : (
                      alightingFiltered.map(s => (
                        <button
                          type="button"
                          key={s.id}
                          className={`sp-option ${alightingId === s.id ? 'sp-option-selected' : ''}`}
                          onMouseDown={(e) => { e.preventDefault(); pickAlighting(s); }}
                        >
                          <span className="sp-stop-num">{s.sequence}</span>
                          <span className="sp-stop-name">{s.name}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="sp-actions">
            <button type="button" className="sp-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="sp-confirm">
              Pick seat →
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}