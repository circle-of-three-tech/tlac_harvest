// app/api/leads/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { LeadStatus, SMSType, ChurchMembership } from '@prisma/client';
import { z } from 'zod';
import { sendSMS, getSMSTemplate, renderTemplate } from '@/lib/sms';
import { logFieldChange, logStatusChange, logAssignment } from '@/lib/audit';
import { sendPushToUser, configureWebPush } from '@/lib/push';

// ─── Validation schemas ───────────────────────────────────────────────────────

/** Fields any non-FOLLOWUP user can update. */
const adminUpdateSchema = z.object({
  fullName: z.string().min(1).optional(),
  ageRange: z.enum(['UNDER_18', 'AGE_18_25', 'AGE_26_35', 'AGE_36_45', 'AGE_46_60', 'ABOVE_60']).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  location: z.string().min(1).optional(),
  additionalNotes: z.string().optional(),
  soulState: z.enum(['UNBELIEVER', 'NEW_CONVERT', 'UNCHURCHED_BELIEVER', 'HUNGRY_BELIEVER']).optional(),
  gender: z.enum(['MALE', 'FEMALE']).optional(),
  status: z.nativeEnum(LeadStatus).optional(),
  assignedToId: z.string().cuid().optional().nullable(),
  churchMembership: z.nativeEnum(ChurchMembership).optional().nullable(),
  churchName: z.string().optional(),
  monthsConsistent: z.number().int().min(0).optional(),
});

/** Fields a FOLLOWUP user can update (church progress only). */
const followupUpdateSchema = z.object({
  churchMembership: z.nativeEnum(ChurchMembership).optional().nullable(),
  churchName: z.string().optional(),
  monthsConsistent: z.number().int().min(0).optional(),
});

// ─── GET /api/leads/[id] ──────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const lead = await prisma.lead.findUnique({
      where: { id: params.id },
      include: {
        addedBy: { select: { id: true, name: true, phone: true, email: true } },
        assignedTo: { select: { id: true, name: true, phone: true, email: true } },
        notes: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const roles = session.user.roles?.length ? session.user.roles : [session.user.role];
    const isAdmin = roles.includes('ADMIN');
    const isOwner = lead.addedById === session.user.id;
    const isAssignee = lead.assignedToId === session.user.id;
    if (!isAdmin && !isOwner && !isAssignee) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(lead);
  } catch (error) {
    console.error(`GET /api/leads/${params.id} error:`, error);
    return NextResponse.json({ error: 'Failed to fetch lead' }, { status: 500 });
  }
}

// ─── PATCH /api/leads/[id] ────────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: userId } = session.user;
    const roles = session.user.roles?.length ? session.user.roles : [session.user.role];
    const isAdmin = roles.includes('ADMIN');
    const isEvangelist = roles.includes('EVANGELIST');

    const lead = await prisma.lead.findUnique({ where: { id: params.id } });
    if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const isOwner = lead.addedById === userId;
    const isAssignee = lead.assignedToId === userId;
    if (!isAdmin && !isOwner && !isAssignee) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();

    // Admins + evangelists editing leads they added get the full schema.
    // Followups (or evangelists editing leads they were assigned but didn't
    // add) get the narrower church-progress-only schema.
    const canUseAdminSchema = isAdmin || (isEvangelist && isOwner);
    const schema = canUseAdminSchema ? adminUpdateSchema : followupUpdateSchema;
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const updateData = parsed.data as Record<string, unknown>;
    const isAssignmentChange =
      'assignedToId' in updateData &&
      updateData.assignedToId !== lead.assignedToId;

    // Auto-advance status when assigning for the first time.
    if (isAssignmentChange && updateData.assignedToId) {
      updateData.status = LeadStatus.FOLLOWING_UP;
    }

    const updated = await prisma.lead.update({
      where: { id: params.id },
      data: updateData,
      include: {
        addedBy: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true, phone: true } },
        notes: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    // Audit logging (fire-and-forget — don't delay response)
    void auditChanges(params.id, userId, lead as Record<string, unknown>, updateData, isAssignmentChange, updated);

    // Side-effects for assignment changes
    if (isAssignmentChange && updated.assignedToId && updated.assignedTo) {
      void sendAssignmentNotifications(updated);
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error(`PATCH /api/leads/${params.id} error:`, error);
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 });
  }
}

// ─── DELETE /api/leads/[id] ───────────────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admins can delete leads' }, { status: 403 });
    }

    await prisma.lead.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`DELETE /api/leads/${params.id} error:`, error);
    return NextResponse.json({ error: 'Failed to delete lead' }, { status: 500 });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function auditChanges(
  leadId: string,
  userId: string,
  oldLead: Record<string, unknown>,
  updateData: Record<string, unknown>,
  isAssignmentChange: boolean,
  updated: { assignedToId: string | null; assignedTo: { name: string } | null }
): Promise<void> {
  for (const [key, newValue] of Object.entries(updateData)) {
    const oldValue = oldLead[key];
    if (oldValue === newValue) continue;

    if (key === 'status') {
      await logStatusChange(leadId, userId, String(oldValue ?? ''), String(newValue ?? ''));
    } else if (key !== 'assignedToId') {
      await logFieldChange(leadId, userId, key, String(oldValue ?? ''), String(newValue ?? ''));
    }
  }

  if (isAssignmentChange) {
    const previousAssignedToId = (oldLead.assignedToId as string | null | undefined) ?? null;
    await logAssignment(
      leadId,
      userId,
      updated.assignedToId,
      updated.assignedTo?.name,
      previousAssignedToId
    );
  }
}

async function sendAssignmentNotifications(updated: {
  id: string;
  fullName: string;
  location: string;
  phone: string | null;
  assignedToId: string | null;
  assignedTo: { name: string; phone: string | null } | null;
}): Promise<void> {
  if (!updated.assignedTo || !updated.assignedToId) return;

  // SMS
  if (updated.assignedTo.phone) {
    try {
      const template = await getSMSTemplate(SMSType.FOLLOWUP_ASSIGNMENT);
      const message = renderTemplate(template, {
        assigneeName: updated.assignedTo.name,
        leadName: updated.fullName,
        location: updated.location,
        phone: updated.phone ?? 'N/A',
      });
      await sendSMS({
        phone: updated.assignedTo.phone,
        message,
        type: SMSType.FOLLOWUP_ASSIGNMENT,
        leadId: updated.id,
      });
    } catch (err) {
      console.error('[Assignment] SMS error:', err);
    }
  }

  // Push
  try {
    configureWebPush();
    await sendPushToUser(updated.assignedToId, {
      title: 'New Lead Assignment',
      body: `You have been assigned ${updated.fullName} from ${updated.location}`,
      tag: `lead-assignment-${updated.id}`,
      data: { url: `/dashboard/followup/leads/${updated.id}`, leadId: updated.id },
    });
  } catch (err) {
    console.error('[Assignment] Push error:', err);
  }
}
