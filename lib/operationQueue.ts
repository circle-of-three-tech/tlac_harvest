/**
 * Operation Queue Service
 * Manages queued operations (updates, deletes, notes) that need to be synced
 */

import { getIndexedDB } from './offlineLeads';

// ==================== INTERFACES ====================

export type OperationType = 'update' | 'delete' | 'addNote' | 'reassign';

export interface QueuedOperation {
  id?: number; // Auto-increment
  type: OperationType;
  resourceId: string; // Lead ID or note ID
  resourceType: 'lead' | 'note';
  payload: Record<string, any>;
  timestamp: number; // When operation was queued
  clientTimestamp: number; // Used for conflict resolution
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  syncError?: string;
  retryCount: number;
}

// ==================== CONSTANTS ====================

const STORE_NAME = 'queued_operations';
const MAX_RETRIES = 3;

// ==================== HELPERS ====================

async function getDB(): Promise<IDBDatabase> {
  return getIndexedDB();
}

// ==================== CORE FUNCTIONS ====================

/**
 * Queue an operation (update, delete, addNote, reassign)
 */
export async function queueOperation(op: Omit<QueuedOperation, 'id'>): Promise<number> {
  try {
    const database = await getDB();
    const operationWithDefaults: Omit<QueuedOperation, 'id'> = {
      ...op,
      timestamp: Date.now(),
      clientTimestamp: op.clientTimestamp || Date.now(),
      status: 'pending',
      retryCount: 0,
    };

    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(operationWithDefaults);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result as number);
    });
  } catch (error) {
    console.error('Error queuing operation:', error);
    throw error;
  }
}

/**
 * Get all pending operations
 */
export async function getPendingOperations(): Promise<QueuedOperation[]> {
  try {
    const database = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('status');
      const request = index.getAll('pending');

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  } catch (error) {
    console.error('Error getting pending operations:', error);
    return [];
  }
}

/**
 * Get failed operations
 */
export async function getFailedOperations(): Promise<QueuedOperation[]> {
  try {
    const database = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('status');
      const request = index.getAll('failed');

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  } catch (error) {
    console.error('Error getting failed operations:', error);
    return [];
  }
}

/**
 * Get all operations for a specific resource
 */
export async function getOperationsForResource(
  resourceId: string
): Promise<QueuedOperation[]> {
  try {
    const database = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('resourceId');
      const request = index.getAll(resourceId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  } catch (error) {
    console.error('Error getting operations for resource:', error);
    return [];
  }
}

/**
 * Update operation status
 */
export async function updateOperationStatus(
  operationId: number,
  status: 'pending' | 'syncing' | 'synced' | 'failed',
  error?: string
): Promise<void> {
  try {
    const database = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const getRequest = store.get(operationId);

      getRequest.onsuccess = () => {
        const op = getRequest.result as QueuedOperation;
        if (op) {
          op.status = status;
          if (error) op.syncError = error;
          if (status === 'pending') {
            op.retryCount++;
          }
          const updateRequest = store.put(op);
          updateRequest.onerror = () => reject(updateRequest.error);
          updateRequest.onsuccess = () => resolve();
        } else {
          reject(new Error('Operation not found'));
        }
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  } catch (error) {
    console.error('Error updating operation status:', error);
    throw error;
  }
}

/**
 * Delete operation (after successful sync)
 */
export async function deleteOperation(operationId: number): Promise<void> {
  try {
    const database = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(operationId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error('Error deleting operation:', error);
    throw error;
  }
}

/**
 * Clear operations for a resource
 */
export async function clearOperationsForResource(resourceId: string): Promise<void> {
  try {
    const database = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('resourceId');
      const range = IDBKeyRange.only(resourceId);
      const request = index.openCursor(range);

      request.onerror = () => reject(request.error);
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
    });
  } catch (error) {
    console.error('Error clearing operations for resource:', error);
    throw error;
  }
}

/**
 * Get deduped operations (latest for each resource)
 * Used to avoid redundant syncs when same lead updated multiple times offline
 */
export async function getDedupedOperations(): Promise<QueuedOperation[]> {
  const pending = await getPendingOperations();
  const map = new Map<string, QueuedOperation>();

  // For each resource, keep only the latest operation
  pending.forEach((op) => {
    const key = `${op.resourceType}:${op.resourceId}`;
    const existing = map.get(key);

    if (!existing || op.timestamp > existing.timestamp) {
      map.set(key, op);
    }
  });

  return Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Check if operation can be retried
 */
export function canRetryOperation(op: QueuedOperation): boolean {
  return op.retryCount < MAX_RETRIES;
}

/**
 * Clear all queued operations
 */
export async function clearAllOperations(): Promise<void> {
  try {
    const database = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error('Error clearing all operations:', error);
    throw error;
  }
}
