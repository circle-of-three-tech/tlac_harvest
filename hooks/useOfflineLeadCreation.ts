'use client';

/**
 * Hook to detect if app is offline and handle offline-first lead creation
 */

import { useSyncStatus } from '@/components/SyncProvider';
import { saveOfflineLead } from '@/lib/offlineLeads';
import { OfflineLead } from '@/lib/offlineLeads';

export interface UseOfflineLeadCreationOptions {
  onSuccess?: (leadId: string) => void;
  onError?: (error: Error) => void;
}

export function useOfflineLeadCreation(options: UseOfflineLeadCreationOptions = {}) {
  const { isOnline } = useSyncStatus();

  /**
   * Create a lead (either online via API or offline via storage)
   */
  const createLead = async (leadData: {
    fullName: string;
    ageRange: string;
    phone: string;
    address?: string;
    location?: string;
    additionalNotes?: string;
    soulState?: string;
    gender?: string;
  }): Promise<string> => {
    try {
      if (isOnline) {
        // Online: use API
        const response = await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(leadData),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to create lead');
        }

        const data = await response.json();
        options.onSuccess?.(data.id);
        return data.id;
      } else {
        // Offline: save to local storage
        const offlineLead: OfflineLead = {
          id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          fullName: leadData.fullName,
          ageRange: leadData.ageRange,
          phone: leadData.phone,
          address: leadData.address || '',
          location: leadData.location || '',
          additionalNotes: leadData.additionalNotes || '',
          soulState: leadData.soulState || '',
          gender: leadData.gender || '',
          createdAt: new Date().toISOString(),
          syncStatus: 'pending',
        };

        await saveOfflineLead(offlineLead);
        options.onSuccess?.(offlineLead.id);
        return offlineLead.id;
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      options.onError?.(err);
      throw err;
    }
  };

  return {
    isOnline,
    createLead,
  };
}
