// app/api/admin/reports/monthly/route.ts
//
// GET  → return JSON report for a given month (defaults to previous month).
// POST → generate report and email to admins (or override recipients).

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateMonthlyReport, getMonthRange, getPreviousMonthRange } from '@/lib/reports';
import { sendMonthlyReportEmail } from '@/lib/email';
import { Role } from '@prisma/client';

function resolveRange(searchParams: URLSearchParams) {
  const yearParam = searchParams.get('year');
  const monthParam = searchParams.get('month'); // 1-12
  if (yearParam && monthParam) {
    const year = parseInt(yearParam, 10);
    const month = parseInt(monthParam, 10) - 1;
    if (Number.isFinite(year) && month >= 0 && month <= 11) {
      return getMonthRange(year, month);
    }
  }
  return getPreviousMonthRange();
}

async function getAdminEmails(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { role: Role.ADMIN },
    select: { email: true },
  });
  return admins.map((a) => a.email).filter(Boolean);
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const range = resolveRange(searchParams);
    const report = await generateMonthlyReport(range.start, range.end, range.label);
    return NextResponse.json(report);
  } catch (err) {
    console.error('GET /api/admin/reports/monthly error:', err);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const yearParam = body?.year;
    const monthParam = body?.month;
    const recipientsOverride: string[] | undefined = Array.isArray(body?.recipients)
      ? body.recipients
      : undefined;

    const range =
      typeof yearParam === 'number' && typeof monthParam === 'number'
        ? getMonthRange(yearParam, monthParam - 1)
        : getPreviousMonthRange();

    const report = await generateMonthlyReport(range.start, range.end, range.label);
    const recipients = recipientsOverride && recipientsOverride.length > 0
      ? recipientsOverride
      : await getAdminEmails();

    await sendMonthlyReportEmail(recipients, report);

    return NextResponse.json({
      success: true,
      sentTo: recipients,
      periodLabel: report.periodLabel,
    });
  } catch (err) {
    console.error('POST /api/admin/reports/monthly error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send report' },
      { status: 500 },
    );
  }
}
