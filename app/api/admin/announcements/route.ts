export const dynamic = 'force-dynamic';

// app/api/admin/announcements/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { sendPushToRole, configureWebPush } from "@/lib/push";

const createAnnouncementSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(2000),
  targetRole: z.enum(["FOLLOWUP", "EVANGELIST", "ALL"]),
  expiryDate: z.string().datetime(),
});

/**
 * GET /api/admin/announcements
 * List all announcements (admin only)
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const announcements = await prisma.announcement.findMany({
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
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

/**
 * POST /api/admin/announcements
 * Create a new announcement (admin only)
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!user.id) {
    return NextResponse.json({ error: "User ID not found in session" }, { status: 401 });
  }
  console.log("Creating announcement by user ID:", user.id);

  try {
    const body = await req.json();
    const data = createAnnouncementSchema.parse(body);

    // Verify user exists in database
    const existingUser = await prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const announcement = await prisma.announcement.create({
      data: {
        title: data.title,
        content: data.content,
        targetRole: data.targetRole,
        expiryDate: new Date(data.expiryDate),
        createdById: user.id,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Send push notifications to target roles
    try {
      const pushRoles: Array<'EVANGELIST' | 'FOLLOWUP' | 'ADMIN'> = [];
      
      if (data.targetRole === 'ALL') {
        pushRoles.push('EVANGELIST', 'FOLLOWUP', 'ADMIN');
      } else {
        pushRoles.push(data.targetRole as 'EVANGELIST' | 'FOLLOWUP');
      }

      configureWebPush();

      for (const role of pushRoles) {
        await sendPushToRole(
          role,
          {
            title: `New Announcement: ${data.title}`,
            body: data.content.substring(0, 100) + (data.content.length > 100 ? '...' : ''),
            tag: `announcement-${announcement.id}`,
            data: {
              url: '/dashboard',
              announcementId: announcement.id,
            },
          }, 
        );
      }
    } catch (pushError) {
      console.error('Error sending push notifications:', pushError);
      // Don't fail the announcement creation if push fails
    }

    return NextResponse.json(announcement, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error creating announcement:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
