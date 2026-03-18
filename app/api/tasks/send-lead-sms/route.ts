export async function generateStaticParams() {
  return [];
}

// app/api/tasks/send-lead-sms/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SMSType } from "@prisma/client";
import { sendSMS, getSMSTemplate, renderTemplate } from "@/lib/sms";

/**
 * Cron endpoint to send SMS to leads 1 hour after creation
 * Should be called via a cron service like Vercel Cron or external scheduler
 * 
 * Usage: GET /api/tasks/send-lead-sms
 */
export async function GET(req: NextRequest) {
  // Optional: Add security check with cron secret
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    // Calculate timestamp for 1 hour ago
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    // Find leads created around 1 hour ago that haven't been sent the NEW_LEAD_NOTIFICATION SMS yet
    const leadsToNotify = await prisma.lead.findMany({
      where: {
        createdAt: {
          gte: new Date(oneHourAgo.getTime() - 5 * 60 * 1000), // 5 min buffer
          lte: new Date(oneHourAgo.getTime() + 5 * 60 * 1000), // 5 min buffer
        },
        phone: {
          not: null,
        },
        smsLogs: {
          none: {
            type: SMSType.NEW_LEAD_NOTIFICATION,
          },
        },
      },
      include: {
        smsLogs: {
          where: { type: SMSType.NEW_LEAD_NOTIFICATION },
        },
      },
    });

    if (leadsToNotify.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No leads to notify",
        count: 0,
      });
    }

    // Get the template
    const template = await getSMSTemplate(SMSType.NEW_LEAD_NOTIFICATION);

    // Send SMS to each lead
    const results = await Promise.all(
      leadsToNotify.map(async (lead) => {
        try {
          const data = {
            leadName: lead.fullName,
            location: lead.location,
          };

          const message = renderTemplate(template, data);

          const result = await sendSMS({
            phone: lead.phone!,
            message,
            type: SMSType.NEW_LEAD_NOTIFICATION,
            leadId: lead.id,
          });

          return {
            leadId: lead.id,
            leadName: lead.fullName,
            success: result.success,
            error: result.error,
          };
        } catch (error) {
          console.error(`Error sending SMS to lead ${lead.id}:`, error);
          return {
            leadId: lead.id,
            leadName: lead.fullName,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      message: `Sent SMS notifications to ${results.filter(r => r.success).length} leads`,
      count: leadsToNotify.length,
      results,
    });
  } catch (error) {
    console.error("Error in send-lead-sms cron:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
