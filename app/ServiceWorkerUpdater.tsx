'use client';
import { useEffect } from 'react';

export function ServiceWorkerUpdater() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        // If the SW is stuck in 'installing' state, force it to activate
        registrations.forEach((reg) => {
          if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          reg.update();
        });
      });
    }
  }, []);
  return null;
}