'use client';

/**
 * SyncProvider Component
 * Provides offline sync status to the entire app via context.
 *
 * Design decisions:
 * - Subscribe to status changes BEFORE initializing, so we never miss the
 *   first health-check broadcast that fires during init.
 * - Start with isOnline: true as a safe SSR default; the real status is pushed
 *   via onSyncStatusChange as soon as initializeSyncManager completes.
 * - Expose isReady so consumers can defer rendering until sync is initialized.
 */

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  initializeSyncManager,
  cleanupSyncManager,
  onSyncStatusChange,
  triggerManualSync,
  forceCheckNetwork,
  getSyncStatus,
  clearOfflineData,
  type SyncStatus,
} from '@/lib/syncManager';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SyncContextType {
  isSyncing: boolean;
  isOnline: boolean;
  pendingCount: number;
  queuedOperationsCount: number;
  lastSyncTime?: Date;
  /** Surfaces both sync-manager errors and manual-action errors. */
  error?: string;
  isReady: boolean;
  manualSync: () => Promise<void>;
  checkNetwork: () => Promise<boolean>;
  clearCache: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const SyncContext = createContext<SyncContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: true,   // safe SSR default; corrected on first health check
    isSyncing: false,
    pendingCount: 0,
    queuedOperationsCount: 0,
  });
  const [isReady, setIsReady] = useState(false);
  const [manualSyncError, setManualSyncError] = useState<string | undefined>();

  // Guard against setting state after unmount (e.g. hot-reload race).
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    // Subscribe FIRST — any notifyStatusChange() fired during init will reach us.
    const unsubscribe = onSyncStatusChange((status) => {
      if (mountedRef.current) setSyncStatus(status);
    });

    initializeSyncManager()
      .then(() => {
        if (!mountedRef.current) return;
        // Pull latest status in case a synchronous set during init was missed.
        setSyncStatus(getSyncStatus());
        setIsReady(true);
      })
      .catch((err) => {
        // Init failure is non-fatal; we can still operate offline.
        console.error('[SyncProvider] initializeSyncManager failed:', err);
        if (mountedRef.current) setIsReady(true);
      });

    return () => {
      mountedRef.current = false;
      unsubscribe();
      cleanupSyncManager();
    };
  }, []);

  // ── Action handlers ────────────────────────────────────────────────────────

  const handleManualSync = async (): Promise<void> => {
    setManualSyncError(undefined);
    try {
      await triggerManualSync();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed';
      setManualSyncError(message);
      throw error;
    }
  };

  const handleCheckNetwork = async (): Promise<boolean> => {
    setManualSyncError(undefined);
    try {
      return await forceCheckNetwork();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Network check failed';
      setManualSyncError(message);
      throw error;
    }
  };

  const handleClearCache = async (): Promise<void> => {
    setManualSyncError(undefined);
    try {
      await clearOfflineData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Cache clear failed';
      setManualSyncError(message);
      throw error;
    }
  };

  // ── Context value ──────────────────────────────────────────────────────────

  const contextValue: SyncContextType = {
    isSyncing: syncStatus.isSyncing,
    isOnline: syncStatus.isOnline,
    pendingCount: syncStatus.pendingCount,
    queuedOperationsCount: syncStatus.queuedOperationsCount,
    lastSyncTime: syncStatus.lastSyncTime,
    // Manual errors take precedence so user-triggered feedback is always visible.
    error: manualSyncError ?? syncStatus.error,
    isReady,
    manualSync: handleManualSync,
    checkNetwork: handleCheckNetwork,
    clearCache: handleClearCache,
  };

  return <SyncContext.Provider value={contextValue}>{children}</SyncContext.Provider>;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Consume sync context. Must be used inside <SyncProvider>.
 */
export function useSyncStatus(): SyncContextType {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSyncStatus must be used within <SyncProvider>');
  }
  return context;
}

/** Convenience alias. */
export const useSync = useSyncStatus;