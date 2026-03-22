/**
 * Operation Queue Service
 * Manages queued offline mutations (updates, deletes, notes, reassignments).
 *
 * Key fix vs. previous version:
 * - getDedupedOperations() previously kept only the "latest per resourceId",
 *   which silently dropped all-but-one addNote operations on the same lead.
 *   Now addNote operations are always kept in full; only update/reassign/delete
 *   operations are collapsed to the latest per resource.
 */

import { getIndexedDB } from './offlineLeads';

// ─── Types ────────────────────────────────────────────────────────────────────

export type OperationType = 'update' | 'delete' | 'addNote' | 'reassign';

export interface QueuedOperation {
  id?: number; // IDB auto-increment
  type: OperationType;
  resourceId: string;
  resourceType: 'lead' | 'note';
  payload: Record<string, unknown>;
  timestamp: number;
  clientTimestamp: number;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  syncError?: string;
  retryCount: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STORE = 'queued_operations';
export const MAX_RETRIES = 3;

// ─── Core functions ───────────────────────────────────────────────────────────

export async function queueOperation(op: Omit<QueuedOperation, 'id'>): Promise<number> {
  const database = await getIndexedDB();
  const record: Omit<QueuedOperation, 'id'> = {
    ...op,
    timestamp: Date.now(),
    clientTimestamp: op.clientTimestamp ?? Date.now(),
    status: 'pending',
    retryCount: 0,
  };

  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).add(record);
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

export async function getPendingOperations(): Promise<QueuedOperation[]> {
  const database = await getIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).index('status').getAll('pending');
    req.onsuccess = () => resolve(req.result as QueuedOperation[]);
    req.onerror = () => reject(req.error);
  });
}

export async function getFailedOperations(): Promise<QueuedOperation[]> {
  const database = await getIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).index('status').getAll('failed');
    req.onsuccess = () => resolve(req.result as QueuedOperation[]);
    req.onerror = () => reject(req.error);
  });
}

export async function getOperationsForResource(resourceId: string): Promise<QueuedOperation[]> {
  const database = await getIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).index('resourceId').getAll(resourceId);
    req.onsuccess = () => resolve(req.result as QueuedOperation[]);
    req.onerror = () => reject(req.error);
  });
}

export async function updateOperationStatus(
  operationId: number,
  status: QueuedOperation['status'],
  error?: string
): Promise<void> {
  const database = await getIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const getReq = store.get(operationId);

    getReq.onsuccess = () => {
      const op = getReq.result as QueuedOperation | undefined;
      if (!op) return reject(new Error(`Operation not found: ${operationId}`));

      const updated: QueuedOperation = {
        ...op,
        status,
        syncError: error,
        // Increment retry count only when re-queuing a failed operation.
        retryCount: status === 'pending' ? op.retryCount + 1 : op.retryCount,
      };

      const putReq = store.put(updated);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };

    getReq.onerror = () => reject(getReq.error);
  });
}

export async function deleteOperation(operationId: number): Promise<void> {
  const database = await getIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).delete(operationId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function clearOperationsForResource(resourceId: string): Promise<void> {
  const database = await getIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE, 'readwrite');
    const range = IDBKeyRange.only(resourceId);
    const req = tx.objectStore(STORE).index('resourceId').openCursor(range);

    req.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        resolve();
      }
    };

    req.onerror = () => reject(req.error);
  });
}

export async function clearAllOperations(): Promise<void> {
  const database = await getIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ─── Deduplication ────────────────────────────────────────────────────────────

/**
 * Return deduplicated pending operations ready for sync.
 *
 * Rules:
 * - `addNote` operations are NEVER deduplicated — each note is distinct.
 * - `update`, `reassign`, and `delete` keep only the LATEST per resourceId.
 *   If a `delete` exists for a resource, all prior mutations are discarded.
 *
 * Result is sorted oldest-first so earlier operations apply before later ones.
 */
export async function getDedupedOperations(): Promise<QueuedOperation[]> {
  const pending = await getPendingOperations();

  // Separate notes (always keep all) from mutations (deduplicate).
  const notes = pending.filter((op) => op.type === 'addNote');
  const mutations = pending.filter((op) => op.type !== 'addNote');

  // For mutations: keep latest per resourceId.
  const latestMutations = new Map<string, QueuedOperation>();
  for (const op of mutations) {
    const existing = latestMutations.get(op.resourceId);
    if (!existing || op.timestamp > existing.timestamp) {
      latestMutations.set(op.resourceId, op);
    }
  }

  const all = [...latestMutations.values(), ...notes];
  return all.sort((a, b) => a.timestamp - b.timestamp);
}

// ─── Retry guard ──────────────────────────────────────────────────────────────

export function canRetryOperation(op: QueuedOperation): boolean {
  return op.retryCount < MAX_RETRIES;
}
