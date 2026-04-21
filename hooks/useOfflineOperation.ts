'use client';

/**
 * useOfflineOperation
 * Mutation handling with online-first execution and offline queue fallback.
 *
 * Fallback policy (mirrors useOfflineLeadCreation):
 * - Network errors → queue the operation for sync later.
 * - API errors (4xx / 5xx) → return the error to the caller immediately.
 *   This prevents invalid / rejected operations from polluting the queue.
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

// ─── Network-error discrimination ─────────────────────────────────────────────

function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MutationResult {
  success: boolean;
  /** Present when the operation was queued (offline or after network failure). */
  operationId?: number;
  error?: string;
}

// ─── Core hook ────────────────────────────────────────────────────────────────

export function useOfflineOperation() {
  const { isOnline } = useSync();
  const [operationError, setOperationError] = useState<Error | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  /**
   * Execute a mutation online if possible, otherwise queue for later sync.
   *
   * @param executeOnline - Async function that performs the actual fetch.
   *   Omitting it forces the operation directly into the queue.
   */
  const queueMutation = useCallback(
    async (
      type: OperationType,
      resourceId: string,
      resourceType: 'lead' | 'note',
      payload: Record<string, unknown>,
      executeOnline?: () => Promise<Response>
    ): Promise<MutationResult> => {
      setIsProcessing(true);
      setOperationError(null);

      try {
        // ── Online path ──────────────────────────────────────────────────────
        if (isOnline && executeOnline) {
          try {
            const response = await executeOnline();

            if (response.ok) {
              return { success: true };
            }

            // Server returned an API error — surface it, do NOT queue.
            const errorBody = await response.json().catch(() => ({}));
            const message =
              errorBody.error ??
              errorBody.message ??
              `Request failed (HTTP ${response.status})`;
            throw new Error(message);
          } catch (err) {
            // Only fall through to the queue for network-level failures.
            if (!isNetworkError(err)) {
              const error = err instanceof Error ? err : new Error(String(err));
              setOperationError(error);
              return { success: false, error: error.message };
            }
            console.warn('[useOfflineOperation] Network error, queuing operation:', err);
          }
        }

        // ── Offline (or network-error fallback) path ─────────────────────────
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

        return {
          success: true,
          operationId,
          error: isOnline ? 'Queued after network error — will retry' : 'Offline — queued for sync',
        };
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setOperationError(error);
        return { success: false, error: error.message };
      } finally {
        setIsProcessing(false);
      }
    },
    [isOnline]
  );

  /** Retrieve all queued operations for a given resource ID. */
  const getResourceOperations = useCallback(
    async (resourceId: string): Promise<QueuedOperation[]> => {
      try {
        return await getOperationsForResource(resourceId);
      } catch (err) {
        console.error('[useOfflineOperation] getResourceOperations failed:', err);
        return [];
      }
    },
    []
  );

  /** Reset a failed operation to pending so it will be retried. */
  const retryOperation = useCallback(async (operationId: number): Promise<boolean> => {
    try {
      await updateOperationStatus(operationId, 'pending');
      return true;
    } catch (err) {
      console.error('[useOfflineOperation] retryOperation failed:', err);
      return false;
    }
  }, []);

  /** Permanently remove an operation from the queue. */
  const discardOperation = useCallback(async (operationId: number): Promise<boolean> => {
    try {
      await deleteOperation(operationId);
      return true;
    } catch (err) {
      console.error('[useOfflineOperation] discardOperation failed:', err);
      return false;
    }
  }, []);

  return {
    queueMutation,
    getResourceOperations,
    retryOperation,
    discardOperation,
    operationError,
    isProcessing,
  };
}

// ─── Lead mutations ───────────────────────────────────────────────────────────

export function useLeadMutation() {
  const { queueMutation } = useOfflineOperation();

  const updateLead = useCallback(
    (leadId: string, updates: Record<string, unknown>) =>
      queueMutation('update', leadId, 'lead', updates, () =>
        fetch(`/api/leads/${leadId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        })
      ),
    [queueMutation]
  );

  const deleteLead = useCallback(
    (leadId: string) =>
      queueMutation('delete', leadId, 'lead', { leadId }, () =>
        fetch(`/api/leads/${leadId}`, { method: 'DELETE' })
      ),
    [queueMutation]
  );

  const reassignLead = useCallback(
    (leadId: string, userId: string) =>
      queueMutation(
        'reassign',
        leadId,
        'lead',
        { assignedToId: userId },
        () =>
          fetch(`/api/leads/${leadId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assignedToId: userId }),
          })
      ),
    [queueMutation]
  );

  return { updateLead, deleteLead, reassignLead };
}

// ─── Note mutations ───────────────────────────────────────────────────────────

export function useLeadNote() {
  const { queueMutation } = useOfflineOperation();

  const addNote = useCallback(
    (leadId: string, content: string) => {
      const noteId = crypto.randomUUID();
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