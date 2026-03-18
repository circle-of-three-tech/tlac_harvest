'use client';

/**
 * SyncStatus Component
 * Displays sync status and pending count with visual indicators
 */

import React, { useState } from 'react';
import { useSyncStatus } from './SyncProvider';
import { Loader2, AlertCircle, Wifi, WifiOff } from 'lucide-react';

export function SyncStatusIndicator() {
  const { isSyncing, isOnline, pendingCount, lastSyncTime, error, manualSync, checkNetwork } = useSyncStatus();
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [isCheckingNetwork, setIsCheckingNetwork] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const handleManualSync = async () => {
    try {
      setIsManualSyncing(true);
      await manualSync();
      setToastMessage('Sync completed successfully!');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed';
      setToastMessage(message);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } finally {
      setIsManualSyncing(false);
    }
  };

  const handleCheckNetwork = async () => {
    try {
      setIsCheckingNetwork(true);
      const isOnline = await checkNetwork();
      setToastMessage(isOnline ? 'Connection restored!' : 'Still offline');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Check failed';
      setToastMessage(message);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } finally {
      setIsCheckingNetwork(false);
    }
  };

  // Don't show if online with no pending
  if (isOnline && pendingCount === 0 && !isSyncing) {
    return null;
  }

  return (
    <>
      {/* Status Bar */}
      <div
        className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg border transition-all duration-300 ${
          isOnline ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'
        }`}
      >
        <div className="flex items-center gap-3">
          {/* Status Icon */}
          {isSyncing ? (
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0" />
          ) : isOnline ? (
            <Wifi className="w-5 h-5 text-green-600 flex-shrink-0" />
          ) : (
            <WifiOff className="w-5 h-5 text-orange-600 flex-shrink-0" />
          )}

          {/* Status Text */}
          <div className="flex-1">
            <div className="text-sm font-semibold text-gray-900">
              {isSyncing ? 'Syncing...' : isOnline ? 'Online' : 'Offline'}
            </div>

            {/* Pending Indicator */}
            {pendingCount > 0 && (
              <div className="text-xs text-gray-600 mt-0.5">
                {pendingCount} lead{pendingCount !== 1 ? 's' : ''} waiting to sync
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="text-xs text-red-600 mt-0.5 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {error}
              </div>
            )}

            {/* Last Sync Time */}
            {lastSyncTime && !isSyncing && pendingCount === 0 && (
              <div className="text-xs text-gray-500 mt-0.5">
                Synced {formatTime(lastSyncTime)}
              </div>
            )}
          </div>

          {/* Manual Sync Button */}
          {isOnline && pendingCount > 0 && !isSyncing && (
            <button
              onClick={handleManualSync}
              disabled={isManualSyncing}
              className="ml-2 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isManualSyncing ? 'Syncing...' : 'Sync Now'}
            </button>
          )}

          {/* Check Network Button (for offline state) */}
          {!isOnline && !isSyncing && (
            <button
              onClick={handleCheckNetwork}
              disabled={isCheckingNetwork}
              className="ml-2 px-3 py-1.5 bg-orange-600 text-white text-xs font-medium rounded hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isCheckingNetwork ? 'Checking...' : 'Check Connection'}
            </button>
          )}
        </div>
      </div>

      {/* Toast Notification */}
      {showToast && (
        <div
          className="fixed bottom-24 right-4 p-3 bg-gray-900 text-white rounded-lg shadow-lg text-sm animate-fade-in-out"
          style={{
            animation: 'fadeInOut 0.3s ease-in-out',
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* Animation Styles */}
      <style>{`
        @keyframes fadeInOut {
          0% {
            opacity: 0;
            transform: translateY(10px);
          }
          50%, 100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
}

/**
 * Format timestamp as relative time
 */
function formatTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
