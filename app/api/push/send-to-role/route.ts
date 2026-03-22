// app/api/push/send-to-role/route.ts
// POST — send a push notification to all users with a specific role.
// Admin-only.

import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { sendPushToRole, configureWebPush } from '@/lib/push';
import { z } from 'zod';

const schema = z.object({
  role: z.enum(['EVANGELIST', 'FOLLOWUP', 'ADMIN']),
  title: z.string().min(1),
  body: z.string().min(1),
  icon: z.string().optional(),
  badge: z.string().optional(),
  tag: z.string().optional(),
  data: z.record(z.unknown()).optional(),
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'ADMIN') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    if (!configureWebPush()) {
      return Response.json({ error: 'Push notifications not configured' }, { status: 503 });
    }

    const { role, ...payload } = parsed.data;
    const result = await sendPushToRole(role, payload);

    return Response.json({ success: true, sent: result.sent, failed: result.failed, stale: result.stale });
  } catch (error) {
    console.error('[push/send-to-role] Error:', error);
    return Response.json({ error: 'Failed to send push notifications' }, { status: 500 });
  }
}