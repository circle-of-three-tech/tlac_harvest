export async function generateStaticParams() {
  return [];
}

// POST /api/push/subscribe
// Store a new push subscription for the current user

import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscription = await req.json();

    // Validate subscription object
    if (!subscription.endpoint || !subscription.keys?.auth || !subscription.keys?.p256dh) {
      return Response.json(
        { error: 'Invalid subscription object' },
        { status: 400 }
      );
    }

    // Store subscription in database
    const pushSub = await prisma.pushSubscription.upsert({
      where: {
        userId_endpoint: {
          userId: session.user.id,
          endpoint: subscription.endpoint,
        },
      },
      update: {
        auth: subscription.keys.auth,
        p256dh: subscription.keys.p256dh,
      },
      create: {
        userId: session.user.id,
        endpoint: subscription.endpoint,
        auth: subscription.keys.auth,
        p256dh: subscription.keys.p256dh,
      },
    });

    // Update user's lastActivity
    await prisma.user.update({
      where: { id: session.user.id },
      data: { lastActivity: new Date() },
    });

    return Response.json(
      { success: true, message: 'Subscription stored', data: pushSub },
      { status: 201 }
    );
  } catch (error) {
    console.error('Push subscribe error:', error);
    return Response.json(
      { error: 'Failed to store subscription' },
      { status: 500 }
    );
  }
}
