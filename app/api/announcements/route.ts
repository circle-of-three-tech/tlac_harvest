export async function generateStaticParams() {
  return [];
}

// app/api/announcements/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TargetRole } from "@prisma/client";

/**
 * GET /api/announcements
 * Fetches active announcements for the current user's role
 * Only returns announcements that haven't expired
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  const userRole = user.role as string;

  try {
    // Find announcements for the user's role that haven't expired and aren't hidden
    const announcements = await prisma.announcement.findMany({
      where: {
        AND: [
          {
            OR: [
              { targetRole: "ALL" },
              { targetRole: userRole as TargetRole },
            ],
          },
          {
            expiryDate: {
              gt: new Date(), // Only non-expired announcements
            },
          },
          {
            hidden: false,
          },
        ],
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(announcements);
  } catch (error) {
    console.error("Error fetching announcements:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
