export const dynamic = 'force-dynamic';

// app/api/leads/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { LeadStatus, SMSType } from '@prisma/client';
import { z } from 'zod';
import { sendSMS, getSMSTemplate, renderTemplate, sendSoulStateWelcomeSMS } from '@/lib/sms';
import { sendPushToRole, configureWebPush } from '@/lib/push';

// ─── Validation schemas ───────────────────────────────────────────────────────

const createLeadSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  ageRange: z.enum(['UNDER_18', 'AGE_18_25', 'AGE_26_35', 'AGE_36_45', 'AGE_46_60', 'ABOVE_60']),
  phone: z.string().optional(),
  address: z.string().optional(),
  location: z.string().min(1, 'Location is required'),
  additionalNotes: z.string().optional(),
  soulState: z.enum(['UNBELIEVER', 'NEW_CONVERT', 'UNCHURCHED_BELIEVER', 'HUNGRY_BELIEVER']),
  gender: z.enum(['MALE', 'FEMALE']).optional().or(z.literal('')).transform(v => v || undefined),
});

// ─── GET /api/leads ───────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(1000, Math.max(1, parseInt(searchParams.get('limit') ?? '10', 10)));
    const skip = (page - 1) * limit;

    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const status = searchParams.get('status');
    const soulState = searchParams.get('soulState');
    const assignedToId = searchParams.get('assignedToId');
    const addedById = searchParams.get('addedById');

    const { id: userId, role } = session.user;

    // Build where clause — role restrictions come first, explicit filters can override.
    const where: Record<string, unknown> = {};

    if (assignedToId) {
      where.assignedToId = assignedToId;
    } else if (role === 'FOLLOWUP') {
      where.assignedToId = userId;
    }

    if (addedById) {
      where.addedById = addedById;
    } else if (role === 'EVANGELIST') {
      where.addedById = userId;
    }

    if (dateFrom || dateTo) {
      const createdAt: Record<string, Date> = {};
      if (dateFrom) createdAt.gte = new Date(dateFrom);
      if (dateTo) createdAt.lte = new Date(`${dateTo}T23:59:59.999Z`);
      where.createdAt = createdAt;
    }

    if (status) where.status = status;
    if (soulState) where.soulState = soulState;

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: {
          addedBy: { select: { id: true, name: true, email: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
          notes: {
            include: { user: { select: { id: true, name: true } } },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.lead.count({ where }),
    ]);

    return NextResponse.json({ leads, total, page, limit });
  } catch (error) {
    console.error('GET /api/leads error:', error);
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
  }
}

// ─── POST /api/leads ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: userId, role } = session.user;
    if (role === 'FOLLOWUP') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = createLeadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const lead = await prisma.lead.create({
      data: {
        ...parsed.data,
        status: LeadStatus.NEW_LEAD,
        addedBy: { connect: { id: userId } },
      },
      include: { addedBy: { select: { id: true, name: true } } },
    });

    // Fire side-effects in the background — never delay the response.
    void sendAdminAlerts(lead);
    void sendSoulStateWelcomeSMS(lead);

    return NextResponse.json(lead, { status: 201 });
  } catch (error) {
    console.error('POST /api/leads error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: 'Failed to create lead',
        ...(process.env.NODE_ENV === 'development' && { detail: message }),
      },
      { status: 500 }
    );
  }
}

// ─── Background: admin SMS + push ────────────────────────────────────────────

async function sendAdminAlerts(lead: {
  id: string;
  fullName: string;
  phone: string | null;
  location: string;
  status: string;
}): Promise<void> {
  const alertData = {
    leadName: lead.fullName,
    phone: lead.phone ?? 'N/A',
    location: lead.location,
    status: lead.status,
  };

  // SMS to every admin phone number
  try {
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      include: { adminPhones: { select: { phone: true } } },
    });

    const template = await getSMSTemplate(SMSType.ADMIN_ALERT);
    const message = renderTemplate(template, alertData);

    for (const admin of admins) {
      for (const { phone } of admin.adminPhones) {
        sendSMS({ phone, message, type: SMSType.ADMIN_ALERT, leadId: lead.id }).catch((err) =>
          console.error(`[Alert] SMS to ${phone} failed:`, err)
        );
      }
    }
  } catch (err) {
    console.error('[Alert] Admin SMS error:', err);
  }

  // Push to all admins
  try {
    configureWebPush();
    await sendPushToRole('ADMIN', {
      title: 'New Lead Added',
      body: `${lead.fullName} from ${lead.location} has been added`,
      tag: `new-lead-${lead.id}`,
      data: { url: '/dashboard/admin/leads', leadId: lead.id },
    });
  } catch (err) {
    console.error('[Alert] Admin push error:', err);
  }
}