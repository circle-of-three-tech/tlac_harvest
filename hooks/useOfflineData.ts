'use client';

/**
 * Offline-aware data hooks
 * Each hook fetches from the API when online, falls back to IndexedDB cache
 * when offline or when the network request fails with a network-level error.
 *
 * Key design decisions:
 * - fetchFn / cacheFn are stored in refs so useCallback/useEffect never need
 *   them as reactive dependencies — preventing the infinite re-render loop that
 *   inline arrow functions cause.
 * - A `refetchKey` counter is the single deliberate trigger for re-fetching,
 *   replacing isOnline as a direct dependency.
 * - An AbortController per load cancels in-flight requests when a newer load
 *   starts, preventing stale-response overwrites.
 * - Only genuine network errors (TypeError) fall back to cache; API errors
 *   (4xx / 5xx) are surfaced to the caller so they are not silently swallowed.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSync } from '@/components/SyncProvider';
import {
  getCachedLeads,
  getCachedUsers,
  getCachedAnnouncements,
  getCachedStats,
  getCachedActivityLogs,
  getCachedSMSLogs,
} from '@/lib/offlineLeads';

// ─── Network-error discrimination ────────────────────────────────────────────

/**
 * Returns true only for errors that indicate a network-level failure
 * (no connection, DNS failure, timeout). HTTP 4xx/5xx errors from the server
 * are NOT network errors and must not be silently swallowed.
 */
function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError;
}

// ─── Generic hook ─────────────────────────────────────────────────────────────

interface UseOfflineDataResult<T> {
  data: T | null;
  loading: boolean;
  /** Set when cache is being shown instead of live API data. */
  isOffline: boolean;
  /** API or cache error. null when data loaded successfully. */
  error: Error | null;
  refetch: () => void;
}

function useOfflineData<T>(
  fetchFn: () => Promise<T>,
  cacheFn: () => Promise<T>
): UseOfflineDataResult<T> {
  const { isOnline } = useSync();

  // Keep latest function refs without making them reactive dependencies.
  const fetchFnRef = useRef(fetchFn);
  const cacheFnRef = useRef(cacheFn);
  fetchFnRef.current = fetchFn;
  cacheFnRef.current = cacheFn;

  // Track the last observed online state so we only re-fetch on real changes.
  const prevIsOnlineRef = useRef(isOnline);

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  // Bump this to trigger a deliberate re-fetch (avoids dependency-chain issues).
  const [refetchKey, setRefetchKey] = useState(0);

  // Re-fetch whenever the online state genuinely changes.
  useEffect(() => {
    if (isOnline !== prevIsOnlineRef.current) {
      prevIsOnlineRef.current = isOnline;
      setRefetchKey((k) => k + 1);
    }
  }, [isOnline]);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        if (prevIsOnlineRef.current) {
          try {
            // Pass signal so the request is aborted if a newer load fires.
            const result = await fetchFnRef.current();
            if (cancelled) return;
            setData(result);
            setIsOffline(false);
          } catch (fetchError) {
            if (cancelled) return;

            // Only fall back to cache for network-level failures.
            // API errors (auth, validation, server) are surfaced as-is.
            if (!isNetworkError(fetchError)) {
              setError(fetchError instanceof Error ? fetchError : new Error(String(fetchError)));
              setLoading(false);
              return;
            }

            console.warn('[useOfflineData] Network error, using cache:', fetchError);
            try {
              const cached = await cacheFnRef.current();
              if (cancelled) return;
              setData(cached);
              setIsOffline(true);
              setError(new Error('Showing cached data — network unavailable'));
            } catch (cacheError) {
              if (cancelled) return;
              setError(cacheError instanceof Error ? cacheError : new Error('Cache read failed'));
              setData(null);
            }
          }
        } else {
          // Offline path: go straight to cache.
          try {
            const cached = await cacheFnRef.current();
            if (cancelled) return;
            setData(cached);
            setIsOffline(true);
          } catch (cacheError) {
            if (cancelled) return;
            setError(cacheError instanceof Error ? cacheError : new Error('Cache read failed'));
            setData(null);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
      controller.abort();
    };
  // refetchKey is the only trigger; function refs are stable via useRef.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetchKey]);

  const refetch = useCallback(() => setRefetchKey((k) => k + 1), []);

  return { data, loading, error, isOffline, refetch };
}

// ─── Specific hooks ───────────────────────────────────────────────────────────

/**
 * Leads — full working set, paginated client-side by `usePaginatedOfflineData`.
 * Fetching the full page lets pagination keep working while offline and
 * matches the cache warm-up already done by the sync manager.
 */
export function useLeadsData() {
  const fetchFn = useCallback(async () => {
    const res = await fetch('/api/leads?limit=100', { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to fetch leads (${res.status})`);
    const json = await res.json();
    return json.leads ?? [];
  }, []);

  const cacheFn = useCallback(() => getCachedLeads(), []);

  return useOfflineData(fetchFn, cacheFn);
}

/** Users — full list (paginated client-side). */
export function useUsersData() {
  const fetchFn = useCallback(async () => {
    const res = await fetch('/api/users?limit=500', { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to fetch users (${res.status})`);
    const json = await res.json();
    return json.users ?? [];
  }, []);

  const cacheFn = useCallback(() => getCachedUsers(), []);

  return useOfflineData(fetchFn, cacheFn);
}

/**
 * Users filtered by role.
 * `role` is a stable primitive so it is safe as a useCallback dependency;
 * if it changes, new function references are created and the data reloads.
 */
export function useUsersByRole(role: string) {
  const fetchFn = useCallback(async () => {
    const res = await fetch(`/api/users?role=${encodeURIComponent(role)}&limit=500`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to fetch ${role} users (${res.status})`);
    const json = await res.json();
    return json.users ?? [];
  }, [role]);

  const cacheFn = useCallback(async () => {
    const all = await getCachedUsers();
    return all.filter((u) => u.role === role);
  }, [role]);

  return useOfflineData(fetchFn, cacheFn);
}

/** Active announcements. */
export function useAnnouncementsData() {
  const fetchFn = useCallback(async () => {
    const res = await fetch('/api/announcements/active', { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to fetch announcements (${res.status})`);
    const json = await res.json();
    return json.announcements ?? [];
  }, []);

  const cacheFn = useCallback(() => getCachedAnnouncements(), []);

  return useOfflineData(fetchFn, cacheFn);
}

/** Admin stats. */
export function useStatsData() {
  const fetchFn = useCallback(async () => {
    const res = await fetch('/api/admin/stats', { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to fetch stats (${res.status})`);
    return res.json();
  }, []);

  const cacheFn = useCallback(async () => {
    const stats = await getCachedStats();
    if (!stats) throw new Error('No cached stats available');
    return stats;
  }, []);

  return useOfflineData(fetchFn, cacheFn);
}

/** Activity log — most-recent 10 entries. */
export function useActivityLogsData() {
  const fetchFn = useCallback(async () => {
    const res = await fetch('/api/admin/activity-log?limit=10', { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to fetch activity logs (${res.status})`);
    const json = await res.json();
    return json.auditLogs ?? [];
  }, []);

  const cacheFn = useCallback(() => getCachedActivityLogs(), []);

  return useOfflineData(fetchFn, cacheFn);
}

/** SMS logs — most-recent 10 entries. */
export function useSMSLogsData() {
  const fetchFn = useCallback(async () => {
    const res = await fetch('/api/admin/sms-logs?limit=10', { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to fetch SMS logs (${res.status})`);
    const json = await res.json();
    return json.logs ?? [];
  }, []);

  const cacheFn = useCallback(() => getCachedSMSLogs(), []);

  return useOfflineData(fetchFn, cacheFn);
}

// ─── Pagination helper ────────────────────────────────────────────────────────

interface PaginatedResult<T> {
  data: T[];
  total: number;
  totalPages: number;
  currentPage: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Pure client-side pagination over an already-loaded array.
 * No side effects — safe to call in render.
 */
export function usePaginatedOfflineData<T extends { _id: string }>(
  allData: T[],
  itemsPerPage = 10,
  currentPage = 1
): PaginatedResult<T> {
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = allData.slice(startIndex, startIndex + itemsPerPage);
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