import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendSMS } from "@/lib/sms";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== "ADMIN") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const smsLogId = params.id;

    // Get the SMS log entry
    const smsLog = await prisma.sMSLog.findUnique({
      where: { id: smsLogId },
    });

    if (!smsLog) {
      return Response.json({ error: "SMS log not found" }, { status: 404 });
    }

    // Retry sending the SMS
    const result = await sendSMS({
      phone: smsLog.recipientPhone,
      message: smsLog.content,
      type: smsLog.type,
      leadId: smsLog.leadId || undefined,
    });

    if (!result.success) {
      // Update the SMS log with failure details
      await prisma.sMSLog.update({
        where: { id: smsLogId },
        data: {
          status: "FAILED",
          errorMessage: result.error || "Failed to retry SMS",
          sentAt: null,
        },
      });

      return Response.json(
        { error: result.error || "Failed to retry SMS" },
        { status: 500 }
      );
    }

    // Update the SMS log to mark as sent
    await prisma.sMSLog.update({
      where: { id: smsLogId },
      data: {
        status: "SENT",
        sentAt: new Date(),
        errorMessage: null,
      },
    });

    return Response.json({
      success: true,
      message: "SMS retry sent successfully",
    });
  } catch (error) {
    console.error("Error retrying SMS:", error);
    return Response.json(
      { error: "Failed to retry SMS" },
      { status: 500 }
    );
  }
}

export async function generateStaticParams() {
  return [];
}
