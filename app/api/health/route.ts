/**
 * Health Check Endpoint
 * Used by the sync manager to verify actual network connectivity
 */

export async function HEAD() {
  return new Response(null, { status: 200 });
}

export async function GET() {
  return new Response(JSON.stringify({ status: 'ok' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
