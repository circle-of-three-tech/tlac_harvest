export const dynamic = 'force-dynamic';

// app/api/admin/activity-log/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const search = searchParams.get("search");
    const leadId = searchParams.get("leadId");
    const userId = searchParams.get("userId");
    const type = searchParams.get("type");

    const skip = (page - 1) * limit;
    const where: any = {};

    // Filter by date range
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo + "T23:59:59.999Z");
    }

    // Filter by lead
    if (leadId) {
      where.leadId = leadId;
    }

    // Filter by user (who made the change)
    if (userId) {
      where.userId = userId;
    }

    // Filter by audit type
    if (type) {
      where.type = type;
    }

    // Search by lead name or phone
    if (search) {
      where.lead = {
        OR: [
          { fullName: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
          { location: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    const auditLogs = await prisma.auditLog.findMany({
      where,
      include: {
        lead: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            location: true,
            status: true,
            soulState: true,
            churchMembership: true,
            churchName: true,
            monthsConsistent: true,
            ageRange: true,
            address: true,
            gender: true,
            addedById: true,
            addedBy: { select: { id: true, name: true, email: true } },
            assignedToId: true,
            assignedTo: { select: { id: true, name: true, email: true, phone: true } },
          },
        },
        user: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    });

    const total = await prisma.auditLog.count({ where });

    return NextResponse.json({
      auditLogs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit logs" },
      { status: 500 }
    );
  }
}
