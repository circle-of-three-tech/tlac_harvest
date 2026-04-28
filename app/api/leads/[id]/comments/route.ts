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

/** Resolve the caller's effective roles, supporting both single-role and multi-role users. */
function getViewerRoles(session: { user: { role?: string; roles?: string[] } }): {
  isAdmin: boolean;
  primaryRole: Role;
} {
  const rolesArr = session.user.roles?.length ? session.user.roles : [session.user.role];
  const isAdmin = rolesArr.includes('ADMIN');
  // Prefer ADMIN if present so admin-tier permissions apply for multi-role users.
  const primaryRole = (isAdmin ? 'ADMIN' : (session.user.role ?? rolesArr[0] ?? 'EVANGELIST')) as Role;
  return { isAdmin, primaryRole };
}

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
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = session.user.id;
    const { isAdmin, primaryRole } = getViewerRoles(session as any);
    const data = await loadLeadAndParticipants(params.id);
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const requestedCounterpart = searchParams.get('counterpartId');

    // Decide which counterpart's thread the caller is allowed to read.
    let counterpartId: string | null = null;
    if (isAdmin) {
      counterpartId = requestedCounterpart ?? data.participants[0]?.id ?? null;
    } else {
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

    const unreadGroups = await prisma.leadComment.groupBy({
      by: ['counterpartId'],
      where: {
        leadId: params.id,
        readByRecipientAt: null,
        ...(isAdmin
          ? { authorRole: { not: Role.ADMIN } }
          : { counterpartId: userId, authorRole: Role.ADMIN }),
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
      viewer: { id: userId, role: primaryRole },
    });
  } catch (err) {
    console.error(`GET /api/leads/${params.id}/comments error:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load comments' },
      { status: 500 },
    );
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = session.user.id;
    const { isAdmin, primaryRole } = getViewerRoles(session as any);
    const data = await loadLeadAndParticipants(params.id);
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const content = String(body?.content ?? '').trim();
    if (!content) {
      return NextResponse.json({ error: 'Comment cannot be empty' }, { status: 400 });
    }

    let counterpartId: string;
    if (isAdmin) {
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
        authorRole: primaryRole,
        content,
      },
      include: { author: { select: { id: true, name: true, role: true } } },
    });

    void notifyRecipient({
      leadId: params.id,
      leadName: data.lead.fullName,
      authorRole: primaryRole,
      authorName: session.user.name ?? 'Someone',
      counterpartId,
      content,
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (err) {
    console.error(`POST /api/leads/${params.id}/comments error:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to post comment' },
      { status: 500 },
    );
  }
}

// ─── PATCH (mark read) ────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = session.user.id;
    const { isAdmin } = getViewerRoles(session as any);
    const body = await req.json().catch(() => ({}));
    const counterpartId = String(body?.counterpartId ?? '');
    if (!counterpartId) {
      return NextResponse.json({ error: 'counterpartId is required' }, { status: 400 });
    }

    if (!isAdmin && counterpartId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const result = await prisma.leadComment.updateMany({
      where: {
        leadId: params.id,
        counterpartId,
        readByRecipientAt: null,
        ...(isAdmin ? { authorRole: { not: Role.ADMIN } } : { authorRole: Role.ADMIN }),
      },
      data: { readByRecipientAt: new Date() },
    });

    return NextResponse.json({ updated: result.count });
  } catch (err) {
    console.error(`PATCH /api/leads/${params.id}/comments error:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to mark read' },
      { status: 500 },
    );
  }
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
