'use client';

import { useEffect, useState, useCallback } from 'react';
import { getCachedUser, getCurrentUser, onAuthChange } from '@/lib/auth/session';

/**
 * Component-friendly hook for reading the current user.
 * Initially returns the cached user (from localStorage) for instant paint.
 * Then verifies with the server in the background.
 *
 * Returns:
 *   user: user object or null
 *   loading: true only during initial server verification
 *   refresh: function to re-check with server
 */
export function useAuth() {
  const [user, setUser] = useState(() => getCachedUser());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const fresh = await getCurrentUser();
    setUser(fresh);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();

    const unsubscribe = onAuthChange((newUser) => {
      setUser(newUser);
    });

    return unsubscribe;
  }, [refresh]);

  return { user, loading, refresh };
}