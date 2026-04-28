// lib/reports.ts
//
// Aggregates monthly activity into a structured report. Used by both the
// manual admin trigger and the automatic monthly cron job.

import { prisma } from '@/lib/prisma';
import { LeadStatus, Role } from '@prisma/client';

export interface UserActivityRow {
  id: string;
  name: string;
  email: string;
  lastActivity: Date;
  leadsAdded: number;
  conversions: number;
  notesAdded: number;
  statusChanges: number;
  assignmentsHandled: number;
  soulsTarget: number;
  activityScore: number;
}

export interface MonthlyReport {
  periodLabel: string;
  periodStart: Date;
  periodEnd: Date;
  generatedAt: Date;
  totals: {
    leadsCreated: number;
    leadsConverted: number;
    leadsFollowingUp: number;
    notesAdded: number;
    smsSent: number;
    smsFailed: number;
    activeEvangelists: number;
    activeFollowups: number;
    inactiveEvangelists: number;
    inactiveFollowups: number;
  };
  statusBreakdown: { status: LeadStatus; count: number }[];
  soulStateBreakdown: { soulState: string; count: number }[];
  evangelists: UserActivityRow[];
  followups: UserActivityRow[];
  topEvangelist: UserActivityRow | null;
  topFollowup: UserActivityRow | null;
}

export function getMonthRange(year: number, monthIndex: number): { start: Date; end: Date; label: string } {
  const start = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1, 0, 0, 0, 0));
  const label = start.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return { start, end, label };
}

export function getPreviousMonthRange(now: Date = new Date()): { start: Date; end: Date; label: string } {
  return getMonthRange(now.getUTCFullYear(), now.getUTCMonth() - 1);
}

export async function generateMonthlyReport(
  start: Date,
  end: Date,
  label: string
): Promise<MonthlyReport> {
  const range = { gte: start, lt: end };
  const inactivityCutoff = new Date(end.getTime() - 14 * 24 * 60 * 60 * 1000);

  const [
    leadsCreated,
    leadsConverted,
    leadsFollowingUp,
    notesAdded,
    smsSent,
    smsFailed,
    statusBreakdownRaw,
    soulStateBreakdownRaw,
    evangelistUsers,
    followupUsers,
    leadsByEvangelist,
    convertedByEvangelist,
    notesByUser,
    statusChangesByUser,
    assignmentsByUser,
    leadsAssignedToFollowup,
    convertedByFollowup,
  ] = await Promise.all([
    prisma.lead.count({ where: { createdAt: range } }),
    prisma.lead.count({ where: { status: LeadStatus.CONVERTED, updatedAt: range } }),
    prisma.lead.count({ where: { status: LeadStatus.FOLLOWING_UP, updatedAt: range } }),
    prisma.note.count({ where: { createdAt: range } }),
    prisma.sMSLog.count({ where: { createdAt: range, status: 'SENT' } }),
    prisma.sMSLog.count({ where: { createdAt: range, status: 'FAILED' } }),
    prisma.lead.groupBy({
      by: ['status'],
      _count: true,
      where: { createdAt: range },
    }),
    prisma.lead.groupBy({
      by: ['soulState'],
      _count: true,
      where: { createdAt: range },
    }),
    prisma.user.findMany({
      where: { role: Role.EVANGELIST },
      select: { id: true, name: true, email: true, lastActivity: true, noOfSoulsTarget: true },
    }),
    prisma.user.findMany({
      where: { role: Role.FOLLOWUP },
      select: { id: true, name: true, email: true, lastActivity: true, noOfSoulsTarget: true },
    }),
    prisma.lead.groupBy({
      by: ['addedById'],
      _count: true,
      where: { createdAt: range },
    }),
    prisma.lead.groupBy({
      by: ['addedById'],
      _count: true,
      where: { status: LeadStatus.CONVERTED, updatedAt: range },
    }),
    prisma.note.groupBy({
      by: ['userId'],
      _count: true,
      where: { createdAt: range },
    }),
    prisma.auditLog.groupBy({
      by: ['userId'],
      _count: true,
      where: { createdAt: range, type: { in: ['STATUS_CHANGE', 'FIELD_CHANGE'] } },
    }),
    prisma.auditLog.groupBy({
      by: ['userId'],
      _count: true,
      where: { createdAt: range, type: 'ASSIGNMENT' },
    }),
    prisma.lead.groupBy({
      by: ['assignedToId'],
      _count: true,
      where: { assignedToId: { not: null }, updatedAt: range },
    }),
    prisma.lead.groupBy({
      by: ['assignedToId'],
      _count: true,
      where: { status: LeadStatus.CONVERTED, assignedToId: { not: null }, updatedAt: range },
    }),
  ]);

  const leadsAddedMap = new Map(leadsByEvangelist.map((r) => [r.addedById, r._count]));
  const convertedByEvMap = new Map(convertedByEvangelist.map((r) => [r.addedById, r._count]));
  const notesMap = new Map(notesByUser.map((r) => [r.userId, r._count]));
  const statusChangesMap = new Map(statusChangesByUser.map((r) => [r.userId, r._count]));
  const assignmentsMap = new Map(assignmentsByUser.map((r) => [r.userId, r._count]));
  const followupAssignedMap = new Map(
    leadsAssignedToFollowup.map((r) => [r.assignedToId as string, r._count])
  );
  const followupConvertedMap = new Map(
    convertedByFollowup.map((r) => [r.assignedToId as string, r._count])
  );

  const buildEvangelistRow = (u: typeof evangelistUsers[number]): UserActivityRow => {
    const leadsAdded = leadsAddedMap.get(u.id) ?? 0;
    const conversions = convertedByEvMap.get(u.id) ?? 0;
    const notes = notesMap.get(u.id) ?? 0;
    const statusChanges = statusChangesMap.get(u.id) ?? 0;
    const assignments = assignmentsMap.get(u.id) ?? 0;
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      lastActivity: u.lastActivity,
      leadsAdded,
      conversions,
      notesAdded: notes,
      statusChanges,
      assignmentsHandled: assignments,
      soulsTarget: u.noOfSoulsTarget ?? 0,
      activityScore: leadsAdded * 3 + conversions * 5 + notes,
    };
  };

  const buildFollowupRow = (u: typeof followupUsers[number]): UserActivityRow => {
    const assigned = followupAssignedMap.get(u.id) ?? 0;
    const conversions = followupConvertedMap.get(u.id) ?? 0;
    const notes = notesMap.get(u.id) ?? 0;
    const statusChanges = statusChangesMap.get(u.id) ?? 0;
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      lastActivity: u.lastActivity,
      leadsAdded: assigned,
      conversions,
      notesAdded: notes,
      statusChanges,
      assignmentsHandled: 0,
      soulsTarget: u.noOfSoulsTarget ?? 0,
      activityScore: notes * 2 + statusChanges * 2 + conversions * 5,
    };
  };

  const evangelists = evangelistUsers
    .map(buildEvangelistRow)
    .sort((a, b) => b.activityScore - a.activityScore);
  const followups = followupUsers
    .map(buildFollowupRow)
    .sort((a, b) => b.activityScore - a.activityScore);

  const activeEvangelists = evangelists.filter((e) => e.activityScore > 0).length;
  const activeFollowups = followups.filter((f) => f.activityScore > 0).length;
  const inactiveEvangelists = evangelistUsers.filter((u) => u.lastActivity < inactivityCutoff).length;
  const inactiveFollowups = followupUsers.filter((u) => u.lastActivity < inactivityCutoff).length;

  return {
    periodLabel: label,
    periodStart: start,
    periodEnd: end,
    generatedAt: new Date(),
    totals: {
      leadsCreated,
      leadsConverted,
      leadsFollowingUp,
      notesAdded,
      smsSent,
      smsFailed,
      activeEvangelists,
      activeFollowups,
      inactiveEvangelists,
      inactiveFollowups,
    },
    statusBreakdown: statusBreakdownRaw.map((s) => ({ status: s.status, count: s._count })),
    soulStateBreakdown: soulStateBreakdownRaw.map((s) => ({
      soulState: s.soulState,
      count: s._count,
    })),
    evangelists,
    followups,
    topEvangelist: evangelists[0] && evangelists[0].activityScore > 0 ? evangelists[0] : null,
    topFollowup: followups[0] && followups[0].activityScore > 0 ? followups[0] : null,
  };
}
