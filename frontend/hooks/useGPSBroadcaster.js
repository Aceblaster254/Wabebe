'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * GPS broadcaster for the conductor app.
 * Watches the device's GPS, broadcasts position to the trip,
 * and adjusts rate based on whether the bus is moving.
 *
 * States:
 *   permission: 'unknown' | 'prompt' | 'granted' | 'denied'
 *   broadcasting: boolean
 *   lastPing: { lat, lng, accuracy_m, ts } | null
 *   error: string | null
 *
 * Returns these plus control functions.
 */
export function useGPSBroadcaster({ tripId, token, active }) {
  const [permission, setPermission] = useState('unknown');
  const [broadcasting, setBroadcasting] = useState(false);
  const [lastPing, setLastPing] = useState(null);
  const [error, setError] = useState(null);

  const watchIdRef = useRef(null);
  const lastSentAtRef = useRef(0);
  const lastSentPosRef = useRef(null);
  const movingRef = useRef(true);

  // Configuration
  const MOVING_INTERVAL_MS = 15_000;
  const IDLE_INTERVAL_MS = 60_000;
  const MOVING_THRESHOLD_M = 25; // moved more than 25m since last sent ping = moving

  // Check initial permission state
  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Your browser does not support location services');
      return;
    }
    // permissions API isn't on all browsers, fall back to 'prompt'
    if (navigator.permissions?.query) {
      navigator.permissions.query({ name: 'geolocation' })
        .then((result) => {
          setPermission(result.state);
          result.onchange = () => setPermission(result.state);
        })
        .catch(() => setPermission('prompt'));
    } else {
      setPermission('prompt');
    }
  }, []);

  // Start/stop watching based on `active` and permission
  useEffect(() => {
    if (!active) {
      stopWatching();
      return;
    }
    if (permission !== 'granted') return;

    startWatching();
    return stopWatching;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, permission, tripId, token]);

  function startWatching() {
    if (watchIdRef.current !== null) return;
    if (!navigator.geolocation) return;

    setError(null);
    setBroadcasting(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => handlePosition(pos),
      (err) => {
        setError(err.message);
        setBroadcasting(false);
        if (err.code === err.PERMISSION_DENIED) {
          setPermission('denied');
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 30_000
      }
    );
  }

  function stopWatching() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setBroadcasting(false);
  }

  async function handlePosition(pos) {
    const { latitude, longitude, accuracy, heading, speed } = pos.coords;
    const now = Date.now();

    // Decide if we should send this ping based on moving/idle state
    const lastSent = lastSentPosRef.current;
    const distanceMoved = lastSent
      ? haversineMeters(lastSent.lat, lastSent.lng, latitude, longitude)
      : Infinity;

    // Update moving state: moved > threshold since last send = "moving"
    if (lastSent) {
      movingRef.current = distanceMoved > MOVING_THRESHOLD_M;
    }

    const interval = movingRef.current ? MOVING_INTERVAL_MS : IDLE_INTERVAL_MS;
    const timeSinceLastSend = now - lastSentAtRef.current;

    // Skip if too soon since last ping (debouncing watchPosition's frequent updates)
    if (timeSinceLastSend < interval) {
      return;
    }

    // Send the ping
    try {
      const { error: rpcError } = await supabase.rpc('record_gps_ping', {
        p_trip_id: tripId,
        p_token: token,
        p_lat: latitude,
        p_lng: longitude,
        p_accuracy_m: accuracy,
        p_heading_deg: heading,
        p_speed_mps: speed
      });

      if (rpcError) {
        setError(rpcError.message);
      } else {
        lastSentAtRef.current = now;
        lastSentPosRef.current = { lat: latitude, lng: longitude };
        setLastPing({ lat: latitude, lng: longitude, accuracy_m: accuracy, ts: now });
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function requestPermission() {
    // Trigger the browser prompt by calling getCurrentPosition once
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => {
          setPermission('granted');
          resolve('granted');
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            setPermission('denied');
            resolve('denied');
          } else {
            setError(err.message);
            resolve('error');
          }
        },
        { enableHighAccuracy: true, timeout: 10_000 }
      );
    });
  }

  return {
    permission,
    broadcasting,
    lastPing,
    error,
    isMoving: movingRef.current,
    requestPermission
  };
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}