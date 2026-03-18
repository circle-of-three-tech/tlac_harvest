/**
 * Sync Manager Service
 * Handles syncing offline leads to the server when connection is restored
 */

import {
  getPendingLeads,
  updateLeadSyncStatus,
  deleteOfflineLead,
  // OfflineLead,
} from './offlineLeads';

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime?: Date;
  error?: string;
}

export type SyncStatusCallback = (status: SyncStatus) => void;

let syncStatusCallbacks: SyncStatusCallback[] = [];

// FIX 1: Don't initialize isOnline at module level — it may run on the server
// where navigator is undefined or unreliable. Start as true and let the first
// health check correct it. 
const currentSyncStatus: SyncStatus = {
  isOnline: true,
  isSyncing: false,
  pendingCount: 0,
};
let healthCheckInterval: NodeJS.Timeout | null = null;

/**
 * Check actual network connectivity by making a lightweight request.
 *
 * FIX 2: Accept ANY HTTP response as "online". Only a thrown network error
 * (no response at all) means the device is truly offline.
 */
async function verifyNetworkConnectivity(): Promise<boolean> {
  // Guard: can't run fetch on the server during SSR
  if (typeof window === 'undefined') return true;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    // FIX 3: Use cache: 'no-store' so a cached response doesn't mask real
    // offline state.
    await fetch('/api/health', {
      method: 'HEAD',
      signal: controller.signal,
      cache: 'no-store',
    });

    clearTimeout(timeoutId);
    // Any response (even 4xx/5xx) proves the network stack is working.
    return true;
  } catch {
    // AbortError = timeout, TypeError = no network — both mean offline.
    return false;
  }
}

/**
 * Periodic health check to verify actual network status
 */
async function performHealthCheck(): Promise<void> {
  try {
    const isActuallyOnline = await verifyNetworkConnectivity();

    // FIX 4: Always refresh pendingCount on each health check so the badge
    // stays accurate even without a status change.
    const pending = await getPendingLeads();
    currentSyncStatus.pendingCount = pending.length;

    if (isActuallyOnline !== currentSyncStatus.isOnline) {
      currentSyncStatus.isOnline = isActuallyOnline;
      notifyStatusChange();

      if (isActuallyOnline) {
        console.log('Network restored - starting sync');
        await syncOfflineLeads();
      } else {
        console.log('Network disconnection detected');
      }
    } else {
      // Still notify so pendingCount update reaches subscribers
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
    currentSyncStatus.pendingCount = pending.length;

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Perform immediate health check to get accurate initial status
    const isActuallyOnline = await verifyNetworkConnectivity();
    currentSyncStatus.isOnline = isActuallyOnline;
    notifyStatusChange();

    // Periodic check every 10 seconds as fallback for stuck navigator.onLine
    healthCheckInterval = setInterval(() => {
      performHealthCheck();
    }, 10000);

    if (isActuallyOnline) {
      await syncOfflineLeads();
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
 *
 * FIX 5: Don't trust the browser 'online' event blindly — it fires on captive
 * portals too. Verify with a real request before marking as online.
 */
async function handleOnline(): Promise<void> {
  const isActuallyOnline = await verifyNetworkConnectivity();
  currentSyncStatus.isOnline = isActuallyOnline;
  notifyStatusChange();
  if (isActuallyOnline) {
    await syncOfflineLeads();
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

/**
 * Sync all pending offline leads to the server
 */
export async function syncOfflineLeads(): Promise<void> {
  if (currentSyncStatus.isSyncing || !currentSyncStatus.isOnline) {
    return;
  }

  currentSyncStatus.isSyncing = true;
  notifyStatusChange();

  try {
    const pendingLeads = await getPendingLeads();

    if (pendingLeads.length === 0) {
      currentSyncStatus.isSyncing = false;
      notifyStatusChange();
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
          // FIX 6: Guard against response.json() throwing on non-JSON error bodies
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

    console.log(`Sync complete: ${successCount} succeeded, ${failureCount} failed`);
  } catch (error) {
    currentSyncStatus.error =
      error instanceof Error ? error.message : 'Unknown error';
    console.error('Error during sync:', error);
  } finally {
    currentSyncStatus.isSyncing = false;
    notifyStatusChange();
  }
}

/**
 * Manually trigger sync (exposed for manual sync button)
 */
export async function triggerManualSync(): Promise<void> {
  if (!currentSyncStatus.isOnline) {
    throw new Error('Device is offline. Cannot sync.');
  }
  if (currentSyncStatus.isSyncing) {
    throw new Error('Sync is already in progress.');
  }
  await syncOfflineLeads();
}

/**
 * Force check network connectivity (useful for manual refresh)
 */
export async function forceCheckNetwork(): Promise<boolean> {
  const isOnline = await verifyNetworkConnectivity();

  if (isOnline !== currentSyncStatus.isOnline) {
    currentSyncStatus.isOnline = isOnline;
    notifyStatusChange();

    if (isOnline) {
      await syncOfflineLeads();
    }
  }

  return isOnline;
}