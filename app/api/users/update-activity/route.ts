export const dynamic = 'force-dynamic';

// POST /api/users/update-activity
// Update the current user's lastActivity timestamp
// Called by useActivityTracking hook to track user activity

import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Update lastActivity
    await prisma.user.update({
      where: { id: session.user.id },
      data: { lastActivity: new Date() },
    });

    return Response.json(
      { success: true, message: 'Activity updated' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Update activity error:', error);
    return Response.json(
      { error: 'Failed to update activity' },
      { status: 500 }
    );
  }
}
