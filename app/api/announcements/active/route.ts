import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { TargetRole, Role } from '@prisma/client';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const userRole = session.user.role as Role;

  const roleToTargetRole: Partial<Record<Role, TargetRole>> = {
    EVANGELIST: TargetRole.EVANGELIST,
    FOLLOWUP: TargetRole.FOLLOWUP,
  };

  // Admins see everything; others see ALL + their specific role
  const whereTargetRole = userRole === Role.ADMIN
    ? undefined  // no filter — sees all target roles
    : { in: [TargetRole.ALL, roleToTargetRole[userRole]!] as TargetRole[] };

  const announcements = await prisma.announcement.findMany({
    where: {
      hidden: false,
      expiryDate: { gt: new Date() },
      ...(whereTargetRole && { targetRole: whereTargetRole }),
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      content: true,
      targetRole: true,
      expiryDate: true,
      createdAt: true,
      createdBy: {
        select: { name: true },
      },
    },
  });

  return Response.json({ announcements });
}