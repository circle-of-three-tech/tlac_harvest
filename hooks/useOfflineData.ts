'use client';

/**
 * Offline-aware data hooks
 * These hooks automatically use cached data when offline
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSync } from '@/components/SyncProvider';
import {
  getCachedLeads,
  getCachedUsers,
  getCachedAnnouncements,
  getCachedStats,
  getCachedActivityLogs,
  getCachedSMSLogs,
  type CachedLead,
  type CachedUser,
  type CachedAnnouncement,
  type CachedStats,
  type CachedActivityLog,
  type CachedSMSLog,
} from '@/lib/offlineLeads';

// ==================== GENERIC HOOK ====================

/**
 * Generic hook for fetching data with offline fallback.
 *
 * FIX: The previous implementation accepted fetchFn and cacheFn as plain
 * arguments and put them in the useCallback dependency array. Because every
 * caller passed inline arrow functions, those references changed on every
 * render, which invalidated loadData, which re-ran the useEffect, which
 * called setData, which triggered a re-render — an infinite loop.
 *
 * The fix has two parts:
 *
 * 1. fetchFn and cacheFn are stored in refs so useCallback/useEffect never
 *    need them as dependencies. Refs always hold the latest version of the
 *    function without causing re-renders.
 *
 * 2. A `refetchKey` counter replaces `isOnline` as the useEffect trigger.
 *    When isOnline changes we increment the key, which causes a single
 *    deliberate re-fetch — no runaway dependency chain.
 */
function useOfflineData<T>(
  fetchFn: () => Promise<T>,
  cacheFn: () => Promise<T>
): {
  data: T | null;
  loading: boolean;
  error: Error | null;
  isOffline: boolean;
  refetch: () => void;
} {
  const { isOnline } = useSync();

  // Store the latest function refs without them being reactive dependencies.
  const fetchFnRef = useRef(fetchFn);
  const cacheFnRef = useRef(cacheFn);
  fetchFnRef.current = fetchFn;
  cacheFnRef.current = cacheFn;

  // Track the last known online state in a ref so we can detect real changes.
  const isOnlineRef = useRef(isOnline);

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  // Incrementing this triggers a re-fetch without any function ref instability.
  const [refetchKey, setRefetchKey] = useState(0);

  // When online status genuinely changes, trigger exactly one re-fetch.
  useEffect(() => {
    if (isOnline !== isOnlineRef.current) {
      isOnlineRef.current = isOnline;
      setRefetchKey((k) => k + 1);
    }
  }, [isOnline]);

  // Stable load function — depends only on refetchKey, never on inline fns.
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (isOnlineRef.current) {
        try {
          const result = await fetchFnRef.current();
          setData(result);
          setIsOffline(false);
        } catch (fetchError) {
          console.warn('API fetch failed, using cached data:', fetchError);
          const cached = await cacheFnRef.current();
          setData(cached);
          setIsOffline(true);
          setError(
            fetchError instanceof Error
              ? fetchError
              : new Error('Failed to fetch data')
          );
        }
      } else {
        const cached = await cacheFnRef.current();
        setData(cached);
        setIsOffline(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setData(null);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetchKey]); // refetchKey is the only real trigger

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Manual refetch: just bump the key.
  const refetch = useCallback(() => {
    setRefetchKey((k) => k + 1);
  }, []);

  return { data, loading, error, isOffline, refetch };
}

// ==================== SPECIFIC HOOKS ====================

/**
 * Hook to fetch leads with offline support.
 *
 * FIX: fetchFn and cacheFn are now wrapped in useCallback with stable empty
 * deps so the same function reference is passed on every render. This is a
 * belt-and-suspenders measure on top of the ref fix in useOfflineData — it
 * also makes the intent explicit and safe if the generic hook is ever changed.
 */
export function useLeadsData() {
  const fetchFn = useCallback(async () => {
    const response = await fetch('/api/leads?limit=10');
    if (!response.ok) throw new Error('Failed to fetch leads');
    const data = await response.json();
    return data.leads || [];
  }, []);

  const cacheFn = useCallback(async () => {
    return getCachedLeads();
  }, []);

  return useOfflineData(fetchFn, cacheFn);
}

/**
 * Hook to fetch users with offline support.
 */
export function useUsersData() {
  const fetchFn = useCallback(async () => {
    const response = await fetch('/api/users?limit=10');
    if (!response.ok) throw new Error('Failed to fetch users');
    const data = await response.json();
    return data.users || [];
  }, []);

  const cacheFn = useCallback(async () => {
    return getCachedUsers();
  }, []);

  return useOfflineData(fetchFn, cacheFn);
}

/**
 * Hook to fetch users by role with offline support.
 *
 * NOTE: `role` is included in useCallback deps so the fetch URL updates
 * correctly if the role prop changes, while still being stable when it doesn't.
 */
export function useUsersByRole(role: string) {
  const fetchFn = useCallback(async () => {
    const response = await fetch(`/api/users?role=${role}&limit=10`);
    if (!response.ok) throw new Error(`Failed to fetch ${role} users`);
    const data = await response.json();
    return data.users || [];
  }, [role]);

  const cacheFn = useCallback(async () => {
    const allUsers = await getCachedUsers();
    return allUsers.filter((u) => u.role === role);
  }, [role]);

  return useOfflineData(fetchFn, cacheFn);
}

/**
 * Hook to fetch announcements with offline support.
 */
export function useAnnouncementsData() {
  const fetchFn = useCallback(async () => {
    const response = await fetch('/api/announcements/active');
    if (!response.ok) throw new Error('Failed to fetch announcements');
    const data = await response.json();
    return data.announcements || [];
  }, []);

  const cacheFn = useCallback(async () => {
    return getCachedAnnouncements();
  }, []);

  return useOfflineData(fetchFn, cacheFn);
}

/**
 * Hook to fetch admin stats with offline support.
 */
export function useStatsData() {
  const fetchFn = useCallback(async () => {
    const response = await fetch('/api/admin/stats');
    if (!response.ok) throw new Error('Failed to fetch stats');
    return response.json();
  }, []);

  const cacheFn = useCallback(async () => {
    const stats = await getCachedStats();
    if (!stats) throw new Error('No cached stats available');
    return stats;
  }, []);

  return useOfflineData(fetchFn, cacheFn);
}

/**
 * Hook to fetch activity logs with offline support.
 */
export function useActivityLogsData() {
  const fetchFn = useCallback(async () => {
    const response = await fetch('/api/admin/activity-log?limit=10');
    if (!response.ok) throw new Error('Failed to fetch activity logs');
    const data = await response.json();
    return data.logs || [];
  }, []);

  const cacheFn = useCallback(async () => {
    return getCachedActivityLogs();
  }, []);

  return useOfflineData(fetchFn, cacheFn);
}

/**
 * Hook to fetch SMS logs with offline support.
 */
export function useSMSLogsData() {
  const fetchFn = useCallback(async () => {
    const response = await fetch('/api/admin/sms-logs?limit=10');
    if (!response.ok) throw new Error('Failed to fetch SMS logs');
    const data = await response.json();
    return data.smsLogs || [];
  }, []);

  const cacheFn = useCallback(async () => {
    return getCachedSMSLogs();
  }, []);

  return useOfflineData(fetchFn, cacheFn);
}

// ==================== PAGINATION HOOK ====================

/**
 * Hook for paginated offline data. Pure calculation — no side effects.
 */
export function usePaginatedOfflineData<T extends { _id: string }>(
  allData: T[],
  itemsPerPage: number = 10,
  currentPage: number = 1
): {
  data: T[];
  total: number;
  totalPages: number;
  currentPage: number;
  hasNext: boolean;
  hasPrev: boolean;
} {
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = allData.slice(startIndex, endIndex);
  const totalPages = Math.ceil(allData.length / itemsPerPage);

  return {
    data: paginatedData,
    total: allData.length,
    totalPages,
    currentPage,
    hasNext: currentPage < totalPages,
    hasPrev: currentPage > 1,
  };
}