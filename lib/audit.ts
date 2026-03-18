import { prisma } from './prisma';
import { AuditLogType } from '@prisma/client';

export interface AuditEventOptions {
  type: AuditLogType;
  leadId: string;
  userId: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  noteContent?: string;
  details?: Record<string, any>;
}

/**
 * Log an audit event for leadup activities
 * Used to track notes, field changes, SMS sends, status changes, and assignments
 */
export async function logAuditEvent({
  type,
  leadId,
  userId,
  fieldName,
  oldValue,
  newValue,
  noteContent,
  details,
}: AuditEventOptions): Promise<string | null> {
  try {
    const auditLog = await prisma.auditLog.create({
      data: {
        type,
        leadId,
        userId,
        fieldName,
        oldValue,
        newValue,
        noteContent,
        details,
      },
    });

    return auditLog.id;
  } catch (error) {
    console.error('Failed to log audit event:', error);
    return null;
  }
}

/**
 * Log a NOTE audit event (when followup member adds a comment)
 */
export async function logNoteCreated(
  leadId: string,
  userId: string,
  noteContent: string
): Promise<string | null> {
  return logAuditEvent({
    type: 'NOTE',
    leadId,
    userId,
    noteContent,
  });
}

/**
 * Log a FIELD_CHANGE audit event
 */
export async function logFieldChange(
  leadId: string,
  userId: string,
  fieldName: string,
  oldValue: string | number | null,
  newValue: string | number | null
): Promise<string | null> {
  return logAuditEvent({
    type: 'FIELD_CHANGE',
    leadId,
    userId,
    fieldName,
    oldValue: oldValue !== null ? String(oldValue) : undefined,
    newValue: newValue !== null ? String(newValue) : undefined,
  });
}

/**
 * Log a STATUS_CHANGE audit event
 */
export async function logStatusChange(
  leadId: string,
  userId: string,
  oldStatus: string,
  newStatus: string
): Promise<string | null> {
  return logAuditEvent({
    type: 'STATUS_CHANGE',
    leadId,
    userId,
    fieldName: 'status',
    oldValue: oldStatus,
    newValue: newStatus,
  });
}

/**
 * Log an ASSIGNMENT audit event (when admin assigns to followup member)
 */
export async function logAssignment(
  leadId: string,
  userId: string,
  assignedToUserId: string | null,
  assignedToUserName?: string
): Promise<string | null> {
  return logAuditEvent({
    type: 'ASSIGNMENT',
    leadId,
    userId,
    fieldName: 'assignedToId',
    oldValue: undefined,
    newValue: assignedToUserId ?? undefined,
    details: {
      assignedToUserId,
      assignedToUserName,
    },
  });
}

/**
 * Log an SMS_SENT audit event
 */
export async function logSmsSent(
  leadId: string,
  userId: string,
  smsType: string,
  recipientPhone: string
): Promise<string | null> {
  return logAuditEvent({
    type: 'SMS_SENT',
    leadId,
    userId,
    details: {
      smsType,
      recipientPhone,
    },
  });
}
