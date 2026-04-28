// app/api/admin/users/[id]/phones/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const addPhoneSchema = z.object({
  phone: z.string().min(1, "Phone number is required"),
});

/**
 * POST /api/admin/users/[id]/phones
 * Add a phone number to an admin
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { adminId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { phone } = addPhoneSchema.parse(body);

    // Verify admin exists
    let { adminId}  = params;
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    });

    if (!admin || admin.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 });
    }

    // Add phone number
    const adminPhone = await prisma.adminPhone.create({
      data: {
        phone: phone.trim(),
        adminId: adminId,
      },
    });

    return NextResponse.json(adminPhone, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error adding phone:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/users/[id]/phones?phoneId=xxx
 * Remove a phone number from an admin
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { adminId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  let { adminId}  = params;

  try {
    const phoneId = req.nextUrl.searchParams.get("phoneId");

    if (!phoneId) {
      return NextResponse.json(
        { error: "Phone ID is required" },
        { status: 400 }
      );
    }

    // Verify the phone belongs to the admin
    const adminPhone = await prisma.adminPhone.findUnique({
      where: { id: phoneId },
    });

    if (!adminPhone || adminPhone.adminId !== adminId) {
      return NextResponse.json({ error: "Phone not found" }, { status: 404 });
    }

    await prisma.adminPhone.delete({
      where: { id: phoneId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting phone:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
