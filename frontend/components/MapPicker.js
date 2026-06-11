'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import './MapPicker.css';

// Nairobi CBD as the default center
const NAIROBI_CENTER = [36.8219, -1.2921];
const DEFAULT_ZOOM = 13;

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export default function MapPicker({
  initialLat,
  initialLng,
  onConfirm,        // (lat, lng, autoLabel) => void
  onCancel,
  title = 'Drop your pin'
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  const [pin, setPin] = useState(
    initialLat && initialLng
      ? { lat: initialLat, lng: initialLng }
      : null
  );
  const [autoLabel, setAutoLabel] = useState('');
  const [labelLoading, setLabelLoading] = useState(false);
  const [userLabel, setUserLabel] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Initialize map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const startCenter = initialLng && initialLat
      ? [initialLng, initialLat]
      : NAIROBI_CENTER;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: startCenter,
      zoom: DEFAULT_ZOOM,
      attributionControl: false
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');

    // Tap-to-pin
    map.on('click', (e) => {
      placePin(e.lngLat.lat, e.lngLat.lng);
    });

    mapRef.current = map;

    // If we have an initial pin, drop a marker
    if (initialLat && initialLng) {
      placePin(initialLat, initialLng, false);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function placePin(lat, lng, fly = true) {
    if (!mapRef.current) return;

    // Remove old marker if any
    if (markerRef.current) {
      markerRef.current.remove();
    }

    // Drop a new one
    const marker = new mapboxgl.Marker({ color: '#0B3D2E', draggable: true })
      .setLngLat([lng, lat])
      .addTo(mapRef.current);

    marker.on('dragend', () => {
      const ll = marker.getLngLat();
      setPin({ lat: ll.lat, lng: ll.lng });
      reverseGeocode(ll.lat, ll.lng);
    });

    markerRef.current = marker;
    setPin({ lat, lng });
    reverseGeocode(lat, lng);

    if (fly) {
      mapRef.current.flyTo({ center: [lng, lat], zoom: Math.max(mapRef.current.getZoom(), 15), duration: 600 });
    }
  }

  async function reverseGeocode(lat, lng) {
    setLabelLoading(true);
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?` +
        `access_token=${mapboxgl.accessToken}&` +
        `country=KE&` +
        `language=en&` +
        `limit=1`
      );
      const data = await res.json();
      if (data.features && data.features.length > 0) {
        setAutoLabel(data.features[0].place_name);
      } else {
        setAutoLabel(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }
    } catch (err) {
      setAutoLabel(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    } finally {
      setLabelLoading(false);
    }
  }

  async function searchAddress(query) {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
        `access_token=${mapboxgl.accessToken}&` +
        `country=KE&` +
        `proximity=${NAIROBI_CENTER[0]},${NAIROBI_CENTER[1]}&` +
        `limit=5`
      );
      const data = await res.json();
      setSearchResults(data.features || []);
    } catch (err) {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  function pickSearchResult(feature) {
    const [lng, lat] = feature.center;
    setSearchQuery('');
    setSearchResults([]);
    placePin(lat, lng);
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      alert('Your browser does not support location services');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        placePin(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        alert('Could not get your location. Make sure location services are enabled and you accepted the permission prompt.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  function handleConfirm() {
    if (!pin) return;
    const auto = autoLabel || `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`;
    const userTyped = userLabel.trim() || null;
    onConfirm(pin.lat, pin.lng, auto, userTyped);
  }

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) searchAddress(searchQuery);
      else setSearchResults([]);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  return (
    <div className="mp-overlay">
      <div className="mp-container">

        {/* Top bar */}
        <div className="mp-top">
          <button className="mp-close" onClick={onCancel} title="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
          <h2 className="mp-title">{title}</h2>
        </div>

        {/* Search bar */}
        <div className="mp-search-wrap">
          <div className="mp-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              className="mp-search-input"
              placeholder="Search for an area or landmark"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searching && <span className="mp-search-loader">…</span>}
          </div>

          {searchResults.length > 0 && (
            <div className="mp-search-results">
              {searchResults.map((feat) => (
                <button
                  key={feat.id}
                  className="mp-search-result"
                  onClick={() => pickSearchResult(feat)}
                >
                  <div className="mp-result-name">{feat.text}</div>
                  <div className="mp-result-context">{feat.place_name}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Map */}
        <div className="mp-map" ref={mapContainerRef}></div>

        {/* Bottom panel */}
        <div className="mp-bottom">
          {!pin ? (
            <div className="mp-instruction">
              <strong>Tap on the map</strong> to drop your pin,
              or search for an address above.
            </div>
          ) : (
            <div className="mp-pin-info">
                <div className="mp-pin-label-row">
                <div className="mp-pin-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                    </svg>
                </div>
                <div className="mp-pin-text">
                    {labelLoading ? 'Looking up location…' : (autoLabel || 'Pin dropped')}
                </div>
                </div>

                <div className="mp-name-field">
                <label className="mp-name-label">
                    Add a name for this spot <span className="mp-name-optional">(optional)</span>
                </label>
                <input
                    type="text"
                    className="mp-name-input"
                    placeholder='e.g. "Kwa miti", "By the duka", "Stage Tena"'
                    value={userLabel}
                    onChange={(e) => setUserLabel(e.target.value)}
                    maxLength={80}
                />
                <div className="mp-name-hint">
                    Names like this help future riders find this spot. {userLabel.length > 0 && userLabel.length < 3 && (
                    <span className="mp-name-warn">At least 3 characters needed.</span>
                    )}
                </div>
                </div>

                <div className="mp-pin-hint">Drag the pin to fine-tune, or tap elsewhere on the map</div>
            </div>
            )}

          <div className="mp-actions">
            <button className="mp-locate" onClick={useMyLocation}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="2" x2="12" y2="6"/>
                <line x1="12" y1="18" x2="12" y2="22"/>
                <line x1="2" y1="12" x2="6" y2="12"/>
                <line x1="18" y1="12" x2="22" y2="12"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              My location
            </button>
            <button
              className="mp-confirm"
              onClick={handleConfirm}
              disabled={!pin}
            >
              Confirm location →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}