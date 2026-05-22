-- SMSLog.lead: switch to ON DELETE SET NULL so deleting a Lead does not RESTRICT.
ALTER TABLE "SMSLog" DROP CONSTRAINT IF EXISTS "SMSLog_leadId_fkey";
ALTER TABLE "SMSLog"
  ADD CONSTRAINT "SMSLog_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Lead indexes
CREATE INDEX IF NOT EXISTS "Lead_addedById_createdAt_idx" ON "Lead"("addedById", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Lead_assignedToId_createdAt_idx" ON "Lead"("assignedToId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Lead_status_idx" ON "Lead"("status");
CREATE INDEX IF NOT EXISTS "Lead_soulState_idx" ON "Lead"("soulState");
CREATE INDEX IF NOT EXISTS "Lead_createdAt_idx" ON "Lead"("createdAt" DESC);

-- Note indexes
CREATE INDEX IF NOT EXISTS "Note_leadId_createdAt_idx" ON "Note"("leadId", "createdAt");

-- AuditLog indexes
CREATE INDEX IF NOT EXISTS "AuditLog_leadId_createdAt_idx" ON "AuditLog"("leadId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "AuditLog_type_createdAt_idx" ON "AuditLog"("type", "createdAt" DESC);

-- SMSLog indexes
CREATE INDEX IF NOT EXISTS "SMSLog_leadId_createdAt_idx" ON "SMSLog"("leadId", "createdAt");
CREATE INDEX IF NOT EXISTS "SMSLog_status_idx" ON "SMSLog"("status");
