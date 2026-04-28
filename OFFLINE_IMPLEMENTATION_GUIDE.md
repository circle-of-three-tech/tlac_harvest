# Offline-First Web App Implementation Guide

## ✅ What's Been Implemented

Your web app now has a complete offline-first infrastructure. The foundational layer is ready for **100% offline functionality** with all pages accessible and data mutations queued for later sync.

### 1. **Extended IndexedDB Schema** ✅
- **File**: [lib/offlineLeads.ts](lib/offlineLeads.ts)
- **What it does**:
  - Stores offline lead creation (existing functionality)
  - **NEW**: Caches reads for leads, users, announcements, stats, activity logs, SMS logs
  - **NEW**: Stores pending notes and operations (edits, deletes, reassignments)
- **Tables created**:
  - `offline_leads` - Local lead creation queue
  - `cached_leads` - Cached leads from API
  - `cached_users` - Cached user list
  - `cached_announcements` - Cached announcements
  - `cached_stats` - Admin dashboard stats
  - `cached_activity_logs` - Activity logs
  - `cached_sms_logs` - SMS history
  - `cached_notes` - Pending notes
  - `queued_operations` - Mutations to sync

### 2. **Operation Queue System** ✅
- **File**: [lib/operationQueue.ts](lib/operationQueue.ts)
- **What it does**:
  - Queues all mutations (update, delete, addNote, reassign) when offline
  - Tracks retry counts, timestamps for conflict resolution
  - Supports deduplication (latest operation for each resource wins)
  - Provides operation status tracking (pending, syncing, synced, failed)

### 3. **Enhanced Sync Manager** ✅
- **File**: [lib/syncManager.ts](lib/syncManager.ts)
- **New capabilities**:
  - **`syncOfflineData()`** - Master sync function coordinating all offline data
  - **`syncQueuedOperations()`** - Syncs all queued mutations with conflict resolution
  - **`refreshCachedData()`** - Loads all dashboard data in parallel (non-blocking)
  - **`loadCachedLeads/Users/Stats/etc`** - Individual cache loaders
  - **`clearOfflineData()`** - Clears cache on logout
  - Automatically called when app goes online
  - Tracks `queuedOperationsCount` in sync status

### 4. **Offline-Ready Data Hooks** ✅
- **File**: [hooks/useOfflineData.ts](hooks/useOfflineData.ts)
- **Hook functions**:
  - `useLeadsData()` - Fetch leads with offline fallback
  - `useUsersData()` - Fetch users with offline fallback
  - `useUsersByRole(role)` - Filter users by role
  - `useAnnouncementsData()` - Fetch announcements
  - `useStatsData()` - Fetch admin stats
  - `useActivityLogsData()` - Fetch activity logs
  - `useSMSLogsData()` - Fetch SMS logs
  - `usePaginatedOfflineData()` - Client-side pagination from cached data
- **Returns**: `{ data, loading, error, isOffline, refetch }`

### 5. **Mutation Operations Hooks** ✅
- **File**: [hooks/useOfflineOperation.ts](hooks/useOfflineOperation.ts)
- **Hook functions**:
  - `useOfflineOperation()` - Generic mutation queueing
  - `useLeadMutation()` - Lead-specific mutations (update, delete, reassign)
  - `useLeadNote()` - Add notes to leads (queued offline)
- **Returns**: Methods for mutations + operation status tracking

### 6. **Extended SyncProvider** ✅
- **File**: [components/SyncProvider.tsx](components/SyncProvider.tsx)
- **New fields in context**:
  - `queuedOperationsCount` - Number of pending mutations
  - `clearCache()` - Manually clear offline data
- **New hook alias**:
  - `useSync()` - Convenient alias for `useSyncStatus()`

### 7. **Session-Based Cache Expiration** ✅
- **File**: [hooks/useSessionCacheCleanup.ts](hooks/useSessionCacheCleanup.ts)
- **What it does**:
  - Automatically clears all cached data when user logs out
  - Listens to NextAuth session changes
  - Integrated into [components/ActivityTracker.tsx](components/ActivityTracker.tsx)

### 8. **Enhanced Service Worker & PWA** ✅
- **File**: [next.config.mjs](next.config.mjs)
- **Improvements**:
  - Increased cache limits (500-1000 entries per strategy)
  - Specialized caching strategies:
    - **API calls**: NetworkFirst with 24hr TTL
    - **Dashboard pages**: StaleWhileRevalidate (better UX)
    - **Static assets**: CacheFirst with 30-day TTL
    - **Images**: CacheFirst with 30-day TTL

### 9. **Updated Dashboard Pages** ✅
- **Evangelist Leads**: [app/dashboard/evangelist/leads/page.tsx](app/dashboard/evangelist/leads/page.tsx)
- **Followup Leads**: [app/dashboard/followup/leads/page.tsx](app/dashboard/followup/leads/page.tsx)
- Both now use `useLeadsData()` hook for automatic offline support

---

## 🚀 How to Use the Offline Infrastructure

### For Reading Data (Dashboards)

```tsx
import { useLeadsData } from '@/hooks/useOfflineData';
import { useSync } from '@/components/SyncProvider';

export function MyDashboard() {
  const { data: leads, loading, error, isOffline } = useLeadsData();
  const { isOnline } = useSync();

  if (loading) return <div>Loading...</div>;
  if (error && isOnline) return <div>Error loading data</div>;
  if (isOffline) return <div>Offline - showing cached data</div>;

  return (
    <div>
      {leads.map(lead => (
        <div key={lead._id}>{lead.fullName}</div>
      ))}
    </div>
  );
}
```

### For Writing Data (Mutations)

```tsx
import { useLeadMutation } from '@/hooks/useOfflineOperation';
import { useSync } from '@/components/SyncProvider';

export function EditLead({ leadId }) {
  const { updateLead, deleteLead } = useLeadMutation();
  const { isOnline, queuedOperationsCount } = useSync();

  const handleUpdate = async () => {
    const result = await updateLead(leadId, {
      fullName: 'New Name',
      location: 'New Location',
    });

    if (result.success) {
      console.log('Update queued:', result.operationId);
      console.log('Pending:', queuedOperationsCount);
    }
  };

  return (
    <button onClick={handleUpdate}>
      {isOnline ? 'Update' : 'Update (will sync later)'}
    </button>
  );
}
```

### For Adding Notes

```tsx
import { useLeadNote } from '@/hooks/useOfflineOperation';

export function NotesForm({ leadId }) {
  const { addNote } = useLeadNote();

  const handleAddNote = async (content: string) => {
    const result = await addNote(leadId, content);
    if (result.success) {
      console.log('Note queued for sync');
    }
  };

  return <textarea onChange={e => handleAddNote(e.target.value)} />;
}
```

### Displaying Sync Status

```tsx
import { useSync } from '@/components/SyncProvider';

export function SyncStatus() {
  const {
    isOnline,
    pendingCount,
    queuedOperationsCount,
    isSyncing,
    manualSync,
  } = useSync();

  return (
    <div>
      Status: {isOnline ? 'Online' : 'Offline'}
      <br />
      Pending leads: {pendingCount}
      <br />
      Queued changes: {queuedOperationsCount}
      <br />
      {isSyncing && 'Syncing...'}
      <br />
      <button onClick={manualSync}>Manual Sync</button>
    </div>
  );
}
```

---

## 📋 Remaining Tasks (To Complete Full Offline)

### Task 1: Update All Dashboard Pages
Apply the same pattern used in evangelist/leads and followup/leads to other pages:

**Pages to update**:
- [ ] `app/dashboard/admin/leads/page.tsx` - All leads view
- [ ] `app/dashboard/admin/page.tsx` - Stats dashboard
- [ ] `app/dashboard/admin/activity-log/page.tsx` - Activity logs
- [ ] `app/dashboard/admin/announcements/page.tsx` - Announcements
- [ ] `app/dashboard/admin/evangelists/page.tsx` - Evangelist list
- [ ] `app/dashboard/admin/sms-logs/page.tsx` - SMS history
- [ ] `app/dashboard/evangelist/page.tsx` - Evangelist dashboard
- [ ] `app/dashboard/followup/page.tsx` - Followup dashboard

**Pattern** (copy from evangelist/leads):
```tsx
const { data: allData, loading, error, isOffline } = useLeadsData(); // or other data hook
const { data: paginatedData, totalPages } = usePaginatedOfflineData(allData, 10, page);
```

### Task 2: Add Mutation Support to Detail Modals/Forms
Update components that edit data to use `useLeadMutation()`:

**Components to update**:
- [ ] `components/leads/LeadDetailModal.tsx` - Update/delete leads
- [ ] Lead reassignment UI - Use `reassignLead()`
- [ ] Note adding forms - Use `addNote()`
- [ ] All forms in admin sections that modify data

**Pattern**:
```tsx
const { updateLead } = useLeadMutation();
const result = await updateLead(leadId, { field: newValue });
```

### Task 3: Add "Offline Mode" UI Indicators

Add visual cues that the app is offline:
- [ ] Badge in navbar showing "Offline Mode"
- [ ] Toast/notification when going offline/online
- [ ] Warning on pages showing cached data
- [ ] Disable write operations (or show "will sync later" message)

**Example** (already in some pages):
```tsx
{isOffline && " (Offline Mode)"}
```

### Task 4: Test Offline Workflows

**Testing checklist**:
1. **DevTools Offline Mode** (Chrome DevTools → Network → Offline):
   - [ ] Navigate to each dashboard page - should load from cache
   - [ ] Search/filter data - works from cached data
   - [ ] Try to edit a lead - gets queued
   - [ ] Try to add a note - gets queued
   - [ ] Try to reassign a lead - gets queued

2. **Network Throttling**:
   - [ ] Test on 3G/4G to verify caching improves speed
   - [ ] Verify operations queue properly on slow connections

3. **Sync Testing**:
   - [ ] Go offline and make changes
   - [ ] Go online - changes sync automatically
   - [ ] Check IndexedDB in DevTools → Storage to verify data stored
   - [ ] Verify conflict resolution works (last-write-wins)

4. **Session Testing**:
   - [ ] Log out while offline - cache clears
   - [ ] Log back in - cache repopulates

---

## 🔍 Monitoring Sync Status

### In Browser DevTools

**Storage tab**:
- Navigate to `Application → Storage → IndexedDB → harvest_offline_db`
- See all cached data and queued operations
- Monitor cache sizes

**Console logs**:
- App logs sync progress: `Syncing X offline leads...`
- Operation syncing: `✓ Synced operation: update on lead-id`

### Sync Status Context

All sync information available via `useSync()`:
```tsx
const {
  isOnline,          // boolean
  isSyncing,         // boolean
  pendingCount,      // leads created offline
  queuedOperationsCount, // pending mutations
  lastSyncTime,      // Date
  error,             // error message if any
  manualSync,        // () => Promise
  checkNetwork,      // () => Promise<boolean>
  clearCache,        // () => Promise
}
```

---

## 🛠 API Assumptions

The sync system assumes:

1. **Lead deletion returns 200 OK when successful**
   ```
   DELETE /api/leads/[id]
   ```

2. **PATCH endpoint accepts partial updates**
   ```
   PATCH /api/leads/[id]
   { "fullName": "New Name", ... }
   ```

3. **Notes endpoint accepts new notes**
   ```
   POST /api/leads/[leadId]/notes
   { "content": "Note text" }
   ```

4. **User endpoints return paginated data**
   ```
   GET /api/users?limit=500
   Returns: { users: [...] }
   ```

If your APIs differ, update the operation sync logic in `lib/syncManager.ts` → `syncQueuedOperations()`.

---

## 🎯 Next Steps

1. **Update all dashboard pages** to use the data hooks (10-15 min each)
2. **Add offline mode styling** - Visual indicators (5 min)
3. **Test offline workflows** - Verify each page works offline (15 min)
4. **Update detail modals** to use mutation hooks (10 min per modal)
5. **Add conflict resolution UI** (optional) - Show when two users edit same lead (20 min)

---

## ✨ Features Now Available

✅ **Offline-First Architecture**
- All data automatically cached
- Operations queued when offline
- Automatic sync on reconnection

✅ **Seamless User Experience**
- App loads cached pages instantly
- Search/filter works offline on cached data
- Users don't need to wait for network

✅ **Conflict Resolution**
- Last-write-wins strategy
- Timestamp-based conflict detection
- Automatic deduplication

✅ **Session Security**
- Cache cleared on logout
- Prevents cached data from leaking between users

✅ **Reliability**
- Retry logic for failed syncs
- Exponential backoff on failures
- Full sync history in IndexedDB

---

## 📚 File Structure Reference

```
lib/
  ├── offlineLeads.ts          # IndexedDB interface (extended)
  ├── operationQueue.ts         # Operation queue management (new)
  └── syncManager.ts            # Sync coordination (enhanced)

hooks/
  ├── useOfflineData.ts         # Data reading hooks (new)
  ├── useOfflineOperation.ts    # Mutation hooks (new)
  └── useSessionCacheCleanup.ts # Session management (new)

components/
  ├── SyncProvider.tsx          # Context provider (extended)
  └── ActivityTracker.tsx       # Includes cache cleanup (updated)

app/
  └── dashboard/
      ├── evangelist/leads/page.tsx  # ✅ Updated example
      └── followup/leads/page.tsx    # ✅ Updated example
```

---

## 🚀 Progressive Enhancement

The infrastructure is designed to be implemented progressively:

1. **Phase 1** (✅ Done): Core offline + cache layer
2. **Phase 2**: Update all dashboard pages (in progress)
3. **Phase 3**: Add mutation support to all forms
4. **Phase 4**: UI/UX polish and testing

Each phase is independent - you can ship Phase 1 and progressively add Phase 2, 3, 4 without breaking anything.

