/**
 * Sync Manager Service
 * Handles syncing offline leads to the server when connection is restored
 * Also manages data caching for offline access
 */

import {
  getPendingLeads,
  updateLeadSyncStatus,
  deleteOfflineLead,
  cacheLeads,
  getCachedLeads,
  cacheUsers,
  getCachedUsers,
  cacheAnnouncements,
  getCachedAnnouncements,
  cacheStats,
  getCachedStats,
  cacheActivityLogs,
  getCachedActivityLogs,
  cacheSMSLogs,
  getCachedSMSLogs,
  getPendingNotes,
  updateNoteSyncStatus,
  deleteCachedNote,
  clearAllCachedData,
  type CachedLead,
  type CachedUser,
  type CachedAnnouncement,
  type CachedStats,
  type CachedActivityLog,
  type CachedSMSLog,
} from './offlineLeads';

import {
  getPendingOperations,
  getDedupedOperations,
  canRetryOperation,
  updateOperationStatus,
  deleteOperation,
  getFailedOperations,
  type QueuedOperation,
} from './operationQueue';

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  queuedOperationsCount: number;
  lastSyncTime?: Date;
  error?: string;
}

export type SyncStatusCallback = (status: SyncStatus) => void;

let syncStatusCallbacks: SyncStatusCallback[] = [];

// Don't initialize isOnline at module level — it may run on the server
// where navigator is undefined or unreliable. Start as true and let the first
// health check correct it.
const currentSyncStatus: SyncStatus = {
  isOnline: true,
  isSyncing: false,
  pendingCount: 0,
  queuedOperationsCount: 0,
};
let healthCheckInterval: NodeJS.Timeout | null = null;

// FIX: Track the current user's role so admin-only endpoints are only called
// when appropriate. Set via setCurrentUserRole() from SyncProvider on mount.
let currentUserRole: string | null = null;

/**
 * Call this from SyncProvider (or wherever you have session data) so the sync
 * manager knows which endpoints it is allowed to call.
 */
export function setCurrentUserRole(role: string | null): void {
  currentUserRole = role;
}

function isAdmin(): boolean {
  return currentUserRole === 'ADMIN';
}

/**
 * Check actual network connectivity by making a lightweight request.
 *
 * Accept ANY HTTP response as "online". Only a thrown network error
 * (no response at all) means the device is truly offline.
 *
 * Ignore 500 errors from /api/health — these usually mean the database
 * is down, not the network. We only care if the fetch itself fails.
 */
async function verifyNetworkConnectivity(): Promise<boolean> {
  // Guard: can't run fetch on the server during SSR
  if (typeof window === 'undefined') return true;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    // Use cache: 'no-store' so a cached response doesn't mask real offline state.
    const response = await fetch('/api/health', {
      method: 'HEAD',
      signal: controller.signal,
      cache: 'no-store',
    });

    clearTimeout(timeoutId);
    // Any response, even 500 (database down), means network is working.
    // Only thrown errors (network failure) mean we're truly offline.
    console.log(`Health check: ${response.status} - Network is up`);
    return true;
  } catch (error) {
    // AbortError = timeout, TypeError = no network — both mean offline.
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(`Health check failed: ${errorMsg} - Network appears down`);
    return false;
  }
}

/**
 * Periodic health check to verify actual network status
 */
async function performHealthCheck(): Promise<void> {
  try {
    const isActuallyOnline = await verifyNetworkConnectivity();

    // Always refresh counts on each health check
    const pending = await getPendingLeads();
    const queuedOps = await getPendingOperations();
    currentSyncStatus.pendingCount = pending.length;
    currentSyncStatus.queuedOperationsCount = queuedOps.length;

    if (isActuallyOnline !== currentSyncStatus.isOnline) {
      currentSyncStatus.isOnline = isActuallyOnline;
      notifyStatusChange();

      if (isActuallyOnline) {
        console.log('Network restored - starting sync');
        await syncOfflineData();
      } else {
        console.log('Network disconnection detected');
      }
    } else {
      // Still notify so count updates reach subscribers
      notifyStatusChange();
    }
  } catch (error) {
    console.error('Error performing health check:', error);
  }
}

/**
 * Initialize sync manager and network monitoring
 */
export async function initializeSyncManager(): Promise<void> {
  // Guard: window events are client-only
  if (typeof window === 'undefined') return;

  try {
    const pending = await getPendingLeads();
    const queuedOps = await getPendingOperations();
    currentSyncStatus.pendingCount = pending.length;
    currentSyncStatus.queuedOperationsCount = queuedOps.length;

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Perform immediate health check to get accurate initial status
    const isActuallyOnline = await verifyNetworkConnectivity();
    currentSyncStatus.isOnline = isActuallyOnline;
    notifyStatusChange();

    // Periodic check every 30 seconds as fallback for stuck navigator.onLine.
    // FIX: Increased from 10s — the old 10s interval combined with each check
    // triggering syncOfflineData (which calls refreshCachedData → multiple API
    // fetches) was a major contributor to the request flood.
    healthCheckInterval = setInterval(() => {
      performHealthCheck();
    }, 30000);

    if (isActuallyOnline) {
      await syncOfflineData();
    }
  } catch (error) {
    console.error('Error initializing sync manager:', error);
  }
}

/**
 * Cleanup sync manager
 */
export function cleanupSyncManager(): void {
  if (typeof window === 'undefined') return;

  window.removeEventListener('online', handleOnline);
  window.removeEventListener('offline', handleOffline);
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
}

/**
 * Subscribe to sync status changes
 */
export function onSyncStatusChange(callback: SyncStatusCallback): () => void {
  syncStatusCallbacks.push(callback);
  return () => {
    syncStatusCallbacks = syncStatusCallbacks.filter((cb) => cb !== callback);
  };
}

/**
 * Get current sync status
 */
export function getSyncStatus(): SyncStatus {
  return { ...currentSyncStatus };
}

/**
 * Handle online event.
 * Verify with a real request before marking as online and starting sync.
 */
async function handleOnline(): Promise<void> {
  const isActuallyOnline = await verifyNetworkConnectivity();
  currentSyncStatus.isOnline = isActuallyOnline;
  notifyStatusChange();
  if (isActuallyOnline) {
    await syncOfflineData();
  }
}

/**
 * Handle offline event
 */
function handleOffline(): void {
  currentSyncStatus.isOnline = false;
  notifyStatusChange();
}

/**
 * Notify all listeners of status change
 */
function notifyStatusChange(): void {
  syncStatusCallbacks.forEach((callback) => {
    try {
      callback({ ...currentSyncStatus });
    } catch (error) {
      console.error('Error in sync status callback:', error);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL helpers — these do the real work but do NOT touch isSyncing.
// Only the public-facing functions (syncOfflineLeads, syncOfflineData) own the
// flag, which prevents the double-reset bug where syncOfflineLeads' finally
// block was clearing isSyncing while syncOfflineData was still running.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Internal: sync pending offline leads without touching isSyncing flag.
 */
async function _syncOfflineLeadsInternal(): Promise<void> {
  const pendingLeads = await getPendingLeads();

  if (pendingLeads.length === 0) {
    return;
  }

  console.log(`Syncing ${pendingLeads.length} offline leads...`);

  let successCount = 0;
  let failureCount = 0;

  for (const lead of pendingLeads) {
    try {
      await updateLeadSyncStatus(lead.id, 'syncing');
      notifyStatusChange();

      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: lead.fullName,
          ageRange: lead.ageRange,
          phone: lead.phone,
          address: lead.address,
          location: lead.location,
          additionalNotes: lead.additionalNotes,
          soulState: lead.soulState,
          gender: lead.gender,
        }),
      });

      if (response.ok) {
        await deleteOfflineLead(lead.id);
        successCount++;
        console.log(`✓ Synced lead: ${lead.fullName}`);
      } else {
        // Guard against response.json() throwing on non-JSON error bodies
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error || `HTTP ${response.status}`;
        await updateLeadSyncStatus(lead.id, 'failed', errorMsg);
        failureCount++;
        console.error(`✗ Failed to sync lead ${lead.fullName}:`, errorMsg);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Network error';
      await updateLeadSyncStatus(lead.id, 'failed', errorMsg);
      failureCount++;
      console.error(`✗ Error syncing lead ${lead.fullName}:`, error);
    }

    notifyStatusChange();
  }

  const remaining = await getPendingLeads();
  currentSyncStatus.pendingCount = remaining.length;
  currentSyncStatus.lastSyncTime = new Date();
  currentSyncStatus.error =
    failureCount > 0 ? `${failureCount} lead(s) failed to sync` : undefined;

  console.log(`Lead sync complete: ${successCount} succeeded, ${failureCount} failed`);
}

/**
 * Internal: sync queued operations without touching isSyncing flag.
 */
async function _syncQueuedOperationsInternal(): Promise<void> {
  const pendingOps = await getDedupedOperations();

  if (pendingOps.length === 0) {
    return;
  }

  console.log(`Syncing ${pendingOps.length} queued operations...`);

  let successCount = 0;
  let failureCount = 0;

  for (const op of pendingOps) {
    try {
      await updateOperationStatus(op.id!, 'syncing');

      let response: Response;
      let syncSuccess = false;

      switch (op.type) {
        case 'update': {
          response = await fetch(`/api/leads/${op.resourceId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(op.payload),
          });
          syncSuccess = response.ok;
          break;
        }

        case 'delete': {
          response = await fetch(`/api/leads/${op.resourceId}`, {
            method: 'DELETE',
          });
          syncSuccess = response.ok;
          break;
        }

        case 'addNote': {
          response = await fetch(`/api/leads/${op.payload.leadId}/notes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: op.payload.content }),
          });
          syncSuccess = response.ok;
          break;
        }

        case 'reassign': {
          response = await fetch(`/api/leads/${op.resourceId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assignedTo: op.payload.assignedTo }),
          });
          syncSuccess = response.ok;
          break;
        }

        default: {
          console.warn(`Unknown operation type: ${(op as any).type} — skipping`);
          continue;
        }
      }

      if (syncSuccess) {
        await deleteOperation(op.id!);
        successCount++;
        console.log(`✓ Synced operation: ${op.type} on ${op.resourceId}`);
      } else {
        const errorData = await response!.json().catch(() => ({}));
        const errorMsg = errorData.error || `HTTP ${response!.status}`;
        await updateOperationStatus(op.id!, 'failed', errorMsg);
        failureCount++;
        console.error(
          `✗ Failed to sync operation ${op.type} on ${op.resourceId}:`,
          errorMsg
        );
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Network error';
      await updateOperationStatus(op.id!, 'failed', errorMsg);
      failureCount++;
      console.error(`✗ Error syncing operation:`, error);
    }

    notifyStatusChange();
  }

  const remaining = await getPendingOperations();
  currentSyncStatus.queuedOperationsCount = remaining.length;

  console.log(
    `Operation sync complete: ${successCount} succeeded, ${failureCount} failed`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC sync functions — these own the isSyncing flag
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sync pending offline leads only.
 * Safe to call standalone — manages isSyncing flag independently.
 */
export async function syncOfflineLeads(): Promise<void> {
  if (currentSyncStatus.isSyncing || !currentSyncStatus.isOnline) {
    return;
  }

  currentSyncStatus.isSyncing = true;
  notifyStatusChange();

  try {
    await _syncOfflineLeadsInternal();
  } catch (error) {
    currentSyncStatus.error =
      error instanceof Error ? error.message : 'Unknown error';
    console.error('Error during lead sync:', error);
  } finally {
    currentSyncStatus.isSyncing = false;
    notifyStatusChange();
  }
}

/**
 * Sync all queued operations only.
 * Safe to call standalone — manages isSyncing flag independently.
 */
export async function syncQueuedOperations(): Promise<void> {
  if (currentSyncStatus.isSyncing || !currentSyncStatus.isOnline) {
    return;
  }

  currentSyncStatus.isSyncing = true;
  notifyStatusChange();

  try {
    await _syncQueuedOperationsInternal();
  } catch (error) {
    currentSyncStatus.error =
      error instanceof Error ? error.message : 'Unknown error';
    console.error('Error during operation sync:', error);
  } finally {
    currentSyncStatus.isSyncing = false;
    notifyStatusChange();
  }
}

/**
 * Master sync function — coordinates all offline data syncing.
 * Handles: offline lead creation, queued operations, and cache refresh.
 *
 * FIX: Previously this called syncOfflineLeads() and syncQueuedOperations()
 * which each had their own isSyncing guards and finally resets. That caused
 * the flag to be cleared mid-execution, allowing concurrent syncs to start
 * and producing the request flood seen in the logs.
 *
 * Now it calls the internal helpers directly so only ONE isSyncing flag
 * lifecycle exists for the entire orchestrated sync.
 */
export async function syncOfflineData(): Promise<void> {
  if (currentSyncStatus.isSyncing || !currentSyncStatus.isOnline) {
    return;
  }

  currentSyncStatus.isSyncing = true;
  notifyStatusChange();

  try {
    await _syncOfflineLeadsInternal();
    await _syncQueuedOperationsInternal();
    await refreshCachedData();

    currentSyncStatus.lastSyncTime = new Date();
  } catch (error) {
    currentSyncStatus.error =
      error instanceof Error ? error.message : 'Unknown error';
    console.error('Error during full data sync:', error);
  } finally {
    currentSyncStatus.isSyncing = false;
    notifyStatusChange();
  }
}

/**
 * Manually trigger a full sync (e.g. from a "Sync now" button).
 */
export async function triggerManualSync(): Promise<void> {
  if (!currentSyncStatus.isOnline) {
    throw new Error('Device is offline. Cannot sync.');
  }
  if (currentSyncStatus.isSyncing) {
    throw new Error('Sync is already in progress.');
  }
  await syncOfflineData();
}

/**
 * Force check network connectivity (useful for manual refresh).
 */
export async function forceCheckNetwork(): Promise<boolean> {
  const isOnline = await verifyNetworkConnectivity();

  if (isOnline !== currentSyncStatus.isOnline) {
    currentSyncStatus.isOnline = isOnline;
    notifyStatusChange();

    if (isOnline) {
      await syncOfflineData();
    }
  }

  return isOnline;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cache refresh functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Refresh all cached data from the server.
 *
 * FIX: Admin-only endpoints (/api/admin/*) are now gated behind isAdmin().
 * Previously every user triggered 401/403 errors on these endpoints on every
 * sync cycle, which was noisy and wasteful.
 */
export async function refreshCachedData(): Promise<void> {
  if (!currentSyncStatus.isOnline) {
    return;
  }

  try {
    const commonRequests = [
      loadCachedLeads(),
      loadCachedUsers(),
      loadCachedAnnouncements(),
    ];

    // Only request admin data if the current user has the ADMIN role
    const adminRequests = isAdmin()
      ? [loadCachedStats(), loadCachedActivityLogs(), loadCachedSMSLogs()]
      : [];

    await Promise.all([...commonRequests, ...adminRequests]).catch((error) => {
      console.warn('Error refreshing some cached data:', error);
      // Don't throw — partial cache is better than no cache
    });
  } catch (error) {
    console.error('Error refreshing cached data:', error);
  }
}

/**
 * Load and cache leads from API.
 *
 * FIX: Map lead.id (Prisma) with fallback to lead._id (legacy/MongoDB) so
 * the _id field is always populated and cacheLeads() doesn't silently skip
 * every record.
 */
export async function loadCachedLeads(): Promise<void> {
  try {
    const response = await fetch('/api/leads?limit=1000', {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Failed to load leads: ${response.status}`);
    }

    const data = await response.json();
    const leads: CachedLead[] = (data.leads || []).map((lead: any) => ({
      // FIX: Prisma returns `id`, not `_id`. Fall back to _id for safety.
      _id: lead?.id ?? lead?._id,
      fullName: lead.fullName,
      ageRange: lead.ageRange,
      phone: lead.phone,
      address: lead.address,
      location: lead.location,
      additionalNotes: lead.additionalNotes,
      soulState: lead.soulState,
      gender: lead.gender,
      createdByName: lead.createdByName,
      assignedTo: lead.assignedTo,
      status: lead.status,
    }));

    await cacheLeads(leads);
    console.log(`Cached ${leads.length} leads`);
  } catch (error) {
    console.warn('Error loading cached leads:', error);
  }
}

/**
 * Load and cache users from API.
 *
 * FIX: Map user.id (Prisma) with fallback to user._id (legacy/MongoDB).
 */
export async function loadCachedUsers(): Promise<void> {
  try {
    const response = await fetch('/api/users?limit=500', {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Failed to load users: ${response.status}`);
    }

    const data = await response.json();
    const users: CachedUser[] = (data.users || []).map((user: any) => ({
      // FIX: Prisma returns `id`, not `_id`. Fall back to _id for safety.
      _id: user?.id ?? user?._id,
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      role: user.role,
      verified: user.verified,
    }));

    await cacheUsers(users);
    console.log(`Cached ${users.length} users`);
  } catch (error) {
    console.warn('Error loading cached users:', error);
  }
}

/**
 * Load and cache announcements from API.
 */
export async function loadCachedAnnouncements(): Promise<void> {
  try {
    const response = await fetch('/api/announcements/active', {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Failed to load announcements: ${response.status}`);
    }

    const data = await response.json();
    const announcements: CachedAnnouncement[] = (data.announcements || []).map(
      (ann: any) => ({
        _id: ann?.id ?? ann?._id,
        title: ann.title,
        message: ann.content,
        priority: ann.priority,
        createdAt: ann.createdAt,
      })
    );

    await cacheAnnouncements(announcements);
    console.log(`Cached ${announcements.length} announcements`);
  } catch (error) {
    console.warn('Error loading cached announcements:', error);
  }
}

/**
 * Load and cache admin stats.
 * Only call this when the user is an admin (enforced via refreshCachedData).
 */
export async function loadCachedStats(): Promise<void> {
  try {
    const response = await fetch('/api/admin/stats', {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Failed to load stats: ${response.status}`);
    }

    const stats: CachedStats = await response.json();
    await cacheStats(stats);
    console.log('Cached admin stats');
  } catch (error) {
    console.warn('Error loading cached stats:', error);
  }
}

/**
 * Load and cache activity logs.
 * Only call this when the user is an admin (enforced via refreshCachedData).
 */
export async function loadCachedActivityLogs(): Promise<void> {
  try {
    const response = await fetch('/api/admin/activity-log?limit=100', {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Failed to load activity logs: ${response.status}`);
    }

    const data = await response.json();
    const logs: CachedActivityLog[] = (data.logs || []).map((log: any) => ({
      _id: log?.id ?? log?._id,
      userId: log.userId,
      userName: log.userName,
      action: log.action,
      resourceType: log.resourceType,
      timestamp: log.timestamp,
    }));

    await cacheActivityLogs(logs);
    console.log(`Cached ${logs.length} activity logs`);
  } catch (error) {
    console.warn('Error loading cached activity logs:', error);
  }
}

/**
 * Load and cache SMS logs.
 * Only call this when the user is an admin (enforced via refreshCachedData).
 */
export async function loadCachedSMSLogs(): Promise<void> {
  try {
    const response = await fetch('/api/admin/sms-logs?limit=100', {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Failed to load SMS logs: ${response.status}`);
    }

    const data = await response.json();
    const logs: CachedSMSLog[] = (data.smsLogs || []).map((log: any) => ({
      _id: log.id ?? log._id,
      phone: log.phone,
      message: log.message,
      status: log.status,
      createdAt: log.createdAt,
    }));

    await cacheSMSLogs(logs);
    console.log(`Cached ${logs.length} SMS logs`);
  } catch (error) {
    console.warn('Error loading cached SMS logs:', error);
  }
}

/**
 * Clear all offline/cached data (call on logout).
 */
export async function clearOfflineData(): Promise<void> {
  try {
    await clearAllCachedData();
    currentUserRole = null;
    console.log('Cleared all offline data');
  } catch (error) {
    console.error('Error clearing offline data:', error);
  }
}