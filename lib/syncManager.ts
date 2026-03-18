/**
 * Sync Manager Service
 * Handles syncing offline leads to the server when connection is restored
 */

import {
  getPendingLeads,
  updateLeadSyncStatus,
  deleteOfflineLead,
  OfflineLead,
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
let currentSyncStatus: SyncStatus = {
  isOnline: navigator.onLine,
  isSyncing: false,
  pendingCount: 0,
};
let healthCheckInterval: NodeJS.Timeout | null = null;

/**
 * Check actual network connectivity by making a lightweight request
 */
async function verifyNetworkConnectivity(): Promise<boolean> {
  try {
    // Use a lightweight endpoint or a no-op request to verify connectivity
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch('/api/health', {
      method: 'HEAD',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok || response.status === 404; // 404 is fine, we just need to know we can reach the server
  } catch (error) {
    // Network error - truly offline
    return false;
  }
}

/**
 * Periodic health check to verify actual network status
 */
async function performHealthCheck(): Promise<void> {
  try {
    const isActuallyOnline = await verifyNetworkConnectivity();

    // Only update if status has changed
    if (isActuallyOnline !== currentSyncStatus.isOnline) {
      currentSyncStatus.isOnline = isActuallyOnline;
      notifyStatusChange();

      if (isActuallyOnline) {
        console.log('Network restored - starting sync');
        await syncOfflineLeads();
      } else {
        console.log('Network disconnected detected');
      }
    }
  } catch (error) {
    console.error('Error performing health check:', error);
  }
}

/**
 * Initialize sync manager and network monitoring
 */
export async function initializeSyncManager(): Promise<void> {
  try {
    // Update initial pending count
    const pending = await getPendingLeads();
    currentSyncStatus.pendingCount = pending.length;
    notifyStatusChange();

    // Listen for online/offline events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Start periodic health check every 10 seconds
    // This catches cases where navigator.onLine gets stuck
    healthCheckInterval = setInterval(() => {
      performHealthCheck();
    }, 10000);

    // Initial sync if online
    if (navigator.onLine) {
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

  // Return unsubscribe function
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
 * Handle online event
 */
function handleOnline(): void {
  currentSyncStatus.isOnline = true;
  notifyStatusChange();
  syncOfflineLeads();
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

        // Send to server
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
          const errorData = await response.json();
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

    // Update pending count
    const remaining = await getPendingLeads();
    currentSyncStatus.pendingCount = remaining.length;
    currentSyncStatus.lastSyncTime = new Date();
    currentSyncStatus.error = failureCount > 0 ? `${failureCount} lead(s) failed to sync` : undefined;

    console.log(`Sync complete: ${successCount} succeeded, ${failureCount} failed`);
  } catch (error) {
    currentSyncStatus.error = error instanceof Error ? error.message : 'Unknown error';
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