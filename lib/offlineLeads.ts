/**
 * Offline Lead Storage Service
 * Handles persistent storage of offline leads and cached data using IndexedDB.
 *
 * Key fixes vs. previous version:
 * - cache*() functions no longer mutate their input arguments
 * - _id is derived safely without modifying the original object
 * - Fallback IDs use crypto.randomUUID() instead of Math.random()
 */

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface OfflineLead {
  id: string;
  fullName: string;
  ageRange: string;
  phone?: string;
  address?: string;
  location: string;
  additionalNotes?: string;
  soulState: string;
  gender?: string;
  createdAt: string; // ISO string
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  syncError?: string;
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
  status?: string;
  addedBy?: { id: string; name: string } | null;
  assignedTo?: { id: string; name: string } | null;
  createdAt?: string; // Original server timestamp
  cachedAt: number; // When cached locally
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

// ─── Constants ────────────────────────────────────────────────────────────────

const DB_NAME = 'harvest_offline_db';
const DB_VERSION = 2;

const STORE = {
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

// ─── DB singleton ─────────────────────────────────────────────────────────────

let db: IDBDatabase | null = null;

function initIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      if (!database.objectStoreNames.contains(STORE.OFFLINE_LEADS)) {
        const s = database.createObjectStore(STORE.OFFLINE_LEADS, { keyPath: 'id' });
        s.createIndex('syncStatus', 'syncStatus', { unique: false });
        s.createIndex('createdAt', 'createdAt', { unique: false });
      }

      if (!database.objectStoreNames.contains(STORE.CACHED_LEADS)) {
        const s = database.createObjectStore(STORE.CACHED_LEADS, { keyPath: '_id' });
        s.createIndex('cachedAt', 'cachedAt', { unique: false });
      }

      if (!database.objectStoreNames.contains(STORE.CACHED_USERS)) {
        const s = database.createObjectStore(STORE.CACHED_USERS, { keyPath: '_id' });
        s.createIndex('role', 'role', { unique: false });
        s.createIndex('cachedAt', 'cachedAt', { unique: false });
      }

      if (!database.objectStoreNames.contains(STORE.CACHED_ANNOUNCEMENTS)) {
        const s = database.createObjectStore(STORE.CACHED_ANNOUNCEMENTS, { keyPath: '_id' });
        s.createIndex('cachedAt', 'cachedAt', { unique: false });
      }

      if (!database.objectStoreNames.contains(STORE.CACHED_STATS)) {
        database.createObjectStore(STORE.CACHED_STATS, { keyPath: 'statsId' });
      }

      if (!database.objectStoreNames.contains(STORE.CACHED_ACTIVITY_LOGS)) {
        const s = database.createObjectStore(STORE.CACHED_ACTIVITY_LOGS, { keyPath: '_id' });
        s.createIndex('cachedAt', 'cachedAt', { unique: false });
      }

      if (!database.objectStoreNames.contains(STORE.CACHED_SMS_LOGS)) {
        const s = database.createObjectStore(STORE.CACHED_SMS_LOGS, { keyPath: '_id' });
        s.createIndex('cachedAt', 'cachedAt', { unique: false });
      }

      if (!database.objectStoreNames.contains(STORE.CACHED_NOTES)) {
        const s = database.createObjectStore(STORE.CACHED_NOTES, { keyPath: '_id' });
        s.createIndex('leadId', 'leadId', { unique: false });
        s.createIndex('syncStatus', 'syncStatus', { unique: false });
      }

      if (!database.objectStoreNames.contains(STORE.QUEUED_OPERATIONS)) {
        const s = database.createObjectStore(STORE.QUEUED_OPERATIONS, {
          keyPath: 'id',
          autoIncrement: true,
        });
        s.createIndex('status', 'status', { unique: false });
        s.createIndex('resourceId', 'resourceId', { unique: false });
        s.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}

export async function getIndexedDB(): Promise<IDBDatabase> {
  if (!db) db = await initIndexedDB();
  return db;
}

// ─── Generic IDB helpers ──────────────────────────────────────────────────────

function idbGet<T>(db: IDBDatabase, store: string, key: IDBValidKey): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

function idbGetAll<T>(db: IDBDatabase, store: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

function idbGetAllByIndex<T>(
  db: IDBDatabase,
  store: string,
  indexName: string,
  key: IDBValidKey
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).index(indexName).getAll(key);
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

function idbAdd(db: IDBDatabase, store: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).add(value);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function idbDelete(db: IDBDatabase, store: string, key: IDBValidKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Clear a store then bulk-insert records in one transaction.
 * Does NOT mutate the input array.
 */
function idbReplaceAll(db: IDBDatabase, store: string, records: unknown[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const objectStore = tx.objectStore(store);

    objectStore.clear();
    for (const record of records) {
      objectStore.add(record);
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Offline leads ────────────────────────────────────────────────────────────

export async function saveOfflineLead(lead: OfflineLead): Promise<void> {
  const database = await getIndexedDB();
  return idbAdd(database, STORE.OFFLINE_LEADS, lead);
}

export async function getOfflineLeads(): Promise<OfflineLead[]> {
  const database = await getIndexedDB();
  return idbGetAll<OfflineLead>(database, STORE.OFFLINE_LEADS);
}

export async function getPendingLeads(): Promise<OfflineLead[]> {
  const leads = await getOfflineLeads();
  return leads.filter((l) => l.syncStatus === 'pending' || l.syncStatus === 'failed');
}

export async function updateLeadSyncStatus(
  leadId: string,
  status: OfflineLead['syncStatus'],
  error?: string
): Promise<void> {
  const database = await getIndexedDB();
  const lead = await idbGet<OfflineLead>(database, STORE.OFFLINE_LEADS, leadId);
  if (!lead) throw new Error(`Offline lead not found: ${leadId}`);

  const updated: OfflineLead = { ...lead, syncStatus: status };
  if (error !== undefined) updated.syncError = error;

  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE.OFFLINE_LEADS, 'readwrite');
    const req = tx.objectStore(STORE.OFFLINE_LEADS).put(updated);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteOfflineLead(leadId: string): Promise<void> {
  const database = await getIndexedDB();
  return idbDelete(database, STORE.OFFLINE_LEADS, leadId);
}

export async function clearOfflineLeads(): Promise<void> {
  const database = await getIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE.OFFLINE_LEADS, 'readwrite');
    const req = tx.objectStore(STORE.OFFLINE_LEADS).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ─── Cache helpers ────────────────────────────────────────────────────────────

/** Derive a safe _id from an API record without mutating the original. */
function resolveId(record: Record<string, unknown>, fallbackPrefix: string): string {
  const id = (record.id ?? record._id) as string | undefined;
  if (id) return id;
  console.warn(`[offlineLeads] Record missing id:`, record);
  return `${fallbackPrefix}_${crypto.randomUUID()}`;
}

// ─── Cached leads ─────────────────────────────────────────────────────────────

export async function cacheLeads(leads: Omit<CachedLead, 'cachedAt'>[]): Promise<void> {
  const database = await getIndexedDB();
  const now = Date.now();
  const records: CachedLead[] = leads.map((lead) => ({
    ...lead,
    _id: resolveId(lead as unknown as Record<string, unknown>, 'lead'),
    cachedAt: now,
  }));
  return idbReplaceAll(database, STORE.CACHED_LEADS, records);
}

export async function getCachedLeads(): Promise<CachedLead[]> {
  const database = await getIndexedDB();
  return idbGetAll<CachedLead>(database, STORE.CACHED_LEADS);
}

// ─── Cached users ─────────────────────────────────────────────────────────────

export async function cacheUsers(users: Omit<CachedUser, 'cachedAt'>[]): Promise<void> {
  const database = await getIndexedDB();
  const now = Date.now();
  const records: CachedUser[] = users.map((user) => ({
    ...user,
    _id: resolveId(user as unknown as Record<string, unknown>, 'user'),
    cachedAt: now,
  }));
  return idbReplaceAll(database, STORE.CACHED_USERS, records);
}

export async function getCachedUsers(): Promise<CachedUser[]> {
  const database = await getIndexedDB();
  return idbGetAll<CachedUser>(database, STORE.CACHED_USERS);
}

// ─── Cached announcements ─────────────────────────────────────────────────────

export async function cacheAnnouncements(
  announcements: Omit<CachedAnnouncement, 'cachedAt'>[]
): Promise<void> {
  const database = await getIndexedDB();
  const now = Date.now();
  const records: CachedAnnouncement[] = announcements.map((ann) => ({
    ...ann,
    _id: resolveId(ann as unknown as Record<string, unknown>, 'announcement'),
    cachedAt: now,
  }));
  return idbReplaceAll(database, STORE.CACHED_ANNOUNCEMENTS, records);
}

export async function getCachedAnnouncements(): Promise<CachedAnnouncement[]> {
  const database = await getIndexedDB();
  return idbGetAll<CachedAnnouncement>(database, STORE.CACHED_ANNOUNCEMENTS);
}

// ─── Cached stats ─────────────────────────────────────────────────────────────

export async function cacheStats(stats: Omit<CachedStats, 'cachedAt'>): Promise<void> {
  const database = await getIndexedDB();
  const record = { statsId: 'main', ...stats, cachedAt: Date.now() };
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE.CACHED_STATS, 'readwrite');
    const req = tx.objectStore(STORE.CACHED_STATS).put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getCachedStats(): Promise<CachedStats | null> {
  const database = await getIndexedDB();
  const result = await idbGet<CachedStats & { statsId: string }>(
    database,
    STORE.CACHED_STATS,
    'main'
  );
  return result ?? null;
}

// ─── Cached activity logs ─────────────────────────────────────────────────────

export async function cacheActivityLogs(
  logs: Omit<CachedActivityLog, 'cachedAt'>[]
): Promise<void> {
  const database = await getIndexedDB();
  const now = Date.now();
  const records = logs.map((log) => ({ ...log, cachedAt: now }));
  return idbReplaceAll(database, STORE.CACHED_ACTIVITY_LOGS, records);
}

export async function getCachedActivityLogs(): Promise<CachedActivityLog[]> {
  const database = await getIndexedDB();
  return idbGetAll<CachedActivityLog>(database, STORE.CACHED_ACTIVITY_LOGS);
}

// ─── Cached SMS logs ──────────────────────────────────────────────────────────

export async function cacheSMSLogs(logs: Omit<CachedSMSLog, 'cachedAt'>[]): Promise<void> {
  const database = await getIndexedDB();
  const now = Date.now();
  const records = logs.map((log) => ({ ...log, cachedAt: now }));
  return idbReplaceAll(database, STORE.CACHED_SMS_LOGS, records);
}

export async function getCachedSMSLogs(): Promise<CachedSMSLog[]> {
  const database = await getIndexedDB();
  return idbGetAll<CachedSMSLog>(database, STORE.CACHED_SMS_LOGS);
}

// ─── Cached notes ─────────────────────────────────────────────────────────────

export async function saveCachedNote(note: CachedNote): Promise<void> {
  const database = await getIndexedDB();
  return idbAdd(database, STORE.CACHED_NOTES, note);
}

export async function getCachedNotesForLead(leadId: string): Promise<CachedNote[]> {
  const database = await getIndexedDB();
  return idbGetAllByIndex<CachedNote>(database, STORE.CACHED_NOTES, 'leadId', leadId);
}

export async function getPendingNotes(): Promise<CachedNote[]> {
  const database = await getIndexedDB();
  return idbGetAllByIndex<CachedNote>(database, STORE.CACHED_NOTES, 'syncStatus', 'pending');
}

export async function updateNoteSyncStatus(
  noteId: string,
  status: CachedNote['syncStatus']
): Promise<void> {
  const database = await getIndexedDB();
  const note = await idbGet<CachedNote>(database, STORE.CACHED_NOTES, noteId);
  if (!note) throw new Error(`Cached note not found: ${noteId}`);

  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE.CACHED_NOTES, 'readwrite');
    const req = tx.objectStore(STORE.CACHED_NOTES).put({ ...note, syncStatus: status });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteCachedNote(noteId: string): Promise<void> {
  const database = await getIndexedDB();
  return idbDelete(database, STORE.CACHED_NOTES, noteId);
}

// ─── Full clear ───────────────────────────────────────────────────────────────

export async function clearAllCachedData(): Promise<void> {
  const database = await getIndexedDB();
  const storeNames = Object.values(STORE);
  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeNames, 'readwrite');
    for (const name of storeNames) {
      tx.objectStore(name).clear();
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Transform helpers ────────────────────────────────────────────────────────

/** Typed shape expected by LeadTable and other lead-consuming components. */
export interface TransformedLead {
  id: string;
  fullName: string;
  location: string;
  soulState: string;
  status: string;
  ageRange: string;
  phone?: string;
  address?: string;
  additionalNotes?: string;
  gender?: string;
  createdByName?: string;
  assignedTo?: { id: string; name: string } | null;
  addedBy?: { id: string; name: string } | null;
  createdAt: string;
}

export function transformCachedLeadToLead(cachedLead: CachedLead): TransformedLead {
  return {
    id: cachedLead._id,
    fullName: cachedLead.fullName,
    location: cachedLead.location,
    soulState: cachedLead.soulState ?? 'UNBELIEVER',
    status: cachedLead.status ?? 'NEW_LEAD',
    ageRange: cachedLead.ageRange,
    phone: cachedLead.phone,
    address: cachedLead.address,
    additionalNotes: cachedLead.additionalNotes,
    gender: cachedLead.gender,
    createdByName: cachedLead.addedBy?.name,
    assignedTo: cachedLead.assignedTo ?? null,
    addedBy: cachedLead.addedBy ?? null,
    createdAt: cachedLead.createdAt || new Date(cachedLead.cachedAt).toISOString(),
  };
}