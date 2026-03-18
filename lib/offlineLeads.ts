/**
 * Offline Lead Storage Service
 * Handles persistent storage of offline leads using IndexedDB
 */

export interface OfflineLead {
  id: string; // Client-generated UUID
  fullName: string;
  ageRange: string;
  phone?: string;
  address?: string;
  location: string;
  additionalNotes?: string;
  soulState: string;
  createdAt: string; // ISO string
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  syncError?: string;
  gender?: string;
}

const DB_NAME = 'harvest_offline_db';
const STORE_NAME = 'offline_leads';

let db: IDBDatabase | null = null;

/**
 * Initialize IndexedDB for offline storage
 */
async function initIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('syncStatus', 'syncStatus', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}

/**
 * Get IndexedDB instance (lazy loaded)
 */
async function getIndexedDB(): Promise<IDBDatabase> {
  if (!db) {
    db = await initIndexedDB();
  }
  return db;
}



/**
 * Save a lead to offline storage
 */
export async function saveOfflineLead(lead: OfflineLead): Promise<void> {
  try {
    const database = await getIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(lead);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error('Error saving offline lead:', error);
    throw error;
  }
}

/**
 * Get all offline leads
 */
export async function getOfflineLeads(): Promise<OfflineLead[]> {
  try {
    const database = await getIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  } catch (error) {
    console.error('Error getting offline leads:', error);
    return [];
  }
}

/**
 * Get pending leads that need to be synced
 */
export async function getPendingLeads(): Promise<OfflineLead[]> {
  const leads = await getOfflineLeads();
  return leads.filter((lead) => lead.syncStatus === 'pending' || lead.syncStatus === 'failed');
}

/**
 * Update lead sync status
 */
export async function updateLeadSyncStatus(
  leadId: string,
  status: 'pending' | 'syncing' | 'synced' | 'failed',
  error?: string
): Promise<void> {
  try {
    const database = await getIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const getRequest = store.get(leadId);

      getRequest.onsuccess = () => {
        const lead = getRequest.result;
        if (lead) {
          lead.syncStatus = status;
          if (error) lead.syncError = error;
          const updateRequest = store.put(lead);
          updateRequest.onerror = () => reject(updateRequest.error);
          updateRequest.onsuccess = () => resolve();
        } else {
          reject(new Error('Lead not found'));
        }
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  } catch (error) {
    console.error('Error updating lead sync status:', error);
    throw error;
  }
}

/**
 * Delete offline lead (after successful sync)
 */
export async function deleteOfflineLead(leadId: string): Promise<void> {
  try {
    const database = await getIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(leadId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error('Error deleting offline lead:', error);
    throw error;
  }
}

/**
 * Clear all offline leads
 */
export async function clearOfflineLeads(): Promise<void> {
  try {
    const database = await getIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error('Error clearing offline leads:', error);
    throw error;
  }
}
