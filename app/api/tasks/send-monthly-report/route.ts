// app/api/tasks/send-monthly-report/route.ts
//
// Cron task — generates the previous month's activity report and emails all
// admin users. Schedule once a month (e.g. 1st of each month at 06:00 UTC).

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateMonthlyReport, getPreviousMonthRange } from '@/lib/reports';
import { sendMonthlyReportEmail } from '@/lib/email';
import { Role } from '@prisma/client';

function isAuthorized(req: Request | NextRequest): boolean {
  const cronSecret = process.env.CRONJOB_SECRET;
  if (!cronSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[monthly-report] CRONJOB_SECRET not set — refusing in production');
      return false;
    }
    return true;
  }
  return req.headers.get('authorization') === `Bearer ${cronSecret}`;
}

async function run() {
  const range = getPreviousMonthRange();
  const report = await generateMonthlyReport(range.start, range.end, range.label);

  const admins = await prisma.user.findMany({
    where: { role: Role.ADMIN },
    select: { email: true },
  });
  const recipients = admins.map((a) => a.email).filter(Boolean);

  if (recipients.length === 0) {
    return Response.json({
      success: false,
      reason: 'No admin recipients found',
      periodLabel: report.periodLabel,
    });
  }

  await sendMonthlyReportEmail(recipients, report);

  return Response.json({
    success: true,
    periodLabel: report.periodLabel,
    recipientsCount: recipients.length,
    totals: report.totals,
  });
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return await run();
  } catch (err) {
    console.error('[monthly-report] Unhandled error:', err);
    return Response.json({ error: 'Failed to send monthly report' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return await run();
  } catch (err) {
    console.error('[monthly-report] Unhandled error:', err);
    return Response.json({ error: 'Failed to send monthly report' }, { status: 500 });
  }
}
