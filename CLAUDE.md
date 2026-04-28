# CLAUDE.md — TLAC Harvest Development Guide

**TLAC Harvest** is an offline-first faith-based evangelism lead management PWA. This guide helps Claude understand the codebase structure, conventions, and domain knowledge required for effective development and debugging.

## Quick Context

| Aspect | Value |
|--------|-------|
| **Framework** | Next.js 14 (App Router) + React 18 |
| **Database** | PostgreSQL + Prisma ORM |
| **Auth** | NextAuth.js (JWT, email/password) |
| **Offline** | IndexedDB + operation queue + SyncManager |
| **SMS** | Bulk SMS Nigeria API + template system |
| **Key Features** | Lead CRM, SMS templates, push notifications, activity audits, RBAC |

## When Claude Should Apply This Guide

Use this guide when:
- **Building features** related to leads, SMS, push notifications, or offline sync
- **Fixing bugs** in API routes, React components, or offline data flow
- **Optimizing queries** or improving sync logic
- **Reviewing code** for patterns, conventions, and best practices
- **Debugging** network issues, cache problems, or role-based filtering
- **Adding domain knowledge** about SMS templates, activity tracking, or permission models

---

## 1. API Route Patterns

### Structure & Conventions

All API routes follow a consistent pattern:

```typescript
// app/api/[resource]/route.ts
export const dynamic = 'force-dynamic';  // Fresh data on every request

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Parse & validate
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    
    // 2. Apply role-based filtering
    const leads = await prisma.lead.findMany({
      where: {
        ...(session.user.role === UserRole.EVANGELIST && {
          addedByUserId: session.user.id,
        }),
        // Other filters...
      },
      skip: (page - 1) * 10,
      take: 10,
    });

    return Response.json(leads);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
```

### Key Rules

1. **Always check role server-side** — Never trust client-side filtering
2. **Use `force-dynamic`** — Disables static generation for always-fresh data
3. **Validate input with Zod** — Parse before using
4. **Handle errors gracefully** — Return meaningful HTTP status codes
5. **Fire-and-forget side effects** — Wrap SMS, push, audit in `void()` to avoid blocking responses

### Common Query Parameters

- `page` — Pagination (default: 1)
- `limit` — Items per page (default: 10)
- `status` — Filter by lead status (NEW_LEAD, FOLLOWING_UP, CONVERTED)
- `soulState` — Filter by soul state (UNBELIEVER, NEW_CONVERT, etc.)
- `dateFrom`, `dateTo` — Date range filters
- `sortBy` — Field to sort by (e.g., "createdAt", "name")
- `order` — Sort direction (asc, desc)

### Common Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/leads` | GET | List all leads (role-filtered) |
| `/api/leads` | POST | Create new lead |
| `/api/leads/[id]` | GET | Get single lead |
| `/api/leads/[id]` | PATCH | Update lead |
| `/api/admin/sms-templates/[type]` | GET/POST/PATCH | SMS template CRUD |
| `/api/push/subscribe` | POST | Subscribe to push notifications |
| `/api/push/send-to-role` | POST | Broadcast push to role |
| `/api/admin/activity-log` | GET | Query activity audit log |

---

## 2. SMS Template System

### Overview

SMS templates are stored in the database and rendered with placeholder replacement. They support multiple triggers (immediate, scheduled, cron-based).

### Template Types

| Type | Trigger | When |
|------|---------|------|
| `NEW_LEAD_NOTIFICATION` | Cron (hourly) | ~1 hour after lead creation → Admin |
| `ADMIN_ALERT` | Immediate | New lead assigned → Admin |
| `FOLLOWUP_ASSIGNMENT` | Immediate | Lead assigned to followup user → Followup user |
| `INACTIVITY_REMINDER_7_DAYS` | Cron (daily) | After 7 days no update → Evangelist |
| `INACTIVITY_REMINDER_14_DAYS` | Cron (daily) | After 14 days no update → Evangelist |
| `INACTIVITY_REMINDER_30_DAYS` | Cron (daily) | After 30 days no update → Evangelist |

### Placeholder System

Templates use simple string replacement with curly braces:

```
Template: "Hi {leadName}, followup scheduled for {dateTime}"
Lead: { name: "John", createdAt: "2025-04-20T10:00:00Z" }
Result: "Hi John, followup scheduled for 2025-04-20"
```

### Available Placeholders

| Placeholder | Type | Example | Source |
|-------------|------|---------|--------|
| `{leadName}` | string | "John Doe" | `lead.name` |
| `{phone}` | string | "+2349012345678" | `lead.phone` |
| `{location}` | string | "Lagos" | `lead.location` |
| `{soulState}` | string | "UNBELIEVER" | `lead.soulState` |
| `{status}` | string | "NEW_LEAD" | `lead.status` |
| `{assigneeName}` | string | "Jane Smith" | `lead.assignedTo.name` |
| `{evangelistName}` | string | "John Evangelist" | `lead.addedBy.name` |
| `{dateCreated}` | date | "2025-04-20" | `lead.createdAt.toISOString()` |
| `{dateTime}` | datetime | "2025-04-20 2:30 PM" | Formatted `lead.createdAt` |

### Code Examples

**SMS Rendering** ([lib/sms.ts](lib/sms.ts#L1)):

```typescript
export async function renderSMSTemplate(
  type: SMSTemplateType,
  lead: Lead,
  context?: Record<string, any>
): Promise<string> {
  const template = await prisma.sMSTemplate.findUnique({
    where: { type },
  });
  
  if (!template) {
    return fallbackTemplates[type] || '';
  }

  let message = template.content;
  
  // Replace placeholders
  message = message.replace('{leadName}', lead.name);
  message = message.replace('{phone}', lead.phone);
  message = message.replace('{location}', lead.location || '');
  // ... more replacements
  
  return message;
}
```

**Sending SMS** ([lib/sms.ts](lib/sms.ts#L100)):

```typescript
export async function sendSMS(
  phoneNumber: string,
  message: string,
  templateType: SMSTemplateType
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const response = await fetch(process.env.BULK_SMS_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SMS_BEARER_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: phoneNumber,
      from: process.env.BULK_SMS_SENDER_ID,
      body: message,
    }),
  });

  const data = await response.json();
  
  // Log SMS attempt for audit
  void prisma.sMSLog.create({
    data: {
      phoneNumber,
      message,
      templateType,
      status: data.status,
      messageId: data.message_id,
      response: JSON.stringify(data),
    },
  });

  return {
    success: data.status === 'success',
    messageId: data.message_id,
    error: data.error,
  };
}
```

### Admin UI

The admin dashboard ([app/dashboard/admin/sms-templates](app/dashboard/admin/sms-templates)) allows:
- View all template types with current messages
- Edit templates with placeholder hints
- Preview rendered messages with test lead data
- Restore defaults

### Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| Placeholders show as `{leadName}` in SMS | Typo in template or placeholder name | Verify placeholder name matches exactly (case-sensitive) |
| SMS not sending | Network error or API key invalid | Check `SMS_BEARER_TOKEN` in `.env` and Bulk SMS account |
| Template not found | Type mismatch or missing from DB | Ensure template type matches enum (e.g., `NEW_LEAD_NOTIFICATION`) |
| Admin alerts not firing | Cron job not running or disabled | Check task endpoint `/api/tasks/send-lead-sms` is accessible |

---

## 3. Database & Prisma Patterns

### Key Enums

```typescript
// User roles
enum UserRole {
  EVANGELIST  = 'EVANGELIST'      // Views own leads
  FOLLOWUP    = 'FOLLOWUP'        // Views assigned leads
  ADMIN       = 'ADMIN'           // Views all leads
}

// Lead status workflow
enum LeadStatus {
  NEW_LEAD     = 'NEW_LEAD'       // Just added
  FOLLOWING_UP = 'FOLLOWING_UP'   // Being engaged
  CONVERTED    = 'CONVERTED'      // Accepted Jesus
}

// Soul spiritual state
enum SoulState {
  UNBELIEVER           = 'UNBELIEVER'
  NEW_CONVERT          = 'NEW_CONVERT'
  UNCHURCHED_BELIEVER  = 'UNCHURCHED_BELIEVER'
  HUNGRY_BELIEVER      = 'HUNGRY_BELIEVER'
}
```

### Core Models

**User** — Authenticated person with role(s) and permissions

```prisma
model User {
  id              String     @id @default(cuid())
  email           String     @unique
  name            String
  phone           String?
  roles           UserRole[] // Array support
  leads           Lead[]     @relation("addedBy")
  assignedLeads   Lead[]     @relation("assignedTo")
  auditLogs       AuditLog[]
  smsLogs         SMSLog[]
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt
}
```

**Lead** — Soul being evangelized

```prisma
model Lead {
  id              String         @id @default(cuid())
  name            String
  phone           String         @unique
  location        String?
  gender          String?
  soulState       SoulState
  status          LeadStatus     @default(NEW_LEAD)
  
  // Relationships
  addedByUserId   String
  addedBy         User           @relation("addedBy", fields: [addedByUserId], references: [id])
  assignedToUserId String?
  assignedTo      User?          @relation("assignedTo", fields: [assignedToUserId], references: [id])
  
  notes           Note[]
  smsLogs         SMSLog[]
  auditLogs       AuditLog[]
  
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
}
```

**AuditLog** — Immutable record of all lead changes

```prisma
model AuditLog {
  id              String     @id @default(cuid())
  leadId          String
  lead            Lead       @relation(fields: [leadId], references: [id], onDelete: Cascade)
  userId          String
  user            User       @relation(fields: [userId], references: [id])
  
  fieldName       String     // e.g., "status", "assignedTo"
  oldValue        String?    // JSON-stringified
  newValue        String?    // JSON-stringified
  
  createdAt       DateTime   @default(now())
}
```

### Query Patterns

**Get leads with role filtering**:

```typescript
// In server-side API route
const leads = await prisma.lead.findMany({
  where: {
    ...(session.user.roles.includes(UserRole.EVANGELIST) && {
      addedByUserId: session.user.id,
    }),
    ...(session.user.roles.includes(UserRole.FOLLOWUP) && {
      assignedToUserId: session.user.id,
    }),
    // ADMIN sees all, so no filter
  },
  include: {
    addedBy: true,
    assignedTo: true,
    notes: { orderBy: { createdAt: 'desc' }, take: 5 },
    auditLogs: { orderBy: { createdAt: 'desc' }, take: 10 },
  },
});
```

**Create lead with audit**:

```typescript
const lead = await prisma.lead.create({
  data: {
    name: 'John Doe',
    phone: '+2349012345678',
    status: LeadStatus.NEW_LEAD,
    soulState: SoulState.UNBELIEVER,
    addedByUserId: userId,
  },
  include: { addedBy: true },
});

// Auto-create audit log (or call audit helper)
void prisma.auditLog.create({
  data: {
    leadId: lead.id,
    userId,
    fieldName: 'lead_created',
    newValue: JSON.stringify(lead),
  },
});
```

### Common Mistakes

❌ **Don't**: Query without role filtering
```typescript
// WRONG: Returns all leads regardless of user role
const leads = await prisma.lead.findMany({});
```

✅ **Do**: Apply role-based WHERE clause
```typescript
// CORRECT: Filter based on role
const leads = await prisma.lead.findMany({
  where: {
    ...(user.role === UserRole.EVANGELIST && { addedByUserId: user.id }),
  },
});
```

---

## 4. React Hooks & Components

### Data Fetching Hooks

#### `useOfflineData` — Fetch with offline fallback

```typescript
const { data, loading, error, isOffline, refetch } = useOfflineData(
  'leads',  // Cache key
  () => fetch('/api/leads').then(r => r.json()),
  { revalidateInterval: 60000 }  // Revalidate every 60s
);
```

**When to use**: Read-only data that can be cached (leads list, templates, user profile)

#### `useOfflineLeadCreation` — Create lead offline-safe

```typescript
const { mutate: createLead, isLoading } = useOfflineLeadCreation({
  onSuccess: () => {
    toast.success('Lead created!');
    refetchLeads();
  },
  onError: (error) => {
    toast.error(error.message);
  },
});

mutate({
  name: 'Jane Doe',
  phone: '+2349012345678',
  location: 'Ibadan',
  soulState: 'UNBELIEVER',
});
```

**When to use**: Creating new leads, ensuring operation queues if offline

#### `useOfflineOperation` — Generic mutation hook

```typescript
const { mutate, isLoading } = useOfflineOperation({
  onSuccess: () => refetch(),
  onError: (err) => toast.error(err.message),
});

// Update lead status
mutate({
  type: 'PATCH',
  url: '/api/leads/123',
  payload: { status: 'CONVERTED' },
});

// Delete note
mutate({
  type: 'DELETE',
  url: '/api/notes/456',
});
```

**When to use**: Updates, patches, deletes — anything that modifies data

### Component Patterns

#### Lead Table Component

```typescript
// components/leads/LeadTable.tsx
export default function LeadTable() {
  const { data: leads, loading, isOffline, refetch } = useOfflineData('leads', fetchLeads);
  
  if (loading) return <Skeleton />;
  if (!leads?.length) return <EmptyState />;

  return (
    <>
      <table>
        <tbody>
          {leads.map(lead => (
            <tr key={lead.id}>
              <td>{lead.name}</td>
              <td>{lead.phone}</td>
              <td>
                <StatusBadge status={lead.status} />
              </td>
              <td>
                <Button onClick={() => handleEdit(lead)}>Edit</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {isOffline && <OfflineIndicator onRetry={refetch} />}
    </>
  );
}
```

### Sync Status Context

```typescript
// Use in any component
const { isOnline, isSyncing, pendingCount, lastSyncTime } = useContext(SyncContext);

return (
  <div>
    {!isOnline && <Banner>You are offline</Banner>}
    {isSyncing && <Spinner />}
    {pendingCount > 0 && <Badge>{pendingCount} pending</Badge>}
  </div>
);
```

---

## 5. Offline-First Architecture

### Quick Flow Diagram

```
User edits lead (offline)
       ↓
useOfflineOperation() → IndexedDB queue
       ↓
Network online detected
       ↓
SyncManager.syncOfflineData() awakens
       ↓
Replay queued operations → API
       ↓
Update service worker cache
       ↓
UI refetch shows latest
```

### Key Files

| File | Purpose |
|------|---------|
| [lib/offlineLeads.ts](lib/offlineLeads.ts) | IndexedDB abstraction (read/write offline cache) |
| [lib/operationQueue.ts](lib/operationQueue.ts) | Queue for mutations with deduplication (latest-wins) |
| [lib/syncManager.ts](lib/syncManager.ts) | Master sync orchestrator |
| [components/SyncProvider.tsx](components/SyncProvider.tsx) | Context exposing sync status |
| [hooks/useOfflineOperation.ts](hooks/useOfflineOperation.ts) | Hook to queue mutations |
| [hooks/useOfflineData.ts](hooks/useOfflineData.ts) | Hook to fetch with offline fallback |

### Under the Hood: Operation Queue

```typescript
// When user edits offline, operation is queued
const operation = {
  type: 'PATCH',
  url: '/api/leads/123',
  payload: { status: 'CONVERTED' },
  timestamp: Date.now(),
  broadcastId: uuid(),  // Dedup key
};

// Stored in IndexedDB: queued_operations
await offlineLeads.addOperation(operation);

// When online, SyncManager picks it up
const pending = await offlineLeads.getPendingOperations();
for (const op of pending) {
  const response = await fetch(op.url, {
    method: op.type,
    body: JSON.stringify(op.payload),
  });
  if (response.ok) {
    await offlineLeads.removeOperation(op.broadcastId);
  }
}
```

### Deduplication Strategy

**Latest-wins**: If two edits to the same resource happen offline, only the newest survives.

```typescript
// Operation queue deduplicates by broadcastId
// Same lead, different edits = last one wins
lead 123: status NEW_LEAD (edit 1) ❌ discarded
lead 123: status CONVERTED (edit 2) ✅ kept
```

---

## 6. Debugging Checklist

| Symptom | Likely Cause | Debugging Steps |
|---------|-------------|-----------------|
| **Offline edits silently fail** | Not using offline hook | 1. Open Network tab (offline mode) 2. Edit lead 3. Check browser console for warnings 4. Use `useOfflineOperation()` instead of direct fetch |
| **Data stale after network return** | Service worker cache issue | 1. Hard refresh (Ctrl+Shift+R) 2. Check `VERCEL_GIT_COMMIT_SHA` in Network tab headers 3. Manually call `checkNetwork()` 4. Check `public/sw.js` cache version |
| **SMS not sending** | API key, network, or template error | 1. Check `.env` for `SMS_BEARER_TOKEN` 2. Verify Bulk SMS account active 3. Check SMS sender ID (`BULK_SMS_SENDER_ID`) 4. Review SMS logs via admin dashboard 5. Test with `/api/tasks/send-lead-sms` endpoint |
| **Placeholders blank in SMS** | Typo in template or missing field | 1. Admin dashboard → SMS Templates 2. Verify placeholder name (e.g., `{leadName}`) 3. Check lead object has field 4. Preview with test data |
| **Push notifications not sending** | Invalid subscription or endpoint | 1. Check `PushSubscription` table (admin db view) 2. Unsubscribe + resubscribe device 3. Verify VAPID keys in `.env` 4. Check push logs |
| **Role-based data leaking** | Client-side filtering only | 1. Inspect API response (Network tab) 2. Verify server-side WHERE clause 3. Check `getServerSession()` call 4. Test with different user role |
| **Sync stuck or errors** | Exception in SyncManager | 1. Check browser console 2. Open IndexedDB (DevTools) and inspect `queued_operations` 3. Manually trigger sync: `window.__SYNC_MANAGER__.checkNetwork()` 4. Check server logs for API errors |

---

## 7. Build & Dev Commands

```bash
# Setup
npm install
npm run db:push          # Sync Prisma schema

# Development
npm run dev              # Start dev server (http://localhost:3000)
npm run lint             # ESLint check
npm run db:seed          # Seed test data

# Production
npm run build            # Full build (Prisma → PWA → Next.js)
npm run start            # Start server

# Database
npm run db:migrate dev   # Run pending migrations
npm run db:studio       # Open Prisma Studio GUI
```

---

## 8. Key Conventions

### File Naming

- **Components**: PascalCase (`LeadTable.tsx`, `AddLeadModal.tsx`)
- **Hooks**: camelCase with `use` prefix (`useOfflineData.ts`, `useActivityTracking.ts`)
- **Utils**: camelCase (`sms.ts`, `audit.ts`, `syncManager.ts`)
- **API routes**: Lowercase snake_case folders (`/api/sms-templates/[type]`)

### Error Handling

```typescript
// API Route
try {
  // logic
} catch (error) {
  if (error instanceof PrismaClientValidationError) {
    return Response.json({ error: 'Invalid data' }, { status: 400 });
  }
  return Response.json({ error: error.message }, { status: 500 });
}

// Component
const { mutate } = useOfflineOperation({
  onError: (error) => {
    if (error.status === 401) {
      redirect('/auth/login');
    } else if (error.status === 403) {
      toast.error('Permission denied');
    } else {
      toast.error('An error occurred: ' + error.message);
    }
  },
});
```

### Type Safety

```typescript
// Always type API responses
interface LeadResponse {
  id: string;
  name: string;
  status: LeadStatus;
  createdAt: Date;
}

const response = await fetch('/api/leads');
const leads: LeadResponse[] = await response.json();
```

---

## Related Documentation

- **Extended Instructions**: [.github/copilot-instructions.md](.github/copilot-instructions.md)
- **Prisma Schema**: [prisma/schema.prisma](prisma/schema.prisma)
- **SMS Deep Dive**: [/memories/repo/sms_template_system.md](/memories/repo/sms_template_system.md)
- **Offline Guide**: [OFFLINE_IMPLEMENTATION_GUIDE.md](OFFLINE_IMPLEMENTATION_GUIDE.md)

---

**Last updated**: April 2026 | Scope: TLAC Harvest Dev Team
