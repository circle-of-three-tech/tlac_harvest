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
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isSyncing: false,
    pendingCount: 0,
  });
  const [isReady, setIsReady] = useState(false);
  const [manualSyncError, setManualSyncError] = useState<string>();

  useEffect(() => {
    // Initialize sync manager
    initializeSyncManager().then(() => {
      setIsReady(true);
    });

    // Subscribe to status changes
    const unsubscribe = onSyncStatusChange((status) => {
      setSyncStatus(status);
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
