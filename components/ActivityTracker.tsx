'use client';

import { useActivityTracking } from '@/hooks/useActivityTracking';

/**
 * ActivityTracker Component
 * Wraps the useActivityTracking hook to track user activity across the app
 */
export default function ActivityTracker({
  children,
}: {
  children: React.ReactNode;
}) {
  useActivityTracking();

  return <>{children}</>;
}
