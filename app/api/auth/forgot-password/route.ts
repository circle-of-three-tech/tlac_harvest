export const dynamic = 'force-dynamic';

// app/api/auth/forgot-password/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // Always return success to prevent email enumeration attacks
    if (!user) {
      return NextResponse.json({ success: true });
    }

    // Invalidate any existing unused tokens for this email
    await prisma.passwordResetToken.updateMany({
      where: { email, used: false },
      data: { used: true },
    });

    // Generate a secure random token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.create({
      data: { token, email, expiresAt },
    });

    const resetUrl = `${process.env.NEXTAUTH_URL}/auth/reset-password?token=${token}`;

    await sendPasswordResetEmail(user.email, user.name, resetUrl);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Forgot password error:", err);
    return NextResponse.json({ error: "Failed to send reset email" }, { status: 500 });
  }
}
