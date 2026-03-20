'use client';

import { useActivityTracking } from '@/hooks/useActivityTracking';
import { useSessionCacheCleanup } from '@/hooks/useSessionCacheCleanup';

/**
 * ActivityTracker Component
 * Wraps tracking hooks for user activity and session changes
 */
export default function ActivityTracker({
  children,
}: {
  children: React.ReactNode;
}) {
  useActivityTracking();
  useSessionCacheCleanup();

  return <>{children}</>;
}
