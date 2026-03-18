export async function generateStaticParams() {
  return [];
}

// POST /api/push/send-to-role
// Send push notifications to all users with a specific role
// This is used for announcements and system-wide notifications

import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendPushToRole, configureWebPush } from '@/lib/push';

interface SendToRoleRequest {
  role: 'EVANGELIST' | 'FOLLOWUP' | 'ADMIN';
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
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can send notifications to roles
    if (session.user.role !== 'ADMIN') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const payload: SendToRoleRequest = await req.json();

    // Validate required fields
    if (!payload.role || !payload.title || !payload.body) {
      return Response.json(
        { error: 'Missing required fields: role, title, body' },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles = ['EVANGELIST', 'FOLLOWUP', 'ADMIN'];
    if (!validRoles.includes(payload.role)) {
      return Response.json(
        { error: 'Invalid role. Must be one of: EVANGELIST, FOLLOWUP, ADMIN' },
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

    // Send notification to role
    const result = await sendPushToRole(
      payload.role,
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
      {
        success: true,
        sent: result.sent,
        failed: result.failed,
        skipped: result.skipped,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Push send to role error:', error);
    return Response.json(
      { error: 'Failed to send push notifications' },
      { status: 500 }
    );
  }
}
