// Service Worker for Push Notifications
// This file runs in the background even when the app is closed

self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  console.log('Service Worker: Push notification received', event.data);

  if (!event.data) {
    console.log('Service Worker: No data in push event');
    return;
  }

  let notificationData = {};
  let title = 'Harvest App';
  let options = {
    body: 'You have a new notification',
    icon: '/applogo.jpg',
    badge: '/applogo.jpg',
    tag: 'harvest-notification',
  };

  try {
    notificationData = event.data.json();
    title = notificationData.title || title;
    options = {
      ...options,
      body: notificationData.body || options.body,
      badge: notificationData.badge || options.badge,
      icon: notificationData.icon || options.icon,
      tag: notificationData.tag || options.tag,
      data: notificationData.data || {},
    };
  } catch (err) {
    // If not JSON, use the text as body
    options.body = event.data.text();
  }

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked', event.notification.data);

  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      .then((windowClients) => {
        // Check if app is already open in a window/tab
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // If not open, open a new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

self.addEventListener('notificationclose', (event) => {
  console.log('Service Worker: Notification closed', event.notification.data);
});
