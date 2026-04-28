export const dynamic = 'force-dynamic';

// app/api/admin/stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Stats are admin-only — every other role gets a 403.
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const dateFilter: Record<string, unknown> =
      dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom && { gte: new Date(dateFrom) }),
              ...(dateTo && { lte: new Date(`${dateTo}T23:59:59.999Z`) }),
            },
          }
        : {};

    const [
      totalLeads,
      statusCounts,
      soulStateCounts,
      churchCounts,
      allLeads,
      evangelists,
      followups,
      evangelistSoulsTarget,
      currentSoulsConverted,
    ] = await Promise.all([
      prisma.lead.count({ where: dateFilter }),
      prisma.lead.groupBy({ by: ['status'], _count: true, where: dateFilter }),
      prisma.lead.groupBy({ by: ['soulState'], _count: true, where: dateFilter }),
      prisma.lead.groupBy({
        by: ['churchMembership'],
        _count: true,
        where: { ...dateFilter, churchMembership: { not: null } },
      }),
      prisma.lead.findMany({
        where: dateFilter,
        select: { monthsConsistent: true, churchMembership: true },
      }),
      prisma.user.count({ where: { role: 'EVANGELIST' } }),
      prisma.user.count({ where: { role: 'FOLLOWUP' } }),
      prisma.user.aggregate({
        where: { role: 'EVANGELIST' },
        _sum: { noOfSoulsTarget: true },
      }),
      prisma.lead.count({
        where: {
          ...dateFilter,
          soulState: { in: ['UNBELIEVER', 'NEW_CONVERT', 'UNCHURCHED_BELIEVER', 'HUNGRY_BELIEVER'] },
        },
      }),
    ]);

    const cold = allLeads.filter((l) => l.monthsConsistent < 2).length;
    const lukewarm = allLeads.filter((l) => l.monthsConsistent >= 2 && l.monthsConsistent < 3).length;
    const hot = allLeads.filter((l) => l.monthsConsistent >= 3).length;

    return NextResponse.json({
      totalLeads,
      evangelists,
      followups,
      statusCounts,
      soulStateCounts,
      churchCounts,
      attendance: { cold, lukewarm, hot },
      totalSoulsTarget: evangelistSoulsTarget._sum.noOfSoulsTarget ?? 0,
      currentSoulsTarget: currentSoulsConverted,
    });
  } catch (error) {
    console.error('GET /api/admin/stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}