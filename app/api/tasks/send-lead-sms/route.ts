// app/api/tasks/send-lead-sms/route.ts
//
// Sends a NEW_LEAD_NOTIFICATION SMS to leads approximately 1 hour after creation.
// Only fires for leads that have a phone number and haven't already received
// this SMS type (idempotent — safe to call more than once).
//
// Trigger via Vercel Cron (vercel.json) or an external scheduler.
// Auth: set CRONJOB_SECRET in env and pass as: Authorization: Bearer <secret>

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SMSType } from '@prisma/client';
import { sendSMS, getSMSTemplate, renderTemplate } from '@/lib/sms';

const WINDOW_MINUTES = 5; // ± buffer around the 1-hour mark

// ─── Auth ─────────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRONJOB_SECRET;
  if (!cronSecret) return true;
  return req.headers.get('authorization') === `Bearer ${cronSecret}`;
}

// ─── Core logic ───────────────────────────────────────────────────────────────

async function sendLeadSMS() {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const windowMs = WINDOW_MINUTES * 60 * 1000;

  const leadsToNotify = await prisma.lead.findMany({
    where: {
      createdAt: {
        gte: new Date(oneHourAgo.getTime() - windowMs),
        lte: new Date(oneHourAgo.getTime() + windowMs),
      },
      phone: { not: null },
      // Idempotency: skip leads that already received this SMS type
      smsLogs: { none: { type: SMSType.NEW_LEAD_NOTIFICATION } },
    },
    select: {
      id: true,
      fullName: true,
      phone: true,
      location: true,
    },
  });

  if (leadsToNotify.length === 0) {
    return NextResponse.json({ success: true, message: 'No leads to notify', count: 0 });
  }

  const template = await getSMSTemplate(SMSType.NEW_LEAD_NOTIFICATION);

  const results = await Promise.all(
    leadsToNotify.map(async (lead) => {
      try {
        const message = renderTemplate(template, {
          leadName: lead.fullName,
          location: lead.location,
        });

        const result = await sendSMS({
          phone: lead.phone!,
          message,
          type: SMSType.NEW_LEAD_NOTIFICATION,
          leadId: lead.id,
        });

        return { leadId: lead.id, success: result.success };
      } catch (err) {
        console.error(`[send-lead-sms] Failed for lead ${lead.id}:`, err);
        return { leadId: lead.id, success: false };
      }
    })
  );

  const successCount = results.filter((r) => r.success).length;

  return NextResponse.json({
    success: true,
    sent: successCount,
    failed: results.length - successCount,
    total: leadsToNotify.length,
  });
}

// ─── Route handlers ───────────────────────────────────────────────────────

/** GET — for Vercel Cron Jobs */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    return await sendLeadSMS();
  } catch (err) {
    console.error('[send-lead-sms] Unhandled error:', err);
    return NextResponse.json({ error: 'Failed to send lead SMS' }, { status: 500 });
  }
}

/** POST — for external cron services (cron-job.org, EasyCron, etc) */
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    return await sendLeadSMS();
  } catch (err) {
    console.error('[send-lead-sms] Unhandled error:', err);
    return NextResponse.json({ error: 'Failed to send lead SMS' }, { status: 500 });
  }
}