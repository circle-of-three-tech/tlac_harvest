import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';

/**
 * useActivityTracking
 * Hook that tracks user activity and periodically updates lastActivity
 * Debounced to avoid excessive API calls (max once per 5 minutes)
 */
export function useActivityTracking() {
  const { data: session } = useSession();
  const lastUpdateRef = useRef<number>(0);
  const debounceIntervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!session?.user) {
      return;
    }

    const updateActivity = async () => {
      const now = Date.now();
      const fiveMinutesMs = 5 * 60 * 1000;

      // Only update if 5 minutes have passed since last update
      if (now - lastUpdateRef.current < fiveMinutesMs) {
        return;
      }

      lastUpdateRef.current = now;

      try {
        await fetch('/api/users/update-activity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error('Failed to update activity:', error);
      }
    };

    // Track user interactions
    const events = [
      'mousedown',
      'mouseup',
      'keydown',
      'keyup',
      'touchstart',
      'touchend',
      'click',
      'scroll',
    ];

    const handleActivity = () => {
      // Debounce the update call
      if (debounceIntervalRef.current) {
        clearTimeout(debounceIntervalRef.current);
      }

      debounceIntervalRef.current = setTimeout(updateActivity, 1000);
    };

    // Add event listeners
    events.forEach((event) => {
      document.addEventListener(event, handleActivity, true);
    });

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity, true);
      });
      if (debounceIntervalRef.current) {
        clearTimeout(debounceIntervalRef.current);
      }
    };
  }, [session]);
}
