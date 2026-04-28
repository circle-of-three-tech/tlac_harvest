// app/providers.tsx
"use client";
import { SessionProvider } from "next-auth/react";
import PushNotificationProvider from "@/components/PushNotificationProvider";
import ActivityTracker from "@/components/ActivityTracker";
import { SyncProvider } from "@/components/SyncProvider";
import { SyncStatusIndicator } from "@/components/SyncStatusIndicator";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SyncProvider>
        <PushNotificationProvider>
          <ActivityTracker>
            {children}
            <SyncStatusIndicator />
          </ActivityTracker>
        </PushNotificationProvider>
      </SyncProvider>
    </SessionProvider>
  );
}
