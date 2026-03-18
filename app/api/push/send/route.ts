export const dynamic = 'force-dynamic';

// POST /api/push/send
// Internal endpoint to send push notifications
// This should only be called from other API routes, not directly from clients

import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendPushToUser, configureWebPush } from '@/lib/push';

interface SendPushRequest {
  userId: string;
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: {
    url?: string;
    [key: string]: any;
  };
}

export async function POST(req: Request) {
  try {
    // This endpoint should only be called internally from other API routes
    // For now, we'll require admin role for security
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'ADMIN') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const payload: SendPushRequest = await req.json();

    // Validate required fields
    if (!payload.userId || !payload.title || !payload.body) {
      return Response.json(
        { error: 'Missing required fields: userId, title, body' },
        { status: 400 }
      );
    }

    // Configure web push if not already done
    const configured = configureWebPush();
    if (!configured) {
      return Response.json(
        { error: 'Push notifications not configured' },
        { status: 503 }
      );
    }

    // Send notification
    const result = await sendPushToUser(
      payload.userId,
      {
        title: payload.title,
        body: payload.body,
        icon: payload.icon,
        badge: payload.badge,
        tag: payload.tag,
        data: payload.data,
      },
      prisma
    );

    return Response.json(
      { success: true, sent: result.sent, failed: result.failed },
      { status: 200 }
    );
  } catch (error) {
    console.error('Push send error:', error);
    return Response.json(
      { error: 'Failed to send push notification' },
      { status: 500 }
    );
  }
}
