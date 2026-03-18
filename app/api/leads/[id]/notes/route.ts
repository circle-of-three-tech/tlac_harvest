// app/api/leads/[id]/notes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logNoteCreated } from "@/lib/audit";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  const lead = await prisma.lead.findUnique({ where: { id: params.id } });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (user.role === "FOLLOWUP" && lead.assignedToId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { content } = await req.json();
  if (!content?.trim()) {
    return NextResponse.json({ error: "Note cannot be empty" }, { status: 400 });
  }

  const note = await prisma.note.create({
    data: {
      content,
      leadId: params.id,
      userId: user.id,
    },
    include: {
      user: { select: { id: true, name: true } },
    },
  });

  // Log note creation as audit event
  await logNoteCreated(params.id, user.id, content);

  return NextResponse.json(note, { status: 201 });
}

export async function generateStaticParams() {
  return [];
}
