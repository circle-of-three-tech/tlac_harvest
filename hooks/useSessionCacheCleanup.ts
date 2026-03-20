'use client';

/**
 * Session Change Hook
 * Clears offline cache when user session expires or user logs out
 */

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { clearOfflineData } from '@/lib/syncManager';

/**
 * Hook that clears offline cache when session changes
 * Should be used in a client component after SessionProvider
 */
export function useSessionCacheCleanup() {
  const { data: session, status } = useSession();

  useEffect(() => {
    // If session is gone (unauthenticated), clear offline data
    if (status === 'unauthenticated') {
      clearOfflineData().catch((error) => {
        console.warn('Error clearing offline data on logout:', error);
      });
    }
  }, [status]);
}
