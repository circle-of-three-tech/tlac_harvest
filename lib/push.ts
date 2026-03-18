import webpush from 'web-push';

// Configure web-push with VAPID keys (must be set from environment)
export function configureWebPush() {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn(
      'Push notifications not configured. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY env vars.'
    );
    return false;
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:circleofthreetechnologies@gmail.com',
    vapidPublicKey,
    vapidPrivateKey
  );

  return true;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string; // For grouping notifications
  data?: {
    url?: string;
    [key: string]: any;
  };
}

/**
 * Send push notification to a user's subscriptions
 */
export async function sendPushNotification(
  subscriptions: Array<{ endpoint: string; auth: string; p256dh: string }>,
  payload: PushNotificationPayload
): Promise<{ sent: number; failed: number; errors: Array<{ endpoint: string; error: string }> }> {
  if (!subscriptions.length) {
    return { sent: 0, failed: 0, errors: [] };
  }

  const results = { sent: 0, failed: 0, errors: [] as Array<{ endpoint: string; error: string }> };

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            auth: subscription.auth,
            p256dh: subscription.p256dh,
          },
        },
        JSON.stringify(payload)
      );
      results.sent++;
    } catch (error) {
      results.failed++;
      results.errors.push({
        endpoint: subscription.endpoint,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return results;
}

/**
 * Send push notification to all users with a specific role
 */
export async function sendPushToRole(
  role: 'EVANGELIST' | 'FOLLOWUP' | 'ADMIN',
  payload: PushNotificationPayload,
  prisma: any
): Promise<{ sent: number; failed: number; skipped: number }> {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: {
      user: {
        role: role,
      },
    },
  });

  if (subscriptions.length === 0) {
    return { sent: 0, failed: 0, skipped: 0 };
  }

  const formattedSubs = subscriptions.map((sub: any) => ({
    endpoint: sub.endpoint,
    auth: sub.auth,
    p256dh: sub.p256dh,
  }));

  const result = await sendPushNotification(formattedSubs, payload);

  return {
    sent: result.sent,
    failed: result.failed,
    skipped: subscriptions.length - result.sent - result.failed,
  };
}

/**
 * Send push notification to a specific user's devices
 */
export async function sendPushToUser(
  userId: string,
  payload: PushNotificationPayload,
  prisma: any
): Promise<{ sent: number; failed: number }> {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  if (subscriptions.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const formattedSubs = subscriptions.map((sub: any) => ({
    endpoint: sub.endpoint,
    auth: sub.auth,
    p256dh: sub.p256dh,
  }));

  const result = await sendPushNotification(formattedSubs, payload);

  return {
    sent: result.sent,
    failed: result.failed,
  };
}

/**
 * Generate VAPID keys (run once and store in .env.local)
 * Usage: node -e "require('./lib/push').generateVapidKeys()"
 */
export function generateVapidKeys() {
  const vapidKeys = webpush.generateVAPIDKeys();
  console.log('NEXT_PUBLIC_VAPID_PUBLIC_KEY:', vapidKeys.publicKey);
  console.log('VAPID_PRIVATE_KEY:', vapidKeys.privateKey);
  console.log('\nAdd these to your .env.local file');
}
