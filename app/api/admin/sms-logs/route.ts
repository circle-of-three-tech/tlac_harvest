export const dynamic = 'force-dynamic';

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== "ADMIN") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const phone = searchParams.get("phone");

    const skip = (page - 1) * limit;
    const where: any = {};

    if (type) where.type = type;
    if (status) where.status = status;
    if (phone) where.recipientPhone = { contains: phone, mode: "insensitive" };

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo + "T23:59:59.999Z");
    }

    const [logs, total] = await Promise.all([
      prisma.sMSLog.findMany({
        where,
        select: {
          id: true,
          type: true,
          recipientPhone: true,
          content: true,
          status: true,
          errorMessage: true,
          createdAt: true,
          sentAt: true,
          lead: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.sMSLog.count({ where }),
    ]);

    return Response.json({
      logs,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching SMS logs:", error);
    return Response.json(
      { error: "Failed to fetch SMS logs" },
      { status: 500 }
    );
  }
}
