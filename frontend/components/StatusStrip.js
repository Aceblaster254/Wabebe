'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import './StatusStrip.css';

export default function StatusStrip() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      const { data, error } = await supabase
        .from('dashboard_stats')
        .select('buses_on_road, bookings_today, on_time_pct_7d')
        .eq('id', 1)
        .single();

      if (!error && data) {
        setStats(data);
      }
      setLoading(false);
    }

    loadStats();

    // Refresh every 60 seconds so the numbers stay fresh
    const interval = setInterval(loadStats, 60000);
    return () => clearInterval(interval);
  }, []);

  // Loading state — shown briefly before data arrives
  if (loading) {
    return (
      <div className="status-strip reveal d5">
        <div className="status-card">
          <div className="status-left">
            <span className="status-dot"></span>
            <div className="status-text">Loading service status...</div>
          </div>
        </div>
      </div>
    );
  }

  // Error fallback — if Supabase fails, show a neutral message instead of crashing
  if (!stats) {
    return (
      <div className="status-strip reveal d5">
        <div className="status-card">
          <div className="status-left">
            <span className="status-dot"></span>
            <div className="status-text">Service running</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="status-strip reveal d5">
      <div className="status-card">
        <div className="status-left">
          <span className="status-dot"></span>
          <div className="status-text">
            <strong>{stats.buses_on_road} {stats.buses_on_road === 1 ? 'bus' : 'buses'}</strong>
            {' '}currently on the road · service running normally
          </div>
        </div>

        <div className="status-right">
          <div className="status-metric">
            <div className="status-metric-num">
              {Math.round(stats.on_time_pct_7d)}<span style={{ fontSize: 12, opacity: 0.6 }}>%</span>
            </div>
            <div className="status-metric-lbl">On time this week</div>
          </div>

          <div className="status-metric">
            <div className="status-metric-num">
              {stats.bookings_today.toLocaleString()}
            </div>
            <div className="status-metric-lbl">Seats booked today</div>
          </div>
        </div>
      </div>
    </div>
  );
}