// app/api/tasks/send-inactivity-reminders/route.ts
//
// Sends push + SMS reminders at 7/14/30-day inactivity milestones to
// FOLLOWUP and EVANGELIST users. Idempotent: a user only receives one SMS
// per milestone thanks to the 5-day SMSLog lookback.

import { prisma } from '@/lib/prisma';
import { sendPushToUser, configureWebPush } from '@/lib/push';
import { sendSMS, getSMSTemplate, renderTemplate } from '@/lib/sms';
import { NextRequest } from 'next/server';
import { SMSType } from '@prisma/client';

const DAY_MS = 24 * 60 * 60 * 1000;
const MILESTONES = [7, 14, 30] as const;
type Milestone = (typeof MILESTONES)[number];

// Match a +1-day window so a cron miss doesn't skip a reminder entirely.
function milestoneFor(daysInactive: number): Milestone | null {
  if (daysInactive >= 30 && daysInactive < 32) return 30;
  if (daysInactive >= 14 && daysInactive < 16) return 14;
  if (daysInactive >= 7 && daysInactive < 9) return 7;
  return null;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

function isAuthorized(req: Request | NextRequest): boolean {
  const cronSecret = process.env.CRONJOB_SECRET;
  if (!cronSecret) {
    // Fail closed in production; allow in dev so local cron testing still works.
    if (process.env.NODE_ENV === 'production') {
      console.error('[inactivity-reminders] CRONJOB_SECRET not set — refusing request in production');
      return false;
    }
    return true;
  }
  return req.headers.get('authorization') === `Bearer ${cronSecret}`;
}

// ─── Core logic ───────────────────────────────────────────────────────────────

async function sendInactivityReminders() {
  const pushAvailable = configureWebPush();

  // Users inactive for at least the smallest milestone (7 days)
  const cutoffDate = new Date(Date.now() - MILESTONES[0] * DAY_MS);

  const inactiveUsers = await prisma.user.findMany({
    where: {
      lastActivity: { lt: cutoffDate },
      role: { in: ['FOLLOWUP', 'EVANGELIST'] },
    },
    select: { id: true, name: true, phone: true, role: true, lastActivity: true },
  });

  let eligible = 0;
  let pushSent = 0;
  let pushFailed = 0;
  let pushSkipped = 0;
  let smsSent = 0;
  let smsFailed = 0;
  let smsSkipped = 0;

  const pluralS = (n: number) => (n !== 1 ? 's' : '');
  const now = Date.now();
  const dedupWindowMs = 5 * DAY_MS;

  for (const user of inactiveUsers) {
    const daysInactive = Math.floor((now - user.lastActivity.getTime()) / DAY_MS);
    const milestone = milestoneFor(daysInactive);
    if (!milestone) continue;
    eligible++;

    // ─── Push notification ───────────────────────────────────────────────────
    if (pushAvailable) {
      const pushPayload =
        user.role === 'FOLLOWUP'
          ? {
              title: 'Time to Follow Up',
              body: `It's been ${milestone} day${pluralS(milestone)} since you last checked in. Your assigned leads are waiting!`,
              tag: `inactivity-followup-${milestone}`,
              data: { url: '/dashboard/followup/leads' },
            }
          : {
              title: 'Time to Add Some Leads',
              body: `It's been ${milestone} day${pluralS(milestone)} since you last added a lead. Help us reach more souls!`,
              tag: `inactivity-evangelist-${milestone}`,
              data: { url: '/dashboard/evangelist' },
            };

      try {
        const result = await sendPushToUser(user.id, pushPayload);
        pushSent += result.sent;
        pushFailed += result.failed;
        pushSkipped += result.stale;
      } catch (err) {
        console.error(`[inactivity-reminders] Push failed for user ${user.id}:`, err);
        pushFailed++;
      }
    }

    // ─── SMS notification ───────────────────────────────────────────────────
    if (user.phone) {
      const smsType =
        user.role === 'FOLLOWUP'
          ? SMSType.INACTIVITY_REMINDER_FOLLOWUP
          : SMSType.INACTIVITY_REMINDER_EVANGELIST;

      // Idempotency: skip if we already sent this reminder type to this
      // phone within the last 5 days (covers cron re-runs + the ±1-day
      // window that `milestoneFor` uses to absorb missed runs).
      const recent = await prisma.sMSLog.findFirst({
        where: {
          type: smsType,
          recipientPhone: user.phone,
          createdAt: { gte: new Date(now - dedupWindowMs) },
        },
        select: { id: true },
      });

      if (recent) {
        smsSkipped++;
        continue;
      }

      try {
        const template = await getSMSTemplate(smsType);
        const message = renderTemplate(template, {
          name: user.name,
          days: milestone,
          pluralS: pluralS(milestone),
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
    eligible,
    push: { sent: pushSent, failed: pushFailed, staleSubscriptions: pushSkipped },
    sms: { sent: smsSent, failed: smsFailed, skipped: smsSkipped },
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