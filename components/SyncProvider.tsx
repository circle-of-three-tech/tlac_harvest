'use client';

/**
 * SyncProvider Component
 * Provides offline sync status to the entire app via context
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  initializeSyncManager,
  cleanupSyncManager,
  onSyncStatusChange,
  triggerManualSync,
  forceCheckNetwork,
  getSyncStatus,
  SyncStatus,
} from '@/lib/syncManager';

interface SyncContextType {
  isSyncing: boolean;
  isOnline: boolean;
  pendingCount: number;
  lastSyncTime?: Date;
  error?: string;
  manualSync: () => Promise<void>;
  checkNetwork: () => Promise<boolean>;
  isReady: boolean;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  // FIX: Start with a safe server-side default (isOnline: true, not
  // navigator.onLine which can be stale or undefined during SSR).
  // The real status will be pushed via onSyncStatusChange as soon as
  // initializeSyncManager completes its first health check.
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: true,
    isSyncing: false,
    pendingCount: 0,
  });
  const [isReady, setIsReady] = useState(false);
  const [manualSyncError, setManualSyncError] = useState<string>();

  useEffect(() => {
    // FIX: Subscribe FIRST so we never miss a notification fired during init.
    // Previously, initializeSyncManager() was awaited before subscribing,
    // meaning the corrected isOnline status from the first health check was
    // broadcast before any listener existed — so the UI never updated.
    const unsubscribe = onSyncStatusChange((status) => {
      setSyncStatus(status);
    });

    // Now initialize. Any notifyStatusChange() calls inside will reach us.
    initializeSyncManager().then(() => {
      // After init, pull the latest status in case we somehow missed a
      // notification (e.g. a synchronous status set during init).
      setSyncStatus(getSyncStatus());
      setIsReady(true);
    });

    return () => {
      unsubscribe();
      cleanupSyncManager();
    };
  }, []);

  const handleManualSync = async () => {
    try {
      setManualSyncError(undefined);
      await triggerManualSync();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setManualSyncError(message);
      throw error;
    }
  };

  const handleCheckNetwork = async () => {
    try {
      setManualSyncError(undefined);
      return await forceCheckNetwork();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setManualSyncError(message);
      throw error;
    }
  };

  const contextValue: SyncContextType = {
    isSyncing: syncStatus.isSyncing,
    isOnline: syncStatus.isOnline,
    pendingCount: syncStatus.pendingCount,
    lastSyncTime: syncStatus.lastSyncTime,
    error: syncStatus.error || manualSyncError,
    manualSync: handleManualSync,
    checkNetwork: handleCheckNetwork,
    isReady,
  };

  return <SyncContext.Provider value={contextValue}>{children}</SyncContext.Provider>;
}

/**
 * Hook to use sync context
 */
export function useSyncStatus() {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSyncStatus must be used within SyncProvider');
  }
  return context;
}