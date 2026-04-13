// lib/push.ts
import webpush from 'web-push';
import { prisma } from './prisma';

// ─── VAPID configuration ──────────────────────────────────────────────────────

let configured = false;

/**
 * Configure VAPID once per process.
 * Returns false (and warns) if env vars are missing.
 */
export function configureWebPush(): boolean {
  if (configured) return true;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey) {
    console.warn(
      '[Push] NEXT_PUBLIC_VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY not set — push disabled.'
    );
    return false;
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:admin@tlacharvest.com.ng',
    publicKey,
    privateKey
  );

  configured = true;
  return true;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

interface RawSubscription {
  id: string;
  endpoint: string;
  auth: string;
  p256dh: string;
  userId: string;
}

interface SendResult {
  sent: number;
  failed: number;
  stale: number;
}

// ─── Core send function ───────────────────────────────────────────────────────

/**
 * Send a push notification to a list of subscriptions.
 * Automatically deletes subscriptions that report as expired/invalid (410/404).
 */
async function sendToSubscriptions(
  subscriptions: RawSubscription[],
  payload: PushPayload
): Promise<SendResult> {
  if (!configureWebPush() || subscriptions.length === 0) {
    return { sent: 0, failed: 0, stale: 0 };
  }

  const result: SendResult = { sent: 0, failed: 0, stale: 0 };
  const staleIds: string[] = [];

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { auth: sub.auth, p256dh: sub.p256dh } },
          JSON.stringify(payload)
        );
        result.sent++;
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 410 || status === 404) {
          // Subscription expired — mark for cleanup
          staleIds.push(sub.id);
          result.stale++;
        } else {
          result.failed++;
          console.error(`[Push] Failed to send to ${sub.endpoint}:`, err);
        }
      }
    })
  );

  // Clean up expired subscriptions in one batch
  if (staleIds.length > 0) {
    await prisma.pushSubscription
      .deleteMany({ where: { id: { in: staleIds } } })
      .catch((e) => console.error('[Push] Failed to delete stale subscriptions:', e));
  }

  return result;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Send to all subscriptions belonging to a specific user.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<SendResult> {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  return sendToSubscriptions(subscriptions, payload);
}

/**
 * Send to all subscriptions belonging to users with a specific role.
 */
export async function sendPushToRole(
  role: 'EVANGELIST' | 'FOLLOWUP' | 'ADMIN',
  payload: PushPayload
): Promise<SendResult> {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { user: { roles: { has: role } } },
    select: { id: true, endpoint: true, auth: true, p256dh: true, userId: true },
  });

  return sendToSubscriptions(subscriptions, payload);
}

/**
 * Utility: generate VAPID keys (run once, store in .env).
 * Usage: npx tsx -e "import('./lib/push').then(m => m.generateVapidKeys())"
 */
export function generateVapidKeys(): void {
  const keys = webpush.generateVAPIDKeys();
  console.log('NEXT_PUBLIC_VAPID_PUBLIC_KEY=' + keys.publicKey);
  console.log('VAPID_PRIVATE_KEY=' + keys.privateKey);
}
