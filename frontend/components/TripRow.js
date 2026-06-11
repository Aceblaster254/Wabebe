'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import MapPicker from './MapPicker';
import './TripRow.css';

export default function TripRow({ trip, stops, originStopId, routeId }) {
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
          routeId={routeId}
          timeStr={timeStr}
          fleetNumber={trip.bus_fleet_number}
          onClose={() => setShowStopPicker(false)}

          onConfirm={(result) => {
            const params = new URLSearchParams();

            if (result.boardingStopId) {
              params.append('boarding_stop', result.boardingStopId);
            } else if (result.boardingPin) {
              params.append('boarding_lat', result.boardingPin.lat);
              params.append('boarding_lng', result.boardingPin.lng);
              if (result.boardingPin.autoLabel) params.append('boarding_label_auto', result.boardingPin.autoLabel);
              if (result.boardingPin.userLabel) params.append('boarding_label_user', result.boardingPin.userLabel);
            }

            if (result.alightingStopId) {
              params.append('alighting_stop', result.alightingStopId);
            } else if (result.alightingPin) {
              params.append('alighting_lat', result.alightingPin.lat);
              params.append('alighting_lng', result.alightingPin.lng);
              if (result.alightingPin.autoLabel) params.append('alighting_label_auto', result.alightingPin.autoLabel);
              if (result.alightingPin.userLabel) params.append('alighting_label_user', result.alightingPin.userLabel);
            }

            router.push(`/book/${trip.trip_id}?${params.toString()}`);
          }}
        />
      )}
    </>
  );
}

function StopPickerModal({ stops, originStopId, timeStr, fleetNumber, routeId, onClose, onConfirm }) {
  const orderedStops = [...stops].sort((a, b) => a.sequence - b.sequence);
  const origin = stops.find(s => s.id === originStopId);

  // Stop-based selections (official)
  const [boardingId, setBoardingId] = useState(originStopId);
  const [alightingId, setAlightingId] = useState('');
  const [boardingText, setBoardingText] = useState(origin?.name || '');
  const [alightingText, setAlightingText] = useState('');
  const [boardingOpen, setBoardingOpen] = useState(false);
  const [alightingOpen, setAlightingOpen] = useState(false);

  // Pin-based selections (custom)
  const [boardingPin, setBoardingPin] = useState(null);   // { lat, lng, label }
  const [alightingPin, setAlightingPin] = useState(null);

  // Map picker open state
  const [mapPickerFor, setMapPickerFor] = useState(null); // 'boarding' | 'alighting' | null
  const [learnedStops, setLearnedStops] = useState([]);

  useEffect(() => {
    if (!routeId) return;
    supabase.rpc('get_learned_stops_for_route', { p_route_id: routeId })
      .then(({ data, error }) => {
        if (!error && data) setLearnedStops(data);
      });
  }, [routeId]);

  const boardingStop = stops.find(s => s.id === boardingId);
  const alightingStop = stops.find(s => s.id === alightingId);
  const boardingSeq = boardingStop?.sequence ?? 0;

  const boardingCandidates = orderedStops.slice(0, -1);
  const alightingCandidates = orderedStops.filter(s => s.sequence > boardingSeq);

  function filterByText(list, query) {
    if (!query.trim()) return list;
    const q = query.toLowerCase().trim();
    return list.filter(s => s.name.toLowerCase().includes(q));
  }

  const boardingFiltered = boardingText === (boardingStop?.name || '')
    ? boardingCandidates
    : filterByText(boardingCandidates, boardingText);

  function filterLearned(list, query) {
    if (!query.trim()) return list;
    const q = query.toLowerCase().trim();
    return list.filter(ls => ls.label.toLowerCase().includes(q));
  }
  
  const filterLearnedBoarding =
    boardingText === (boardingStop?.name || '')
      ? learnedStops
      : filterLearned(learnedStops, boardingText);
  
  const filterLearnedAlighting =
  alightingText === (alightingStop?.name || '')
    ? learnedStops
    : filterLearned(learnedStops, alightingText);

  const alightingFiltered = alightingText === (alightingStop?.name || '')
    ? alightingCandidates
    : filterByText(alightingCandidates, alightingText);

  function pickBoardingStop(stop) {
    setBoardingId(stop.id);
    setBoardingText(stop.name);
    setBoardingOpen(false);
    setBoardingPin(null); // clear pin if a stop is chosen
    if (alightingId) {
      const alightSeq = stops.find(x => x.id === alightingId)?.sequence ?? 0;
      if (alightSeq <= stop.sequence) {
        setAlightingId('');
        setAlightingText('');
      }
    }
  }

  function pickBoardingLearned(learned) {
    // A learned stop is a pin selection from the list — set as boarding pin
    setBoardingPin({
      lat: learned.lat,
      lng: learned.lng,
      label: learned.label,
      autoLabel: null,
      userLabel: learned.label
    });
    setBoardingId('');
    setBoardingText('');
    setBoardingOpen(false);
  }

  function pickAlightingStop(stop) {
    setAlightingId(stop.id);
    setAlightingText(stop.name);
    setAlightingOpen(false);
    setAlightingPin(null);
  }

  function pickAlightingLearned(learned) {
    setAlightingPin({
      lat: learned.lat,
      lng: learned.lng,
      label: learned.label,
      autoLabel: null,
      userLabel: learned.label
    });
    setAlightingId('');
    setAlightingText('');
    setAlightingOpen(false);
  }

  function clearBoarding() {
    setBoardingId('');
    setBoardingText('');
    setBoardingPin(null);
  }

  function clearAlighting() {
    setAlightingId('');
    setAlightingText('');
    setAlightingPin(null);
  }

  function handlePinConfirmed(lat, lng, autoLabel, userLabel) {
    // Display label: prefer user-typed, fall back to auto-geocoded
    const displayLabel = userLabel || autoLabel;

    if (mapPickerFor === 'boarding') {
      setBoardingPin({ lat, lng, label: displayLabel, autoLabel, userLabel });
      setBoardingId('');
      setBoardingText('');
    } else if (mapPickerFor === 'alighting') {
      setAlightingPin({ lat, lng, label: displayLabel, autoLabel, userLabel });
      setAlightingId('');
      setAlightingText('');
    }
    setMapPickerFor(null);
  }

  function handleConfirm(e) {
    e.preventDefault();

    // Build the result based on what was chosen
    const result = {
      boardingStopId: boardingPin ? null : (boardingId || originStopId),
      alightingStopId: alightingPin ? null : (alightingId || null),
      boardingPin: boardingPin,
      alightingPin: alightingPin
    };

    onConfirm(result);
  }

  // Determine if confirm is enabled — must have boarding (stop OR pin)
  const hasBoarding = !!boardingId || !!boardingPin;

  return (
    <>
      <div className="sp-backdrop" onClick={onClose}>
        <div className="sp-modal" onClick={(e) => e.stopPropagation()}>
          <div className="sp-handle"></div>

          <h2 className="sp-title">Where will you board?</h2>
          <p className="sp-sub">Bus {fleetNumber} · {timeStr}</p>

          <form onSubmit={handleConfirm}>

            {/* Boarding */}
            <div className="sp-field">
              <label className="sp-label">Boarding point</label>

              {boardingPin ? (
                <div className="sp-pin-card">
                  <div className="sp-pin-card-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                      <circle cx="12" cy="10" r="3"/>
                    </svg>
                  </div>
                  <div className="sp-pin-card-text">
                    <div className="sp-pin-card-label">Pin location</div>
                    <div className="sp-pin-card-address">{boardingPin.label}</div>
                  </div>
                  <button
                    type="button"
                    className="sp-pin-card-clear"
                    onClick={clearBoarding}
                    title="Clear"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <>
                  <div className="sp-combo">
                    <input
                      type="text"
                      className="sp-input"
                      value={boardingText}
                      placeholder="Search or select a stop"
                      onChange={(e) => {
                        setBoardingText(e.target.value);
                        setBoardingOpen(true);
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
                        {boardingFiltered.length === 0 && filterLearnedBoarding.length === 0 ? (
                          <div className="sp-no-match">No matching stops</div>
                        ) : (
                          <>
                            {boardingFiltered.length > 0 && (
                              <>
                                <div className="sp-dropdown-section">Official stops</div>
                                {boardingFiltered.map(s => (
                                  <button
                                    type="button"
                                    key={s.id}
                                    className={`sp-option ${boardingId === s.id ? 'sp-option-selected' : ''}`}
                                    onMouseDown={(e) => { e.preventDefault(); pickBoardingStop(s); }}
                                  >
                                    <span className="sp-stop-num">{s.sequence}</span>
                                    <span className="sp-stop-name">{s.name}</span>
                                  </button>
                                ))}
                              </>
                            )}

                            {filterLearnedBoarding.length > 0 && (
                              <>
                                <div className="sp-dropdown-section">Riders also boarded at</div>
                                {filterLearnedBoarding.map(ls => (
                                  <button
                                    type="button"
                                    key={ls.id}
                                    className="sp-option sp-option-learned"
                                    onMouseDown={(e) => { e.preventDefault(); pickBoardingLearned(ls); }}
                                  >
                                    <span className="sp-learned-icon">
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                        <circle cx="12" cy="10" r="3"/>
                                      </svg>
                                    </span>
                                    <span className="sp-stop-name">{ls.label}</span>
                                    <span className="sp-learned-count">×{ls.use_count}</span>
                                  </button>
                                ))}
                              </>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    className="sp-map-btn"
                    onClick={() => setMapPickerFor('boarding')}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                      <circle cx="12" cy="10" r="3"/>
                    </svg>
                    My stop isn't listed — pin on map
                  </button>
                </>
              )}
            </div>

            {/* Alighting */}
            <div className="sp-field">
              <label className="sp-label">
                Alighting point <span className="sp-optional">(optional)</span>
              </label>

              {alightingPin ? (
                <div className="sp-pin-card">
                  <div className="sp-pin-card-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                      <circle cx="12" cy="10" r="3"/>
                    </svg>
                  </div>
                  <div className="sp-pin-card-text">
                    <div className="sp-pin-card-label">Pin location</div>
                    <div className="sp-pin-card-address">{alightingPin.label}</div>
                  </div>
                  <button
                    type="button"
                    className="sp-pin-card-clear"
                    onClick={clearAlighting}
                    title="Clear"
                  >
                    ×
                  </button>
                </div>
              ) : alightingCandidates.length === 0 && !boardingPin ? (
                <p className="sp-empty">No stops available after your boarding point.</p>
              ) : (
                <>
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
                        {alightingFiltered.length === 0 && filterLearnedAlighting.length === 0 ? (
                          <div className="sp-no-match">No matching stops</div>
                        ) : (
                          <>
                            {alightingFiltered.length > 0 && (
                              <>
                                <div className="sp-dropdown-section">Official stops</div>
                                {alightingFiltered.map(s => (
                                  <button
                                    type="button"
                                    key={s.id}
                                    className={`sp-option ${alightingId === s.id ? 'sp-option-selected' : ''}`}
                                    onMouseDown={(e) => { e.preventDefault(); pickAlightingStop(s); }}
                                  >
                                    <span className="sp-stop-num">{s.sequence}</span>
                                    <span className="sp-stop-name">{s.name}</span>
                                  </button>
                                ))}
                              </>
                            )}

                            {filterLearnedAlighting.length > 0 && (
                              <>
                                <div className="sp-dropdown-section">Riders also alighted at</div>
                                {filterLearnedAlighting.map(ls => (
                                  <button
                                    type="button"
                                    key={ls.id}
                                    className="sp-option sp-option-learned"
                                    onMouseDown={(e) => { e.preventDefault(); pickAlightingLearned(ls); }}
                                  >
                                    <span className="sp-learned-icon">
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                        <circle cx="12" cy="10" r="3"/>
                                      </svg>
                                    </span>
                                    <span className="sp-stop-name">{ls.label}</span>
                                    <span className="sp-learned-count">×{ls.use_count}</span>
                                  </button>
                                ))}
                              </>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    className="sp-map-btn"
                    onClick={() => setMapPickerFor('alighting')}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                      <circle cx="12" cy="10" r="3"/>
                    </svg>
                    My stop isn't listed — pin on map
                  </button>
                </>
              )}
            </div>

            <div className="sp-actions">
              <button type="button" className="sp-cancel" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="sp-confirm" disabled={!hasBoarding}>
                Pick seat →
              </button>
            </div>
          </form>
        </div>
      </div>

      {mapPickerFor && (
        <MapPicker
          title={mapPickerFor === 'boarding' ? 'Drop your boarding pin' : 'Drop your alighting pin'}
          onConfirm={handlePinConfirmed}
          onCancel={() => setMapPickerFor(null)}
        />
      )}
    </>
  );
}