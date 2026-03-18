// app/api/admin/sms-templates/[type]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { SMSType } from "@prisma/client";

const updateTemplateSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(2000),
});

/**
 * GET /api/admin/sms-templates/[type]
 * Get a specific SMS template by type (admin only)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { type: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Validate type is a valid SMSType
    const validTypes = Object.values(SMSType);
    if (!validTypes.includes(params.type as SMSType)) {
      return NextResponse.json({ error: "Invalid SMS type" }, { status: 400 });
    }

    const template = await prisma.sMSTemplate.findUnique({
      where: { type: params.type as SMSType },
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

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error("Error fetching SMS template:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/sms-templates/[type]
 * Update an SMS template by type (admin only)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { type: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Validate type is a valid SMSType
    const validTypes = Object.values(SMSType);
    if (!validTypes.includes(params.type as SMSType)) {
      return NextResponse.json({ error: "Invalid SMS type" }, { status: 400 });
    }

    const body = await req.json();
    const data = updateTemplateSchema.parse(body);

    // Verify template exists
    const template = await prisma.sMSTemplate.findUnique({
      where: { type: params.type as SMSType },
    });

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const updated = await prisma.sMSTemplate.update({
      where: { type: params.type as SMSType },
      data: {
        title: data.title,
        content: data.content,
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

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error updating SMS template:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function generateStaticParams() {
  return [];
}
