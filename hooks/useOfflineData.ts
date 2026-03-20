'use client';

/**
 * Offline-aware data hooks
 * These hooks automatically use cached data when offline
 */

import { useEffect, useState, useCallback } from 'react';
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

// ==================== HOOKS ====================

/**
 * Generic hook for fetching data with offline fallback
 *
 * @param fetchFn - Function to fetch data online
 * @param cacheFn - Function to fetch data from cache
 * @param deps - Dependencies for useEffect
 * @returns { data, loading, error, isOffline, refetch }
 */
function useOfflineData<T>(
  fetchFn: () => Promise<T>,
  cacheFn: () => Promise<T>
): {
  data: T | null;
  loading: boolean;
  error: Error | null;
  isOffline: boolean;
  refetch: () => Promise<void>;
} {
  const { isOnline } = useSync();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (isOnline) {
        // Try to fetch from API first
        try {
          const result = await fetchFn();
          setData(result);
          setIsOffline(false);
        } catch (fetchError) {
          // Fall back to cache on error
          console.warn('API fetch failed, using cached data:', fetchError);
          const cached = await cacheFn();
          setData(cached);
          setIsOffline(true);
          setError(
            fetchError instanceof Error
              ? fetchError
              : new Error('Failed to fetch data')
          );
        }
      } else {
        // Offline - use cache
        const cached = await cacheFn();
        setData(cached);
        setIsOffline(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [isOnline, fetchFn, cacheFn]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return { data, loading, error, isOffline, refetch: loadData };
}

// ==================== SPECIFIC HOOKS ====================

/**
 * Hook to fetch leads with offline support
 */
export function useLeadsData() {
  return useOfflineData(
    async () => {
      const response = await fetch('/api/leads?limit=1000');
      if (!response.ok) throw new Error('Failed to fetch leads');
      const data = await response.json();
      return data.leads || [];
    },
    async () => {
      return getCachedLeads();
    }
  );
}

/**
 * Hook to fetch users with offline support
 */
export function useUsersData() {
  return useOfflineData(
    async () => {
      const response = await fetch('/api/users?limit=500');
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      return data.users || [];
    },
    async () => {
      return getCachedUsers();
    }
  );
}

/**
 * Hook to fetch users by role with offline support
 */
export function useUsersByRole(role: string) {
  return useOfflineData(
    async () => {
      const response = await fetch(`/api/users?role=${role}&limit=500`);
      if (!response.ok) throw new Error(`Failed to fetch ${role} users`);
      const data = await response.json();
      return data.users || [];
    },
    async () => {
      const allUsers = await getCachedUsers();
      return allUsers.filter((u) => u.role === role);
    }
  );
}

/**
 * Hook to fetch announcements with offline support
 */
export function useAnnouncementsData() {
  return useOfflineData(
    async () => {
      const response = await fetch('/api/announcements/active');
      if (!response.ok) throw new Error('Failed to fetch announcements');
      const data = await response.json();
      return data.announcements || [];
    },
    async () => {
      return getCachedAnnouncements();
    }
  );
}

/**
 * Hook to fetch admin stats with offline support
 */
export function useStatsData() {
  return useOfflineData(
    async () => {
      const response = await fetch('/api/admin/stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
    async () => {
      const stats = await getCachedStats();
      if (!stats) {
        throw new Error('No cached stats available');
      }
      return stats;
    }
  );
}

/**
 * Hook to fetch activity logs with offline support
 */
export function useActivityLogsData() {
  return useOfflineData(
    async () => {
      const response = await fetch('/api/admin/activity-log?limit=100');
      if (!response.ok) throw new Error('Failed to fetch activity logs');
      const data = await response.json();
      return data.logs || [];
    },
    async () => {
      return getCachedActivityLogs();
    }
  );
}

/**
 * Hook to fetch SMS logs with offline support
 */
export function useSMSLogsData() {
  return useOfflineData(
    async () => {
      const response = await fetch('/api/admin/sms-logs?limit=100');
      if (!response.ok) throw new Error('Failed to fetch SMS logs');
      const data = await response.json();
      return data.smsLogs || [];
    },
    async () => {
      return getCachedSMSLogs();
    }
  );
}

// ==================== PAGINATION HOOKS ====================

/**
 * Hook for paginated offline data
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
