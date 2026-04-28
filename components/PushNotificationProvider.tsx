'use client';

/**
 * PushNotificationProvider
 * Registers the service worker and sets up push notifications for
 * authenticated users.
 *
 * Key fix: the previous version called pushManager.subscribe() immediately
 * after navigator.serviceWorker.register(). If the SW was still installing
 * (common on first load), PushManager.subscribe() throws:
 *   "Subscription failed - no active Service Worker"
 *
 * Fix: wait for the SW to reach the 'active' state before subscribing.
 */

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';

export default function PushNotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session } = useSession();

  useEffect(() => {
    if (!session?.user) return;

    const supported =
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;

    if (!supported) return;

    void setupPush();
  }, [session]);

  return <>{children}</>;
}

// ─── Setup ────────────────────────────────────────────────────────────────────

async function setupPush(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

    // Wait until the SW is active before calling pushManager.subscribe().
    // If it's already active this resolves immediately.
    const activeRegistration = await waitForActiveServiceWorker(registration);

    if (Notification.permission === 'granted') {
      await subscribeToPush(activeRegistration);
    } else if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        await subscribeToPush(activeRegistration);
      }
    }
  } catch (error) {
    console.error('[Push] Setup failed:', error);
  }
}

/**
 * Resolves when the registration has an active service worker.
 * Handles three cases:
 *   1. SW is already active (most common on subsequent loads)
 *   2. SW is installing/waiting — listen for statechange
 *   3. SW activates via a controllerchange event
 */
function waitForActiveServiceWorker(
  registration: ServiceWorkerRegistration
): Promise<ServiceWorkerRegistration> {
  return new Promise((resolve) => {
    if (registration.active) {
      resolve(registration);
      return;
    }

    const pending = registration.installing ?? registration.waiting;

    if (pending) {
      pending.addEventListener('statechange', function onStateChange() {
        if (this.state === 'activated') {
          pending.removeEventListener('statechange', onStateChange);
          resolve(registration);
        }
      });
      return;
    }

    // Fallback: wait for any controller to become active
    navigator.serviceWorker.addEventListener('controllerchange', function onController() {
      navigator.serviceWorker.removeEventListener('controllerchange', onController);
      resolve(registration);
    });
  });
}

async function subscribeToPush(registration: ServiceWorkerRegistration): Promise<void> {
  try {
    // Already subscribed — nothing to do
    const existing = await registration.pushManager.getSubscription();
    if (existing) return;

    const res = await fetch('/api/push/public-key');
    if (!res.ok) throw new Error(`Failed to fetch VAPID key: ${res.status}`);
    const { publicKey } = await res.json();

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });

    const storeRes = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription),
    });

    if (!storeRes.ok) {
      console.error('[Push] Failed to store subscription:', await storeRes.text());
    }
  } catch (error) {
    console.error('[Push] Subscription failed:', error);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from(rawData, (c) => c.charCodeAt(0));
}