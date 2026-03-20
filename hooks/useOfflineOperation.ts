'use client';

/**
 * Operations hook for mutation handling
 * Allows queuing and managing offline mutations
 */

import { useCallback, useState } from 'react';
import { useSync } from '@/components/SyncProvider';
import {
  queueOperation,
  getOperationsForResource,
  updateOperationStatus,
  deleteOperation,
  type QueuedOperation,
  type OperationType,
} from '@/lib/operationQueue';

/**
 * Hook for managing operations (mutations) with offline support
 */
export function useOfflineOperation() {
  const { isOnline } = useSync();
  const [operationError, setOperationError] = useState<Error | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  /**
   * Queue a mutation operation
   * If online, tries to execute immediately; if offline, queues for later
   */
  const queueMutation = useCallback(
    async (
      type: OperationType,
      resourceId: string,
      resourceType: 'lead' | 'note',
      payload: Record<string, any>,
      executeOnline?: () => Promise<Response>
    ): Promise<{ success: boolean; operationId?: number; error?: string }> => {
      setIsProcessing(true);
      setOperationError(null);

      try {
        if (isOnline && executeOnline) {
          // Try to execute online immediately
          try {
            const response = await executeOnline();
            if (response.ok) {
              setIsProcessing(false);
              return { success: true };
            } else {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(errorData.error || `HTTP ${response.status}`);
            }
          } catch (error) {
            // Fall through to offline queueing
            console.warn('Online execution failed, queuing for later:', error);
          }
        }

        // Queue for offline sync
        const operationId = await queueOperation({
          type,
          resourceId,
          resourceType,
          payload,
          timestamp: Date.now(),
          clientTimestamp: Date.now(),
          status: 'pending',
          retryCount: 0,
        });

        setIsProcessing(false);
        return {
          success: true,
          operationId,
          error: isOnline ? 'Queued for sync' : 'Offline - queued for sync',
        };
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        setOperationError(err);
        setIsProcessing(false);
        return { success: false, error: err.message };
      }
    },
    [isOnline]
  );

  /**
   * Get all operations for a resource
   */
  const getResourceOperations = useCallback(
    async (resourceId: string): Promise<QueuedOperation[]> => {
      try {
        return await getOperationsForResource(resourceId);
      } catch (error) {
        console.error('Error getting resource operations:', error);
        return [];
      }
    },
    []
  );

  /**
   * Retry a failed operation
   */
  const retryOperation = useCallback(
    async (operationId: number): Promise<boolean> => {
      try {
        await updateOperationStatus(operationId, 'pending');
        return true;
      } catch (error) {
        console.error('Error retrying operation:', error);
        return false;
      }
    },
    []
  );

  /**
   * Discard an operation
   */
  const discardOperation = useCallback(
    async (operationId: number): Promise<boolean> => {
      try {
        await deleteOperation(operationId);
        return true;
      } catch (error) {
        console.error('Error discarding operation:', error);
        return false;
      }
    },
    []
  );

  return {
    queueMutation,
    getResourceOperations,
    retryOperation,
    discardOperation,
    operationError,
    isProcessing,
  };
}

/**
 * Hook for lead mutations (update, delete, reassign)
 */
export function useLeadMutation() {
  const { queueMutation } = useOfflineOperation();

  /**
   * Update a lead
   */
  const updateLead = useCallback(
    async (leadId: string, updates: Record<string, any>) => {
      return queueMutation(
        'update',
        leadId,
        'lead',
        updates,
        () =>
          fetch(`/api/leads/${leadId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
          })
      );
    },
    [queueMutation]
  );

  /**
   * Delete a lead
   */
  const deleteLead = useCallback(
    async (leadId: string) => {
      return queueMutation(
        'delete',
        leadId,
        'lead',
        { leadId },
        () =>
          fetch(`/api/leads/${leadId}`, {
            method: 'DELETE',
          })
      );
    },
    [queueMutation]
  );

  /**
   * Reassign a lead
   */
  const reassignLead = useCallback(
    async (leadId: string, userId: string) => {
      return queueMutation(
        'reassign',
        leadId,
        'lead',
        { assignedTo: userId },
        () =>
          fetch(`/api/leads/${leadId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assignedTo: userId }),
          })
      );
    },
    [queueMutation]
  );

  return {
    updateLead,
    deleteLead,
    reassignLead,
  };
}

/**
 * Hook for adding notes to leads
 */
export function useLeadNote() {
  const { queueMutation } = useOfflineOperation();

  /**
   * Add a note to a lead
   */
  const addNote = useCallback(
    async (leadId: string, content: string) => {
      const noteId = `note_${Date.now()}`;

      return queueMutation(
        'addNote',
        noteId,
        'note',
        { leadId, content },
        () =>
          fetch(`/api/leads/${leadId}/notes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content }),
          })
      );
    },
    [queueMutation]
  );

  return { addNote };
}
