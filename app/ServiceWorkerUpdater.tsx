'use client';
import { useEffect } from 'react';

/**
 * ServiceWorkerUpdater
 * - Activates any waiting SW immediately (skipWaiting already set in next-pwa,
 *   but this handles edge cases where the SW is stuck in 'waiting' state).
 * - Cleans up cache entries from old deploys that would cause
 *   bad-precaching-response 404s (stale build manifest URLs).
 */
export function ServiceWorkerUpdater() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((reg) => {
        // Unblock any SW waiting to activate
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        reg.update();
      });
    });

    // Delete any cache whose name contains build-manifest or app-build-manifest.
    // These are deployment-specific and become 404s after a new deploy.
    if ('caches' in window) {
      caches.keys().then((cacheNames) => {
        const staleManifestPattern = /app-build-manifest|build-manifest|react-loadable-manifest/;
        return Promise.all(
          cacheNames.map((name) => {
            if (staleManifestPattern.test(name)) {
              console.log('[SW] Deleting stale cache:', name);
              return caches.delete(name);
            }
          })
        );
      }).catch((err) => {
        console.warn('[SW] Cache cleanup failed:', err);
      });
    }
  }, []);

  return null;
}