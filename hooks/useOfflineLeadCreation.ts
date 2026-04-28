'use client';

/**
 * useOfflineLeadCreation
 * Online-first lead creation with automatic offline fallback.
 *
 * Fallback policy:
 * - Network errors (no connection, DNS, timeout) → save offline and sync later.
 * - API errors (4xx / 5xx) → throw immediately so the UI can surface them.
 *   This prevents duplicates or invalid records from being queued offline.
 *
 * ID generation uses crypto.randomUUID() for collision safety.
 */

import { useSyncStatus } from '@/components/SyncProvider';
import { saveOfflineLead, type OfflineLead } from '@/lib/offlineLeads';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LeadPayload {
  fullName: string;
  ageRange: string;
  phone: string;
  address?: string;
  location?: string;
  additionalNotes?: string;
  soulState?: string;
  gender?: string;
}

export interface UseOfflineLeadCreationOptions {
  onSuccess?: (leadId: string, savedOffline: boolean) => void;
  onError?: (error: Error) => void;
}

export interface UseOfflineLeadCreationResult {
  isOnline: boolean;
  createLead: (leadData: LeadPayload) => Promise<string>;
}

// ─── Network-error discrimination ─────────────────────────────────────────────

/**
 * Returns true only for errors that indicate the request never reached the
 * server (no connection, DNS, timeout). HTTP 4xx / 5xx responses from the
 * server are intentional API errors and must NOT be silently queued offline.
 */
function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useOfflineLeadCreation(
  options: UseOfflineLeadCreationOptions = {}
): UseOfflineLeadCreationResult {
  const { isOnline } = useSyncStatus();

  const createLead = async (leadData: LeadPayload): Promise<string> => {
    try {
      // ── Online path ────────────────────────────────────────────────────────
      if (isOnline) {
        try {
          const response = await fetch('/api/leads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(leadData),
          });

          if (response.ok) {
            const data = await response.json();
            options.onSuccess?.(data.id, false);
            return data.id;
          }

          // Server returned an API error (validation, conflict, auth, etc.).
          // Parse the body and throw — do NOT fall back to offline storage.
          const errorBody = await response.json().catch(() => ({}));
          if (errorBody.detail) {
            console.error('[useOfflineLeadCreation] Server error detail:', errorBody.detail);
          }
          throw new Error(
            errorBody.error ??
            errorBody.message ??
            `Lead creation failed (HTTP ${response.status})`
          );
        } catch (err) {
          // Only fall through to offline storage on network-level failures.
          if (!isNetworkError(err)) throw err;
          console.warn('[useOfflineLeadCreation] Network error, saving offline:', err);
        }
      }

      // ── Offline (or network-error fallback) path ───────────────────────────
      const offlineLead: OfflineLead = {
        id: crypto.randomUUID(),
        fullName: leadData.fullName,
        ageRange: leadData.ageRange,
        phone: leadData.phone,
        address: leadData.address ?? '',
        location: leadData.location ?? '',
        additionalNotes: leadData.additionalNotes ?? '',
        soulState: leadData.soulState ?? '',
        gender: leadData.gender ?? '',
        createdAt: new Date().toISOString(),
        syncStatus: 'pending',
      };

      await saveOfflineLead(offlineLead);
      options.onSuccess?.(offlineLead.id, true);
      return offlineLead.id;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error during lead creation');
      options.onError?.(err);
      throw err;
    }
  };

  return { isOnline, createLead };
}