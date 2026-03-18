export const dynamic = 'force-dynamic';

// GET /api/push/public-key
// Return the VAPID public key for client-side subscription

export async function GET() {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  if (!vapidPublicKey) {
    return Response.json(
      { error: 'Push notifications not configured' },
      { status: 503 }
    );
  }

  return Response.json(
    { publicKey: vapidPublicKey },
    { status: 200 }
  );
}
