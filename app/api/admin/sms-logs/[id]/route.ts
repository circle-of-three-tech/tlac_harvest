import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== "ADMIN") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const smsLogId = params.id;

    const smsLog = await prisma.sMSLog.findUnique({
      where: { id: smsLogId },
    });

    if (!smsLog) {
      return Response.json({ error: "SMS log not found" }, { status: 404 });
    }

    return Response.json(smsLog);
  } catch (error) {
    console.error("Error fetching SMS log:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== "ADMIN") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const smsLogId = params.id;

    await prisma.sMSLog.delete({
      where: { id: smsLogId },
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting SMS log:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
