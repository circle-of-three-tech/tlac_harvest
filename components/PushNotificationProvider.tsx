'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

/**
 * PushNotificationProvider
 * Handles service worker registration and push notification subscription
 * Should wrap the app layout to enable push notifications for all authenticated users
 */
export default function PushNotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session } = useSession();
  const [isSupported, setIsSupported] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('');

  useEffect(() => {
    // Check if browser supports service workers and push notifications
    const supported =
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;

    setIsSupported(supported);

    if (!supported) {
      console.log('Push notifications not supported in this browser');
      return;
    }

    if (!session?.user) {
      return;
    }

    // Register service worker and setup push notifications
    registerServiceWorker();
  }, [session]);

  const registerServiceWorker = async () => {
    try {
      setSubscriptionStatus('Registering service worker...');

      // Register the service worker
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      console.log('Service Worker registered:', registration);
      setSubscriptionStatus('Service worker registered');

      // Request notification permission
      if (Notification.permission === 'granted') {
        subscribeToPushNotifications(registration);
      } else if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          subscribeToPushNotifications(registration);
        }
      }
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      setSubscriptionStatus('Failed to register service worker');
    }
  };

  const subscribeToPushNotifications = async (
    registration: ServiceWorkerRegistration
  ) => {
    try {
      setSubscriptionStatus('Getting public key...');

      // Get the public VAPID key
      const response = await fetch('/api/push/public-key');
      const { publicKey } = await response.json();

      setSubscriptionStatus('Subscribing to push notifications...');

      // Create push subscription
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as any,
      });

      // Send subscription to server
      const subscribeResponse = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(subscription),
      });

      if (subscribeResponse.ok) {
        console.log('Successfully subscribed to push notifications');
        setSubscriptionStatus('Push notifications enabled');
      } else {
        console.error('Failed to store push subscription');
        setSubscriptionStatus('Failed to enable push notifications');
      }
    } catch (error) {
      console.error('Push subscription failed:', error);
      setSubscriptionStatus('Push subscription failed');
    }
  };

  return <>{children}</>;
}

/**
 * Convert VAPID public key from base64 to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
