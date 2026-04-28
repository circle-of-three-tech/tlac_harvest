---
name: tlac-harvest
description: "Workspace instructions for TLAC Harvest — a faith-based evangelism lead management PWA. Use when: building features, fixing bugs, or reviewing code related to offline-first CRM, SMS templates, push notifications, activity auditing, or role-based access control."
---

# TLAC Harvest Workspace Instructions

**TLAC Harvest** is an offline-first faith-based evangelism lead management system (Progressive Web App) for tracking souls from initial contact through conversion. The system prioritizes reliability offline, smart sync on reconnection, and multi-role permission controls.

## Quick Facts

| Aspect | Value |
|--------|-------|
| **Framework** | Next.js 14 (App Router) with React 18 |
| **Database** | PostgreSQL + Prisma ORM |
| **Auth** | NextAuth.js (JWT + email/password) |
| **PWA** | next-pwa + Workbox, service worker caching |
| **Offline** | IndexedDB cache + operation queue + SyncManager |
| **Key Features** | Lead CRM, SMS templates (with placeholders), Web Push, Activity auditing, Role-based RBAC |

## Development Setup

```bash
npm install              # Install dependencies
npm run dev              # Start dev server (http://localhost:3000)
npm run db:push          # Sync Prisma schema to PostgreSQL
npm run db:seed          # Seed test data (evangelist, followup, admin users)
npm run build            # Full build: Prisma → PWA assets → Next.js build
npm run lint             # ESLint validation
```

**Important**: The build pipeline runs `prisma generate`, then `scripts/generate-pwa-assets.js` (PWA icons), then `next build`. Don't skip steps.

## Architecture Overview

### Three User Roles

- **Evangelist**: Views/creates own leads, tracks additions
- **Followup**: Views assigned leads, manages follow-up interactions
- **Admin**: Full visibility, manages SMS templates, users, activity logs, SMS logs

Server-side role-based filtering: `GET /api/leads` returns only the caller's visible leads.

### Offline-First Data Flow

1. **User goes offline** → Mutations queue to IndexedDB (`offline_leads`, `queued_operations`)
2. **Network returns** → `SyncManager.syncOfflineData()` plays back queued operations
3. **Deduplication**: Latest operation wins for each resource ("latest-wins strategy")
4. **Service worker**: Networks-first caching for GET, never for mutations

See [SyncProvider](components/SyncProvider.tsx) and [lib/syncManager.ts](lib/syncManager.ts) for integration.

### SMS Template System

Templates stored in database (Prisma `SMSTemplate`) with fallback defaults. Types:
- `NEW_LEAD_NOTIFICATION` — ~1 hour after lead creation (cron-triggered)
- `ADMIN_ALERT` — Immediate when new lead created
- `FOLLOWUP_ASSIGNMENT` — Immediate when lead assigned to followup user
- `INACTIVITY_REMINDER_*` — Scheduled inactivity reminders

**Placeholders**: Simple string replacement: `{leadName}`, `{phone}`, `{location}`, `{assigneeName}`, `{status}`, etc.

**Admin UI**: [app/dashboard/admin/sms-templates/page.tsx](app/dashboard/admin/sms-templates/page.tsx) — templates with CRUD via `/api/admin/sms-templates/[type]`

**Reference**: See [/memories/repo/sms_template_system.md](/memories/repo/sms_template_system.md) (detailed SMS system architecture, endpoints, triggers)

## Key Conventions

### API Routes

**Pattern**: `app/api/[resource]/route.ts` and `app/api/[resource]/[id]/route.ts`

```typescript
export const dynamic = 'force-dynamic';  // Every request is fresh (no caching)
const session = await getServerSession(authOptions);  // Auth check first
// Zod schema validation
const parsed = await req.json().then(data => CreateLeadSchema.parseAsync(data));
// Side effects (SMS, push, audit) wrapped in void() — don't block response
void sendAdminAlerts(lead);
```

**Pagination/Filtering**: Query params `?page=1&limit=10&status=NEW_LEAD&soulState=UNBELIEVER&dateFrom=2025-01-01&dateTo=2025-12-31`

**Role-based filtering** happens server-side; clients can't bypass.

### Frontend Components

**Location**: `components/[feature]/[Component].tsx`

**Data fetching hooks return**: `{ data, loading, error, isOffline, refetch }`

**Offline-safe mutations**: Use `useOfflineOperation()` or `useOfflineLeadCreation()` — never call API directly.

```typescript
const { mutate, isLoading } = useOfflineOperation({  // or useOfflineLeadCreation
  onSuccess: () => refetch(),
  onError: (err) => toast.error(err.message),
});

mutate({ type: 'PATCH', url: '/api/leads/123', payload: { status: 'CONVERTED' } });
```

### Utility Organization

| File | Purpose |
|------|---------|
| [lib/sms.ts](lib/sms.ts) | SMS template rendering, API sending, batch operations |
| [lib/push.ts](lib/push.ts) | Web Push subscriptions, notification broadcasting |
| [lib/syncManager.ts](lib/syncManager.ts) | Master sync orchestrator (merges offline ops, refreshes cache) |
| [lib/operationQueue.ts](lib/operationQueue.ts) | Mutation queue with deduplication (latest-wins) |
| [lib/offlineLeads.ts](lib/offlineLeads.ts) | IndexedDB abstraction (caching, queueing) |
| [lib/audit.ts](lib/audit.ts) | AuditLog creation helpers (tracks all lead changes) |
| [lib/auth.ts](lib/auth.ts) | NextAuth JWT config |
| [lib/utils.ts](lib/utils.ts) | UI labels, formatters, enums |

### Hooks Patterns

**Data fetching** (with offline fallback):

```typescript
const { data: leads, loading, error, isOffline } = useOfflineData('leads', () =>
  fetch('/api/leads').then(r => r.json())
);
```

**Mutations** (automatically queue offline):

```typescript
const { mutate: createLead } = useOfflineLeadCreation({
  onSuccess: () => refetch(),
});
```

**Sync status**:

```typescript
const { isOnline, isSyncing, pendingCount, error } = useContext(SyncContext);
```

### Database Patterns (Prisma)

**Key Enums**:
- `UserRole` — EVANGELIST | FOLLOWUP | ADMIN
- `LeadStatus` — NEW_LEAD | FOLLOWING_UP | CONVERTED
- `SoulState` — UNBELIEVER | NEW_CONVERT | UNCHURCHED_BELIEVER | HUNGRY_BELIEVER

**Audit Trail**: Every lead mutation creates an `AuditLog` entry (fieldName, oldValue, newValue, timestamp). Fire-and-forget (`void`).

**Relationship Pattern**: Lead → `addedBy` (Evangelist), `assignedTo` (Followup), `notes[]`, `smsLogs[]`, `auditLogs[]`

## Critical Patterns & Anti-Patterns

### ✅ Do

- **Wrap offline mutations** in `useOfflineOperation()` or `useOfflineLeadCreation()` hooks
- **Handle network errors vs. API errors separately**: Network errors (TypeError) → queue; API errors (4xx/5xx) → surface immediately
- **Guard SyncProvider initialization**: Check `isReady` before rendering offline data
- **Verify SMS placeholder names** in templates match actual fields (no type validation = silent failures)
- **Use role-based filtering server-side**: Trust the API; don't work around it client-side
- **Fire-and-forget side effects**: Wrap SMS, push, audit logs in `void()` to avoid blocking responses

### ❌ Don't

- **Don't call API directly from components** — use hooks for offline support
- **Don't skip the PWA build step** — `npm run build` includes `generate-pwa-assets.js`
- **Don't assume stale service worker data is fresh** — version tied to `VERCEL_GIT_COMMIT_SHA`; locally uses timestamp
- **Don't reuse push subscription endpoints** across browsers — each device gets a new one
- **Don't batch mutations** expecting all-or-nothing behavior — operation queue is "latest-wins"

## Debugging Checklist

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Offline edits silently fail | Not using offline hook | Wrap in `useOfflineOperation()` |
| Network returns but data stale | Service worker cache not validated | Hard refresh (Ctrl+Shift+R) or check `VERCEL_GIT_COMMIT_SHA` |
| SMS template placeholders blank | Placeholder name typo or missing field | Verify `{key}` matches Lead fields in schema |
| Role-based data leaking | Relying on client-side filtering | Always use `assertRole()` server-side or trust API |
| Push notifications not sending | Subscription or endpoint invalid | Check `PushSubscription` table; unsubscribe + resubscribe |
| Sync stuck in progress | Exception in SyncManager | Check browser console for errors; manually call `checkNetwork()` |

## File Structure

- **[app/](app/)** — Next.js App Router (page.tsx, layout.tsx, API routes)
  - **[app/api/](app/api/)** — RESTful API endpoints with NextAuth checks
  - **[app/auth/](app/auth/)** — Auth pages (login, signup, forgot/reset password)
  - **[app/dashboard/](app/dashboard/)** — Role-based dashboards (evangelist, followup, admin)
  - **[app/offline/](app/offline/)** — Offline fallback page
- **[components/](components/)** — React components (modals, tables, forms, layout)
- **[hooks/](hooks/)** — Data fetching, mutations, sync, activity tracking
- **[lib/](lib/)** — Utilities (SMS, push, sync, audit, auth, database)
- **[prisma/](prisma/)** — Database schema and migrations
- **[public/](public/)** — Static assets, manifest.json, service worker, PWA icons/splash
- **[scripts/](scripts/)** — Build scripts (PWA asset generation)
- **[types/](types/)** — TypeScript augmentations (next-auth.d.ts)

## Related Documentation

- **SMS System Deep Dive**: [/memories/repo/sms_template_system.md](/memories/repo/sms_template_system.md)
- **NextAuth Configuration**: [lib/auth.ts](lib/auth.ts)
- **Prisma Schema**: [prisma/schema.prisma](prisma/schema.prisma)
- **SyncManager Logic**: [lib/syncManager.ts](lib/syncManager.ts)
- **PWA Config**: [next.config.mjs](next.config.mjs)
- **UI Library**: Tailwind CSS + Radix UI (form controls, modals, tooltips)

---

**Last updated**: March 2026
