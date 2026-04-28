// app/api/leads/[id]/comments/route.ts
//
// Threaded comments between an admin and a single counterpart user
// (the FOLLOWUP assigned to the lead, or the EVANGELIST who added it).
//
// GET    → list participants + thread for the requested counterpart.
// POST   → post a new comment to a thread.
// PATCH  → mark unread messages as read.

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';
import { sendPushToUser, configureWebPush } from '@/lib/push';

type Counterpart = { id: string; name: string; role: Role; relation: 'ADDED_BY' | 'ASSIGNED_TO' };

async function loadLeadAndParticipants(leadId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      addedBy: { select: { id: true, name: true, role: true } },
      assignedTo: { select: { id: true, name: true, role: true } },
    },
  });
  if (!lead) return null;

  const participants: Counterpart[] = [];
  if (lead.addedBy && lead.addedBy.role !== Role.ADMIN) {
    participants.push({
      id: lead.addedBy.id,
      name: lead.addedBy.name,
      role: lead.addedBy.role,
      relation: 'ADDED_BY',
    });
  }
  if (
    lead.assignedTo &&
    lead.assignedTo.role !== Role.ADMIN &&
    lead.assignedTo.id !== lead.addedBy?.id
  ) {
    participants.push({
      id: lead.assignedTo.id,
      name: lead.assignedTo.name,
      role: lead.assignedTo.role,
      relation: 'ASSIGNED_TO',
    });
  }
  return { lead, participants };
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  const role = session.user.role as Role;
  const data = await loadLeadAndParticipants(params.id);
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const requestedCounterpart = searchParams.get('counterpartId');

  // Decide which counterpart's thread the caller is allowed to read.
  let counterpartId: string | null = null;
  if (role === Role.ADMIN) {
    counterpartId = requestedCounterpart ?? data.participants[0]?.id ?? null;
  } else {
    // Non-admins can only see their own thread, and only if they're a participant.
    const isParticipant = data.participants.some((p) => p.id === userId);
    if (!isParticipant) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    counterpartId = userId;
  }

  const comments = counterpartId
    ? await prisma.leadComment.findMany({
        where: { leadId: params.id, counterpartId },
        orderBy: { createdAt: 'asc' },
        include: { author: { select: { id: true, name: true, role: true } } },
      })
    : [];

  // Unread counts per participant (admin sees all; counterpart sees only theirs).
  const unreadGroups = await prisma.leadComment.groupBy({
    by: ['counterpartId'],
    where: {
      leadId: params.id,
      readByRecipientAt: null,
      ...(role === Role.ADMIN
        ? { authorRole: { not: Role.ADMIN } } // admin's unread = messages from counterparts
        : { counterpartId: userId, authorRole: Role.ADMIN }), // counterpart's unread = from admin
    },
    _count: true,
  });
  const unreadByCounterpart: Record<string, number> = {};
  for (const g of unreadGroups) unreadByCounterpart[g.counterpartId] = g._count;

  return NextResponse.json({
    counterpartId,
    participants: data.participants,
    comments,
    unreadByCounterpart,
    viewer: { id: userId, role },
  });
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  const role = session.user.role as Role;
  const data = await loadLeadAndParticipants(params.id);
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const content = String(body?.content ?? '').trim();
  if (!content) {
    return NextResponse.json({ error: 'Comment cannot be empty' }, { status: 400 });
  }

  let counterpartId: string;
  if (role === Role.ADMIN) {
    counterpartId = String(body?.counterpartId ?? '');
    if (!counterpartId) {
      return NextResponse.json({ error: 'counterpartId is required' }, { status: 400 });
    }
    if (!data.participants.some((p) => p.id === counterpartId)) {
      return NextResponse.json(
        { error: 'Counterpart is not a participant on this lead' },
        { status: 400 },
      );
    }
  } else {
    if (!data.participants.some((p) => p.id === userId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    counterpartId = userId;
  }

  const comment = await prisma.leadComment.create({
    data: {
      leadId: params.id,
      counterpartId,
      authorId: userId,
      authorRole: role,
      content,
    },
    include: { author: { select: { id: true, name: true, role: true } } },
  });

  // Notify the recipient.
  void notifyRecipient({
    leadId: params.id,
    leadName: data.lead.fullName,
    authorRole: role,
    authorName: session.user.name ?? 'Someone',
    counterpartId,
    content,
  });

  return NextResponse.json(comment, { status: 201 });
}

// ─── PATCH (mark read) ────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  const role = session.user.role as Role;
  const body = await req.json().catch(() => ({}));
  const counterpartId = String(body?.counterpartId ?? '');
  if (!counterpartId) {
    return NextResponse.json({ error: 'counterpartId is required' }, { status: 400 });
  }

  if (role !== Role.ADMIN && counterpartId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const result = await prisma.leadComment.updateMany({
    where: {
      leadId: params.id,
      counterpartId,
      readByRecipientAt: null,
      ...(role === Role.ADMIN
        ? { authorRole: { not: Role.ADMIN } }
        : { authorRole: Role.ADMIN }),
    },
    data: { readByRecipientAt: new Date() },
  });

  return NextResponse.json({ updated: result.count });
}

// ─── Notification helper ──────────────────────────────────────────────────────

async function notifyRecipient(args: {
  leadId: string;
  leadName: string;
  authorRole: Role;
  authorName: string;
  counterpartId: string;
  content: string;
}) {
  try {
    configureWebPush();

    const preview = args.content.length > 80 ? `${args.content.slice(0, 77)}…` : args.content;

    if (args.authorRole === Role.ADMIN) {
      // Counterpart receives the notification.
      const counterpart = await prisma.user.findUnique({
        where: { id: args.counterpartId },
        select: { role: true },
      });
      const url =
        counterpart?.role === Role.FOLLOWUP
          ? `/dashboard/followup/leads`
          : `/dashboard/evangelist/leads`;
      await sendPushToUser(args.counterpartId, {
        title: `Admin comment on ${args.leadName}`,
        body: preview,
        tag: `lead-comment-${args.leadId}-${args.counterpartId}`,
        data: { url, leadId: args.leadId },
      });
    } else {
      // Author is a counterpart → notify all admins.
      const admins = await prisma.user.findMany({
        where: { role: Role.ADMIN },
        select: { id: true },
      });
      await Promise.all(
        admins.map((a) =>
          sendPushToUser(a.id, {
            title: `${args.authorName} on ${args.leadName}`,
            body: preview,
            tag: `lead-comment-${args.leadId}-${args.counterpartId}`,
            data: { url: `/dashboard/admin/leads`, leadId: args.leadId },
          }),
        ),
      );
    }
  } catch (err) {
    console.error('[lead-comments] push error:', err);
  }
}
