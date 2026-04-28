export const dynamic = 'force-dynamic';

// POST /api/push/unsubscribe
// Remove a push subscription for the current user

import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { endpoint } = await req.json();

    if (!endpoint) {
      return Response.json(
        { error: 'Endpoint is required' },
        { status: 400 }
      );
    }

    // Delete subscription from database
    await prisma.pushSubscription.deleteMany({
      where: {
        userId: session.user.id,
        endpoint: endpoint,
      },
    });

    // Update user's lastActivity
    await prisma.user.update({
      where: { id: session.user.id },
      data: { lastActivity: new Date() },
    });

    return Response.json(
      { success: true, message: 'Subscription removed' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Push unsubscribe error:', error);
    return Response.json(
      { error: 'Failed to remove subscription' },
      { status: 500 }
    );
  }
}
