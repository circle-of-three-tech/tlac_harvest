// app/api/leads/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LeadStatus, SMSType } from "@prisma/client";
import { sendSMS, getSMSTemplate, renderTemplate } from "@/lib/sms";
import { logFieldChange, logStatusChange, logAssignment } from "@/lib/audit";
import { sendPushToUser, configureWebPush } from "@/lib/push";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  const lead = await prisma.lead.findUnique({
    where: { id: params.id },
    include: {
      addedBy: { select: { id: true, name: true, phone: true, email: true } },
      assignedTo: { select: { id: true, name: true, phone: true, email: true } },
      notes: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },  
  });

  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (user.role === "FOLLOWUP" && lead.assignedToId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(lead);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  const lead = await prisma.lead.findUnique({ where: { id: params.id } });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (user.role === "FOLLOWUP" && lead.assignedToId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();

  // FOLLOWUP can only update church-related fields and notes
  let updateData: any;
  if (user.role === "FOLLOWUP") {
    updateData = {
      churchMembership: body.churchMembership,
      churchName: body.churchName,
      monthsConsistent: body.monthsConsistent,
    };
    // Remove undefined keys
    Object.keys(updateData).forEach(k => updateData[k] === undefined && delete updateData[k]);
  } else {
    updateData = { ...body };
    delete updateData.id;
    delete updateData.addedById;
  }

  // Track if assignment is changing
  const isAssignmentChange = body.assignedToId && lead.assignedToId !== body.assignedToId;

  // If admin assigns someone, update status to FOLLOWING_UP
  if (isAssignmentChange) {
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
        orderBy: { createdAt: "asc" },
      },
    },
  });

  // Log field changes
  for (const [key, value] of Object.entries(updateData)) {
    const oldValue = (lead as any)[key];
    if (oldValue !== value) {
      if (key === 'status') {
        await logStatusChange(params.id, user.id, String(oldValue || ""), String(value || ""));
      } else {
        await logFieldChange(params.id, user.id, key, String(oldValue || ""), String(value || ""));
      }
    }
  }

  // Log assignment change
  if (isAssignmentChange) {
    await logAssignment(
      params.id,
      user.id,
      updated.assignedToId,
      updated.assignedTo?.name
    );
  }

  // Send SMS to assigned followup member
  if (isAssignmentChange && updated.assignedTo?.phone) {
    // console.log("sms")
    try {
      const template = await getSMSTemplate(SMSType.FOLLOWUP_ASSIGNMENT);
      const assignmentData = {
        assigneeName: updated.assignedTo.name,
        leadName: updated.fullName,
        location: updated.location,
        phone: updated.phone || "N/A",
      };

      const message = renderTemplate(template, assignmentData);
      sendSMS({
        phone: updated.assignedTo.phone,
        message,
        type: SMSType.FOLLOWUP_ASSIGNMENT,
        leadId: updated.id,
      }).catch((err) => {
        console.error(`Failed to send followup assignment SMS to ${updated.assignedTo?.phone}:`, err);
      });
    } catch (smsError) {
      console.error("Error sending followup assignment SMS:", smsError);
      // Don't fail the request if SMS sending fails
    }

    // Send push notification to assigned followup member
    if (updated.assignedToId) {
      try {
        configureWebPush();
        await sendPushToUser(
          updated.assignedToId,
          {
            title: 'New Lead Assignment',
            body: `You have been assigned ${updated.fullName} from ${updated.location}`,
            tag: `lead-assignment-${updated.id}`,
            data: {
              url: `/dashboard/followup/leads/${updated.id}`,
              leadId: updated.id,
            },
          },
          prisma
        );
      } catch (pushError) {
        console.error('Error sending assignment push notification:', pushError);
        // Don't fail the request if push fails
      }
    }
  }

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Only admins can delete leads" }, { status: 403 });
  }

  await prisma.lead.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}

export async function generateStaticParams() {
  return [];
}
