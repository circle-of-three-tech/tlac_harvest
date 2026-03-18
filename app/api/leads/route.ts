export const dynamic = 'force-dynamic';

// app/api/leads/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LeadStatus, SMSType } from "@prisma/client";
import { z } from "zod";
import { sendSMS, getSMSTemplate, renderTemplate } from "@/lib/sms";
import { sendPushToRole, configureWebPush } from "@/lib/push";

const createLeadSchema = z.object({
  fullName: z.string().min(1),
  ageRange: z.enum(["UNDER_18","AGE_18_25","AGE_26_35","AGE_36_45","AGE_46_60","ABOVE_60"]),
  phone: z.string().optional(),
  address: z.string().optional(),
  location: z.string().min(1),
  additionalNotes: z.string().optional(),
  soulState: z.enum(["NEW_CONVERT","UNCHURCHED_BELIEVER","HUNGRY_BELIEVER"]),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "10");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const status = searchParams.get("status");
  const soulState = searchParams.get("soulState");

  const user = session.user as any;
  const skip = (page - 1) * limit;

  const where: any = {};

  if (user.role === "FOLLOWUP") {
  where.assignedToId = user.id;
}

if (user.role === "EVANGELIST") {
  where.addedById = user.id;
}
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) where.createdAt.lte = new Date(dateTo + "T23:59:59.999Z");
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
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.lead.count({ where }),
  ]);

  return NextResponse.json({ leads, total, page, limit });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  if (user.role === "FOLLOWUP") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const data = createLeadSchema.parse(body);

    const lead = await prisma.lead.create({
      data: {
        ...data,
        status: LeadStatus.NEW_LEAD,
        addedBy: {  
          connect: { id: user.id },
        },
      },
      include: {
        addedBy: { select: { id: true, name: true } },
      },
    });

    // Send SMS alerts to all admins with phone numbers
    try {
      const admins = await prisma.user.findMany({
        where: { role: "ADMIN" },
        include: {
          adminPhones: {
            select: { phone: true },
          },
        },
      });

      const template = await getSMSTemplate(SMSType.ADMIN_ALERT);
      const adminAlertData = {
        leadName: lead.fullName,
        phone: lead.phone || "N/A",
        location: lead.location,
        status: lead.status,
      };

      // Send SMS to all admin phone numbers asynchronously (don't wait)
      admins.forEach((admin) => {
        admin.adminPhones.forEach((phoneRecord) => {
          const message = renderTemplate(template, adminAlertData);
          sendSMS({
            phone: phoneRecord.phone,
            message,
            type: SMSType.ADMIN_ALERT,
            leadId: lead.id,
          }).catch((err) => {
            console.error(`Failed to send admin alert SMS to ${phoneRecord.phone}:`, err);
          });
        });
      });
    } catch (smsError) {
      console.error("Error sending admin alert SMS:", smsError);
      // Don't fail the request if SMS sending fails
    }

    // Send push notifications to all admins
    try {
      configureWebPush();
      await sendPushToRole(
        'ADMIN',
        {
          title: 'New Lead Added',
          body: `${lead.fullName} from ${lead.location} has been added to the system`,
          tag: `new-lead-${lead.id}`,
          data: {
            url: '/dashboard/admin/leads',
            leadId: lead.id,
          },
        },
        prisma
      );
    } catch (pushError) {
      console.error('Error sending admin alert push notification:', pushError);
      // Don't fail the request if push sending fails
    }

    return NextResponse.json(lead, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
