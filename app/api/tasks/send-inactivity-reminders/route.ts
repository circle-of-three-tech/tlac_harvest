// app/api/tasks/send-inactivity-reminders/route.ts
//
// Sends push notifications to FOLLOWUP and EVANGELIST users who have been
// inactive for INACTIVE_DAYS or more.
//
// Trigger via Vercel Cron (vercel.json) or an external scheduler (EasyCron etc).
// Vercel Cron only supports GET — the GET handler below delegates to the same
// logic so both GET (Vercel Cron) and POST (external cron with auth header) work.
//
// Security: set CRON_SECRET in env vars and pass it as:
//   Authorization: Bearer <secret>

import { prisma } from '@/lib/prisma';
import { sendPushToUser, configureWebPush } from '@/lib/push';
import { sendSMS, getSMSTemplate, renderTemplate } from '@/lib/sms';
import { NextRequest } from 'next/server';
import { SMSType } from '@prisma/client';

const INACTIVE_DAYS = 1;
const INACTIVITY_MS = INACTIVE_DAYS * 24 * 60 * 60 * 1000;

// ─── Auth ─────────────────────────────────────────────────────────────────────

function isAuthorized(req: Request | NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true; // no secret configured — open (not recommended in prod)
  return req.headers.get('authorization') === `Bearer ${cronSecret}`;
}

// ─── Core logic ───────────────────────────────────────────────────────────────

async function sendInactivityReminders() {
  if (!configureWebPush()) {
    return Response.json({ error: 'Push notifications not configured' }, { status: 503 });
  }

  const cutoffDate = new Date(Date.now() - INACTIVITY_MS);

  const inactiveUsers = await prisma.user.findMany({
    where: {
      lastActivity: { lt: cutoffDate },
      role: { in: ['FOLLOWUP', 'EVANGELIST'] },
      // Only bother querying users who have at least one push subscription
      pushSubscriptions: { some: {} },
    },
    select: { id: true, name: true, phone: true, role: true },
  });

  let pushSent = 0;
  let pushFailed = 0;
  let pushSkipped = 0;
  let smsSent = 0;
  let smsFailed = 0;

  const pluralS = (days: number) => (days !== 1 ? 's' : '');

  for (const user of inactiveUsers) {
    // ─── Push notification ───────────────────────────────────────────────────
    const pushPayload =
      user.role === 'FOLLOWUP'
        ? {
            title: 'Time to Follow Up',
            body: `It's been ${INACTIVE_DAYS} day${pluralS(INACTIVE_DAYS)} since you last checked in. Your assigned leads are waiting!`,
            tag: 'inactivity-reminder-followup',
            data: { url: '/dashboard/followup/leads' },
          }
        : {
            title: 'Time to Add Some Leads',
            body: `It's been ${INACTIVE_DAYS} day${pluralS(INACTIVE_DAYS)} since you last added a lead. Help us reach more souls!`,
            tag: 'inactivity-reminder-evangelist',
            data: { url: '/dashboard/evangelist' },
          };

    try {
      const result = await sendPushToUser(user.id, pushPayload);
      pushSent += result.sent;
      pushFailed += result.failed;
      pushSkipped += result.stale; // stale = expired subscriptions cleaned up
    } catch (err) {
      console.error(`[inactivity-reminders] Push failed for user ${user.id}:`, err);
      pushFailed++;
    }

    // ─── SMS notification ───────────────────────────────────────────────────
    if (user.phone) {
      const smsType =
        user.role === 'FOLLOWUP'
          ? SMSType.INACTIVITY_REMINDER_FOLLOWUP
          : SMSType.INACTIVITY_REMINDER_EVANGELIST;

      try {
        const template = await getSMSTemplate(smsType);
        const message = renderTemplate(template, {
          name: user.name,
          days: INACTIVE_DAYS,
          pluralS: pluralS(INACTIVE_DAYS),
        });

        const smsResult = await sendSMS({
          phone: user.phone,
          message,
          type: smsType,
        });

        if (smsResult.success) {
          smsSent++;
        } else {
          smsFailed++;
        }
      } catch (err) {
        console.error(`[inactivity-reminders] SMS failed for user ${user.id}:`, err);
        smsFailed++;
      }
    }
  }

  return Response.json({
    success: true,
    inactiveUsersFound: inactiveUsers.length,
    push: { sent: pushSent, failed: pushFailed, staleSubscriptions: pushSkipped },
    sms: { sent: smsSent, failed: smsFailed },
  });

}

// ─── Route handlers ───────────────────────────────────────────────────────────

/** GET — for Vercel Cron Jobs (vercel.json crons only support GET). */
// ─── Route handlers ───────────────────────────────────────────────────────

/** GET — for Vercel Cron Jobs (vercel.json crons only support GET). */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    return await sendInactivityReminders();
  } catch (err) {
    console.error('[inactivity-reminders] Unhandled error:', err);
    return Response.json({ error: 'Failed to send inactivity reminders' }, { status: 500 });
  }
}

/** POST — for external cron services (EasyCron, cron-job.org, etc). */
export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    return await sendInactivityReminders();
  } catch (err) {
    console.error('[inactivity-reminders] Unhandled error:', err);
    return Response.json({ error: 'Failed to send inactivity reminders' }, { status: 500 });
  }
}