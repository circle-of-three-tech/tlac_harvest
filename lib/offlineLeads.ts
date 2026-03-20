/**
 * Offline Lead Storage Service
 * Handles persistent storage of offline leads and cached data using IndexedDB
 */

// ==================== INTERFACES ====================

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

export interface CachedLead {
  _id: string;
  fullName: string;
  ageRange: string;
  phone?: string;
  address?: string;
  location: string;
  additionalNotes?: string;
  soulState: string;
  gender?: string;
  createdByName?: string;
  assignedTo?: string;
  status?: string;
  cachedAt: number; // timestamp
}

export interface CachedUser {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  verified?: boolean;
  cachedAt: number;
}

export interface CachedAnnouncement {
  _id: string;
  title: string;
  message: string;
  priority: string;
  createdAt: string;
  cachedAt: number;
}

export interface CachedStats {
  totalLeads: number;
  totalUsers: number;
  leadsThisWeek: number;
  cachedAt: number;
}

export interface CachedActivityLog {
  _id: string;
  userId: string;
  userName: string;
  action: string;
  resourceType: string;
  timestamp: string;
  cachedAt: number;
}

export interface CachedSMSLog {
  _id: string;
  phone: string;
  message: string;
  status: string;
  createdAt: string;
  cachedAt: number;
}

export interface CachedNote {
  _id: string;
  leadId: string;
  content: string;
  createdAt: number;
  syncStatus: 'pending' | 'synced' | 'failed';
}

// ==================== CONSTANTS ====================

const DB_NAME = 'harvest_offline_db';
const DB_VERSION = 2; // Increment when schema changes

// Store names
const STORE_NAMES = {
  OFFLINE_LEADS: 'offline_leads',
  CACHED_LEADS: 'cached_leads',
  CACHED_USERS: 'cached_users',
  CACHED_ANNOUNCEMENTS: 'cached_announcements',
  CACHED_STATS: 'cached_stats',
  CACHED_ACTIVITY_LOGS: 'cached_activity_logs',
  CACHED_SMS_LOGS: 'cached_sms_logs',
  CACHED_NOTES: 'cached_notes',
  QUEUED_OPERATIONS: 'queued_operations',
} as const;

let db: IDBDatabase | null = null;

/**
 * Initialize IndexedDB for offline storage
 */
async function initIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Offline leads store (for local lead creation)
      if (!database.objectStoreNames.contains(STORE_NAMES.OFFLINE_LEADS)) {
        const offlineStore = database.createObjectStore(STORE_NAMES.OFFLINE_LEADS, {
          keyPath: 'id',
        });
        offlineStore.createIndex('syncStatus', 'syncStatus', { unique: false });
        offlineStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // Cached leads (from API)
      if (!database.objectStoreNames.contains(STORE_NAMES.CACHED_LEADS)) {
        const cachedLeadsStore = database.createObjectStore(STORE_NAMES.CACHED_LEADS, {
          keyPath: '_id',
        });
        cachedLeadsStore.createIndex('cachedAt', 'cachedAt', { unique: false });
      }

      // Cached users
      if (!database.objectStoreNames.contains(STORE_NAMES.CACHED_USERS)) {
        const usersStore = database.createObjectStore(STORE_NAMES.CACHED_USERS, {
          keyPath: '_id',
        });
        usersStore.createIndex('role', 'role', { unique: false });
        usersStore.createIndex('cachedAt', 'cachedAt', { unique: false });
      }

      // Cached announcements
      if (!database.objectStoreNames.contains(STORE_NAMES.CACHED_ANNOUNCEMENTS)) {
        const announcementsStore = database.createObjectStore(STORE_NAMES.CACHED_ANNOUNCEMENTS, {
          keyPath: '_id',
        });
        announcementsStore.createIndex('cachedAt', 'cachedAt', { unique: false });
      }

      // Cached stats
      if (!database.objectStoreNames.contains(STORE_NAMES.CACHED_STATS)) {
        database.createObjectStore(STORE_NAMES.CACHED_STATS, { keyPath: 'statsId' });
      }

      // Cached activity logs
      if (!database.objectStoreNames.contains(STORE_NAMES.CACHED_ACTIVITY_LOGS)) {
        const logsStore = database.createObjectStore(STORE_NAMES.CACHED_ACTIVITY_LOGS, {
          keyPath: '_id',
        });
        logsStore.createIndex('cachedAt', 'cachedAt', { unique: false });
      }

      // Cached SMS logs
      if (!database.objectStoreNames.contains(STORE_NAMES.CACHED_SMS_LOGS)) {
        const smsStore = database.createObjectStore(STORE_NAMES.CACHED_SMS_LOGS, {
          keyPath: '_id',
        });
        smsStore.createIndex('cachedAt', 'cachedAt', { unique: false });
      }

      // Cached notes
      if (!database.objectStoreNames.contains(STORE_NAMES.CACHED_NOTES)) {
        const notesStore = database.createObjectStore(STORE_NAMES.CACHED_NOTES, {
          keyPath: '_id',
        });
        notesStore.createIndex('leadId', 'leadId', { unique: false });
        notesStore.createIndex('syncStatus', 'syncStatus', { unique: false });
      }

      // Queued operations
      if (!database.objectStoreNames.contains(STORE_NAMES.QUEUED_OPERATIONS)) {
        const opsStore = database.createObjectStore(STORE_NAMES.QUEUED_OPERATIONS, {
          keyPath: 'id',
          autoIncrement: true,
        });
        opsStore.createIndex('status', 'status', { unique: false });
        opsStore.createIndex('resourceId', 'resourceId', { unique: false });
        opsStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}

/**
 * Get IndexedDB instance (lazy loaded)
 */
export async function getIndexedDB(): Promise<IDBDatabase> {
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
      const transaction = database.transaction([STORE_NAMES.OFFLINE_LEADS], 'readwrite');
      const store = transaction.objectStore(STORE_NAMES.OFFLINE_LEADS);
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
      const transaction = database.transaction([STORE_NAMES.OFFLINE_LEADS], 'readonly');
      const store = transaction.objectStore(STORE_NAMES.OFFLINE_LEADS);
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
      const transaction = database.transaction([STORE_NAMES.OFFLINE_LEADS], 'readwrite');
      const store = transaction.objectStore(STORE_NAMES.OFFLINE_LEADS);
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
      const transaction = database.transaction([STORE_NAMES.OFFLINE_LEADS], 'readwrite');
      const store = transaction.objectStore(STORE_NAMES.OFFLINE_LEADS);
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
      const transaction = database.transaction([STORE_NAMES.OFFLINE_LEADS], 'readwrite');
      const store = transaction.objectStore(STORE_NAMES.OFFLINE_LEADS);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error('Error clearing offline leads:', error);
    throw error;
  }
}

// ==================== CACHE FUNCTIONS ====================

/**
 * Cache leads from API
 */
export async function cacheLeads(leads: CachedLead[]): Promise<void> {
  try {
    const database = await getIndexedDB();
    const now = Date.now();
    const leadsWithTimestamp = leads.map((lead: any) => {
      // Ensure _id exists for keyPath (fallback to id if needed)
      if (!lead._id && lead.id) {
        lead._id = lead.id;
      }
      if (!lead._id) {
        console.warn('Lead missing _id:', lead);
        lead._id = `lead_${Date.now()}_${Math.random()}`;
      }
      return {
        ...lead,
        cachedAt: now,
      };
    });

    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAMES.CACHED_LEADS], 'readwrite');
      const store = transaction.objectStore(STORE_NAMES.CACHED_LEADS);

      // Clear old cache first
      store.clear();

      leadsWithTimestamp.forEach((lead) => {
        try {
          store.add(lead);
        } catch (itemError) {
          console.error('Error adding lead to cache:', lead, itemError);
        }
      });

      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();
    });
  } catch (error) {
    console.error('Error caching leads:', error);
    throw error;
  }
}

/**
 * Get cached leads
 */
export async function getCachedLeads(): Promise<CachedLead[]> {
  try {
    const database = await getIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAMES.CACHED_LEADS], 'readonly');
      const store = transaction.objectStore(STORE_NAMES.CACHED_LEADS);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  } catch (error) {
    console.error('Error getting cached leads:', error);
    return [];
  }
}

/**
 * Cache users
 */
export async function cacheUsers(users: CachedUser[]): Promise<void> {
  try {
    const database = await getIndexedDB();
    const now = Date.now();
    const usersWithTimestamp = users.map((user: any) => {
      // Ensure _id exists for keyPath
      if (!user._id && user.id) {
        user._id = user.id;
      }
      if (!user._id) {
        console.warn('User missing _id:', user);
        user._id = `user_${Date.now()}_${Math.random()}`;
      }
      return {
        ...user,
        cachedAt: now,
      };
    });

    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAMES.CACHED_USERS], 'readwrite');
      const store = transaction.objectStore(STORE_NAMES.CACHED_USERS);

      store.clear();

      usersWithTimestamp.forEach((user) => {
        try {
          store.add(user);
        } catch (itemError) {
          console.error('Error adding user to cache:', user, itemError);
        }
      });

      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();
    });
  } catch (error) {
    console.error('Error caching users:', error);
    throw error;
  }
}

/**
 * Get cached users
 */
export async function getCachedUsers(): Promise<CachedUser[]> {
  try {
    const database = await getIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAMES.CACHED_USERS], 'readonly');
      const store = transaction.objectStore(STORE_NAMES.CACHED_USERS);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  } catch (error) {
    console.error('Error getting cached users:', error);
    return [];
  }
}

/**
 * Cache announcements
 */
export async function cacheAnnouncements(announcements: CachedAnnouncement[]): Promise<void> {
  try {
    const database = await getIndexedDB();
    const now = Date.now();
    const announcementsWithTimestamp = announcements.map((ann: any) => {
      if (!ann._id && ann.id) {
        ann._id = ann.id;
      }
      if (!ann._id) {
        ann._id = `announcement_${Date.now()}_${Math.random()}`;
      }
      return {
        ...ann,
        cachedAt: now,
      };
    });

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(
        [STORE_NAMES.CACHED_ANNOUNCEMENTS],
        'readwrite'
      );
      const store = transaction.objectStore(STORE_NAMES.CACHED_ANNOUNCEMENTS);

      store.clear();

      announcementsWithTimestamp.forEach((ann) => {
        try {
          store.add(ann);
        } catch (itemError) {
          console.error('Error adding announcement to cache:', ann, itemError);
        }
      });

      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();
    });
  } catch (error) {
    console.error('Error caching announcements:', error);
    throw error;
  }
}

/**
 * Get cached announcements
 */
export async function getCachedAnnouncements(): Promise<CachedAnnouncement[]> {
  try {
    const database = await getIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAMES.CACHED_ANNOUNCEMENTS], 'readonly');
      const store = transaction.objectStore(STORE_NAMES.CACHED_ANNOUNCEMENTS);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  } catch (error) {
    console.error('Error getting cached announcements:', error);
    return [];
  }
}

/**
 * Cache stats
 */
export async function cacheStats(stats: CachedStats): Promise<void> {
  try {
    const database = await getIndexedDB();
    const statsWithTimestamp = {
      statsId: 'main',
      ...stats,
      cachedAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAMES.CACHED_STATS], 'readwrite');
      const store = transaction.objectStore(STORE_NAMES.CACHED_STATS);
      const request = store.put(statsWithTimestamp);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error('Error caching stats:', error);
    throw error;
  }
}

/**
 * Get cached stats
 */
export async function getCachedStats(): Promise<CachedStats | null> {
  try {
    const database = await getIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAMES.CACHED_STATS], 'readonly');
      const store = transaction.objectStore(STORE_NAMES.CACHED_STATS);
      const request = store.get('main');

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  } catch (error) {
    console.error('Error getting cached stats:', error);
    return null;
  }
}

/**
 * Cache activity logs
 */
export async function cacheActivityLogs(logs: CachedActivityLog[]): Promise<void> {
  try {
    const database = await getIndexedDB();
    const now = Date.now();
    const logsWithTimestamp = logs.map((log: any) => {
      if (!log._id && log.id) {
        log._id = log.id;
      }
      if (!log._id) {
        log._id = `log_${Date.now()}_${Math.random()}`;
      }
      return {
        ...log,
        cachedAt: now,
      };
    });

    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAMES.CACHED_ACTIVITY_LOGS], 'readwrite');
      const store = transaction.objectStore(STORE_NAMES.CACHED_ACTIVITY_LOGS);

      store.clear();

      logsWithTimestamp.forEach((log) => {
        try {
          store.add(log);
        } catch (itemError) {
          console.error('Error adding activity log to cache:', log, itemError);
        }
      });

      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();
    });
  } catch (error) {
    console.error('Error caching activity logs:', error);
    throw error;
  }
}

/**
 * Get cached activity logs
 */
export async function getCachedActivityLogs(): Promise<CachedActivityLog[]> {
  try {
    const database = await getIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAMES.CACHED_ACTIVITY_LOGS], 'readonly');
      const store = transaction.objectStore(STORE_NAMES.CACHED_ACTIVITY_LOGS);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  } catch (error) {
    console.error('Error getting cached activity logs:', error);
    return [];
  }
}

/**
 * Cache SMS logs
 */
export async function cacheSMSLogs(logs: CachedSMSLog[]): Promise<void> {
  try {
    const database = await getIndexedDB();
    const now = Date.now();
    const logsWithTimestamp = logs.map((log: any) => {
      if (!log._id && log.id) {
        log._id = log.id;
      }
      if (!log._id) {
        log._id = `smslog_${Date.now()}_${Math.random()}`;
      }
      return {
        ...log,
        cachedAt: now,
      };
    });

    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAMES.CACHED_SMS_LOGS], 'readwrite');
      const store = transaction.objectStore(STORE_NAMES.CACHED_SMS_LOGS);

      store.clear();

      logsWithTimestamp.forEach((log) => {
        try {
          store.add(log);
        } catch (itemError) {
          console.error('Error adding SMS log to cache:', log, itemError);
        }
      });

      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();
    });
  } catch (error) {
    console.error('Error caching SMS logs:', error);
    throw error;
  }
}

/**
 * Get cached SMS logs
 */
export async function getCachedSMSLogs(): Promise<CachedSMSLog[]> {
  try {
    const database = await getIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAMES.CACHED_SMS_LOGS], 'readonly');
      const store = transaction.objectStore(STORE_NAMES.CACHED_SMS_LOGS);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  } catch (error) {
    console.error('Error getting cached SMS logs:', error);
    return [];
  }
}

/**
 * Save cached note for offline creation
 */
export async function saveCachedNote(note: CachedNote): Promise<void> {
  try {
    const database = await getIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAMES.CACHED_NOTES], 'readwrite');
      const store = transaction.objectStore(STORE_NAMES.CACHED_NOTES);
      const request = store.add(note);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error('Error saving cached note:', error);
    throw error;
  }
}

/**
 * Get all cached notes for a lead
 */
export async function getCachedNotesForLead(leadId: string): Promise<CachedNote[]> {
  try {
    const database = await getIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAMES.CACHED_NOTES], 'readonly');
      const store = transaction.objectStore(STORE_NAMES.CACHED_NOTES);
      const index = store.index('leadId');
      const request = index.getAll(leadId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  } catch (error) {
    console.error('Error getting cached notes:', error);
    return [];
  }
}

/**
 * Get all pending notes (not yet synced)
 */
export async function getPendingNotes(): Promise<CachedNote[]> {
  try {
    const database = await getIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAMES.CACHED_NOTES], 'readonly');
      const store = transaction.objectStore(STORE_NAMES.CACHED_NOTES);
      const index = store.index('syncStatus');
      const request = index.getAll('pending');

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  } catch (error) {
    console.error('Error getting pending notes:', error);
    return [];
  }
}

/**
 * Update note sync status
 */
export async function updateNoteSyncStatus(
  noteId: string,
  status: 'pending' | 'synced' | 'failed'
): Promise<void> {
  try {
    const database = await getIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAMES.CACHED_NOTES], 'readwrite');
      const store = transaction.objectStore(STORE_NAMES.CACHED_NOTES);
      const getRequest = store.get(noteId);

      getRequest.onsuccess = () => {
        const note = getRequest.result;
        if (note) {
          note.syncStatus = status;
          const updateRequest = store.put(note);
          updateRequest.onerror = () => reject(updateRequest.error);
          updateRequest.onsuccess = () => resolve();
        } else {
          reject(new Error('Note not found'));
        }
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  } catch (error) {
    console.error('Error updating note sync status:', error);
    throw error;
  }
}

/**
 * Delete cached note (after successful sync)
 */
export async function deleteCachedNote(noteId: string): Promise<void> {
  try {
    const database = await getIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAMES.CACHED_NOTES], 'readwrite');
      const store = transaction.objectStore(STORE_NAMES.CACHED_NOTES);
      const request = store.delete(noteId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error('Error deleting cached note:', error);
    throw error;
  }
}

/**
 * Clear all cached data (used on logout)
 */
export async function clearAllCachedData(): Promise<void> {
  try {
    const database = await getIndexedDB();
    const storeNames = Object.values(STORE_NAMES);

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeNames, 'readwrite');

      storeNames.forEach((storeName) => {
        const store = transaction.objectStore(storeName);
        store.clear();
      });

      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();
    });
  } catch (error) {
    console.error('Error clearing all cached data:', error);
    throw error;
  }
}

// ==================== TRANSFORMATION HELPERS ====================

/**
 * Transform cached lead to component Lead interface
 */
export function transformCachedLeadToLead(cachedLead: CachedLead): any {
  return {
    id: cachedLead._id,
    fullName: cachedLead.fullName,
    location: cachedLead.location,
    soulState: cachedLead.soulState || 'UNBELIEVER',
    status: cachedLead.status || 'NEW_LEAD',
    ageRange: cachedLead.ageRange,
    phone: cachedLead.phone,
    address: cachedLead.address,
    additionalNotes: cachedLead.additionalNotes,
    gender: cachedLead.gender,
    createdByName: cachedLead.createdByName,
    assignedTo: cachedLead.assignedTo,
    createdAt: new Date().toISOString(), // Use cached timestamp
  };
}
