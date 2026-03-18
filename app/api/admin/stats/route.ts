export const dynamic = 'force-dynamic';

// app/api/admin/stats/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  const dateFilter: any = {};
  if (dateFrom || dateTo) {
    dateFilter.createdAt = {};
    if (dateFrom) dateFilter.createdAt.gte = new Date(dateFrom);
    if (dateTo) dateFilter.createdAt.lte = new Date(dateTo + "T23:59:59.999Z");
  }

  const [
    totalLeads,
    statusCounts,
    soulStateCounts,
    churchCounts,
    allLeads,
    evangelists,
    followups,
  ] = await Promise.all([
    prisma.lead.count({ where: dateFilter }),
    prisma.lead.groupBy({ by: ["status"], _count: true, where: dateFilter }),
    prisma.lead.groupBy({ by: ["soulState"], _count: true, where: dateFilter }),
    prisma.lead.groupBy({
      by: ["churchMembership"],
      _count: true,
      where: { ...dateFilter, churchMembership: { not: null } },
    }),
    prisma.lead.findMany({
      where: dateFilter,
      select: { monthsConsistent: true, churchMembership: true },
    }),
    prisma.user.count({ where: { role: "EVANGELIST" } }),
    prisma.user.count({ where: { role: "FOLLOWUP" } }),
  ]);

  const cold = allLeads.filter(l => l.monthsConsistent < 2).length;
  const lukewarm = allLeads.filter(l => l.monthsConsistent >= 2 && l.monthsConsistent < 3).length;
  const hot = allLeads.filter(l => l.monthsConsistent >= 3).length;

  return NextResponse.json({
    totalLeads,
    evangelists,
    followups,
    statusCounts,
    soulStateCounts,
    churchCounts,
    attendance: { cold, lukewarm, hot },
  });
}
