export async function generateStaticParams() {
  return [];
}

// POST /api/tasks/send-inactivity-reminders
// Send push notifications to users who have been inactive for 7+ days
// This endpoint should be called periodically by an external cron service (e.g., EasyCron, Vercel Cron)

import { prisma } from '@/lib/prisma';
import { sendPushToUser, configureWebPush } from '@/lib/push';

const INACTIVE_DAYS = 7;
const INACTIVITY_MS = INACTIVE_DAYS * 24 * 60 * 60 * 1000;

export async function POST(req: Request) {
  // Verify cron secret if provided
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    configureWebPush();

    const cutoffDate = new Date(Date.now() - INACTIVITY_MS);
    const inactiveUsers = await prisma.user.findMany({
      where: {
        lastActivity: {
          lt: cutoffDate,
        },
        role: {
          in: ['FOLLOWUP', 'EVANGELIST'],
        },
      },
      select: {
        id: true,
        name: true,
        role: true,
        pushSubscriptions: {
          select: {
            endpoint: true,
            auth: true,
            p256dh: true,
          },
        },
      },
    });

    let sentCount = 0;
    let failedCount = 0;

    for (const user of inactiveUsers) {
      if (user.pushSubscriptions.length === 0) {
        continue;
      }

      const messageConfig =
        user.role === 'FOLLOWUP'
          ? {
              title: 'Time to Follow Up',
              body: `It's been ${INACTIVE_DAYS} days since you last checked in. Your assigned leads are waiting for your updates!`,
              tag: 'inactivity-reminder-followup',
              data: {
                url: '/dashboard/followup/leads',
              },
            }
          : {
              title: 'Time to Add Some Leads',
              body: `It's been ${INACTIVE_DAYS} days since you last added a lead. Help us reach more souls!`,
              tag: 'inactivity-reminder-evangelist',
              data: {
                url: '/dashboard/evangelist',
              },
            };

      try {
        const result = await sendPushToUser(user.id, messageConfig, prisma);
        sentCount += result.sent;
        failedCount += result.failed;
      } catch (error) {
        console.error(`Failed to send inactivity reminder to ${user.id}:`, error);
        failedCount++;
      }
    }

    return Response.json(
      {
        success: true,
        message: `Sent inactivity reminders to ${inactiveUsers.length} users`,
        sentCount,
        failedCount,
        inactiveUsersCount: inactiveUsers.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Inactivity reminder cron error:', error);
    return Response.json(
      {
        error: 'Failed to send inactivity reminders',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
