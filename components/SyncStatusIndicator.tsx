'use client';

/**
 * SyncStatusIndicator Component
 * Displays sync status and pending-operation count with visual indicators.
 *
 * Renders nothing when online with no pending work.
 * Shows a toast for action feedback (success or error).
 * Respects `isReady` so the indicator never flashes a stale online state
 * during the sync-manager init window.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2, Wifi, WifiOff } from 'lucide-react';
import { useSyncStatus } from './SyncProvider';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ToastState {
  message: string;
  type: 'success' | 'error';
}

// ─── Toast hook ───────────────────────────────────────────────────────────────

const TOAST_DURATION_MS = 3500;

function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string, type: ToastState['type']) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ message, type });
    timerRef.current = setTimeout(() => setToast(null), TOAST_DURATION_MS);
  }, []);

  // Clear on unmount.
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return { toast, show };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SyncStatusIndicator() {
  const {
    isSyncing,
    isOnline,
    pendingCount,
    lastSyncTime,
    error,
    isReady,
    manualSync,
    checkNetwork,
  } = useSyncStatus();

  const { toast, show: showToast } = useToast();
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [isCheckingNetwork, setIsCheckingNetwork] = useState(false);

  // ── Action handlers ────────────────────────────────────────────────────────

  const handleManualSync = async () => {
    setIsManualSyncing(true);
    try {
      await manualSync();
      showToast('Synced successfully', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed';
      showToast(message, 'error');
    } finally {
      setIsManualSyncing(false);
    }
  };

  const handleCheckNetwork = async () => {
    setIsCheckingNetwork(true);
    try {
      const online = await checkNetwork();
      showToast(online ? 'Connection restored' : 'Still offline', online ? 'success' : 'error');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Check failed';
      showToast(message, 'error');
    } finally {
      setIsCheckingNetwork(false);
    }
  };

  // ── Visibility guard ───────────────────────────────────────────────────────

  // Wait for init; hide when fully online with nothing pending.
  if (!isReady || (isOnline && pendingCount === 0 && !isSyncing && !error)) {
    return null;
  }

  // ── Derived display values ─────────────────────────────────────────────────

  const isOffline = !isOnline;
  const statusLabel = isSyncing ? 'Syncing…' : isOnline ? 'Online' : 'Offline';

  const barClass = isOffline
    ? 'bg-orange-50 border-orange-200'
    : 'bg-blue-50 border-blue-200';

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Status bar ── */}
      <div
        role="status"
        aria-live="polite"
        className={`fixed bottom-4 right-4 z-50 p-4 rounded-xl shadow-lg border transition-all duration-300 max-w-xs w-full ${barClass}`}
      >
        <div className="flex items-start gap-3">
          {/* Icon */}
          <span className="mt-0.5 flex-shrink-0">
            {isSyncing ? (
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin" aria-hidden />
            ) : isOnline ? (
              <Wifi className="w-5 h-5 text-green-600" aria-hidden />
            ) : (
              <WifiOff className="w-5 h-5 text-orange-600" aria-hidden />
            )}
          </span>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">{statusLabel}</p>

            {pendingCount > 0 && (
              <p className="text-xs text-gray-600 mt-0.5">
                {pendingCount} {pendingCount === 1 ? 'item' : 'items'} waiting to sync
              </p>
            )}

            {error && (
              <p className="text-xs text-red-600 mt-0.5 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 flex-shrink-0" aria-hidden />
                <span className="truncate">{error}</span>
              </p>
            )}

            {lastSyncTime && !isSyncing && pendingCount === 0 && (
              <p className="text-xs text-gray-500 mt-0.5">
                Synced {formatRelativeTime(lastSyncTime)}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex-shrink-0 self-center">
            {isOnline && pendingCount > 0 && !isSyncing && (
              <ActionButton
                onClick={handleManualSync}
                disabled={isManualSyncing}
                colorClass="bg-blue-600 hover:bg-blue-700"
                label={isManualSyncing ? 'Syncing…' : 'Sync Now'}
              />
            )}

            {isOffline && !isSyncing && (
              <ActionButton
                onClick={handleCheckNetwork}
                disabled={isCheckingNetwork}
                colorClass="bg-orange-600 hover:bg-orange-700"
                label={isCheckingNetwork ? 'Checking…' : 'Check Connection'}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div
          role="alert"
          aria-live="assertive"
          className={`
            fixed bottom-24 right-4 z-50 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium text-white
            animate-[slideUp_0.25s_ease-out,fadeOut_0.3s_ease-in_${TOAST_DURATION_MS - 300}ms_forwards]
            ${toast.type === 'success' ? 'bg-gray-900' : 'bg-red-600'}
          `}
        >
          {toast.message}
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeOut {
          from { opacity: 1; }
          to   { opacity: 0; }
        }
      `}</style>
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ActionButtonProps {
  onClick: () => void;
  disabled: boolean;
  colorClass: string;
  label: string;
}

function ActionButton({ onClick, disabled, colorClass, label }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        px-3 py-1.5 text-white text-xs font-medium rounded-lg transition-colors
        disabled:opacity-50 disabled:cursor-not-allowed
        ${colorClass}
      `}
    >
      {label}
    </button>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return `${Math.floor(diffHours / 24)}d ago`;
}