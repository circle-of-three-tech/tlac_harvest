// lib/sms.ts
import { prisma } from './prisma';
import { SMSType, SMSStatus } from '@prisma/client';

const BULK_SMS_API_URL =
  process.env.BULK_SMS_API_URL ?? 'https://www.bulksmsnigeria.com/api/v2/sms';
const BULK_SMS_TOKEN = process.env.SMS_BEARER_TOKEN;
const BULK_SMS_SENDER_ID = process.env.BULK_SMS_SENDER_ID ?? 'TLAC HARVEST';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SendSMSOptions {
  phone: string;
  message: string;
  type: SMSType;
  leadId?: string;
}

interface SendSMSResult {
  success: boolean;
  error?: string;
}

// ─── Phone normalisation ──────────────────────────────────────────────────────

/**
 * Normalize a Nigerian phone number to the international format (234XXXXXXXXXX).
 * Returns null when the number is clearly invalid.
 */
function normalizeNigerianPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');

  if (digits.length < 10) return null;

  if (digits.startsWith('234')) return digits;
  if (digits.startsWith('0')) return '234' + digits.slice(1);
  if (digits.length === 10) return '234' + digits;

  return null;
}

// ─── Template helpers ─────────────────────────────────────────────────────────

/**
 * Replace `{key}` placeholders in a template string.
 * Example: renderTemplate("Hello {name}", { name: "John" }) → "Hello John"
 */
export function renderTemplate(
  template: string,
  data: Record<string, string | number>
): string {
  return Object.entries(data).reduce(
    (result, [key, value]) =>
      result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value)),
    template
  );
}

// ─── Core send function ───────────────────────────────────────────────────────

/**
 * Send an SMS via the Bulk SMS Nigeria API.
 *
 * Error-handling policy:
 * - One DB log entry is written per attempt. On success it is updated to SENT.
 * - On failure a FAILED entry is written directly — no second create in catch.
 */
export async function sendSMS({
  phone,
  message,
  type,
  leadId,
}: SendSMSOptions): Promise<SendSMSResult> {
  if (!BULK_SMS_TOKEN) {
    console.error('[SMS] SMS_BEARER_TOKEN is not configured');
    return { success: false, error: 'SMS service not configured' };
  }

  const normalizedPhone = normalizeNigerianPhone(phone);
  if (!normalizedPhone) {
    const error = `Invalid phone number: ${phone}`;
    console.error(`[SMS] ${error}`);
    await prisma.sMSLog
      .create({
        data: { type, recipientPhone: phone, content: message, status: SMSStatus.FAILED, errorMessage: error, leadId },
      })
      .catch((e) => console.error('[SMS] Failed to write FAILED log:', e));
    return { success: false, error };
  }

  // Create a PENDING log entry up front so we always have a record.
  const smsLog = await prisma.sMSLog.create({
    data: {
      type,
      recipientPhone: normalizedPhone,
      content: message,
      status: SMSStatus.PENDING,
      leadId,
    },
  });

  try {
    const response = await fetch(BULK_SMS_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${BULK_SMS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: normalizedPhone,
        body: message,
        from: BULK_SMS_SENDER_ID,
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      throw new Error(`Bulk SMS API ${response.status}: ${text}`);
    }

    // Mark as sent
    await prisma.sMSLog.update({
      where: { id: smsLog.id },
      data: { status: SMSStatus.SENT, sentAt: new Date() },
    });

    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[SMS Error] type=${type} phone=${normalizedPhone}:`, errorMessage);

    // Update the existing log to FAILED — never create a second entry.
    await prisma.sMSLog
      .update({
        where: { id: smsLog.id },
        data: { status: SMSStatus.FAILED, errorMessage },
      })
      .catch((e) => console.error('[SMS] Failed to update log to FAILED:', e));

    return { success: false, error: errorMessage };
  }
}

// ─── Template loader ──────────────────────────────────────────────────────────

/**
 * Fetch the DB template for a given SMS type, falling back to the built-in default.
 */
export async function getSMSTemplate(type: SMSType): Promise<string> {
  try {
    const template = await prisma.sMSTemplate.findUnique({ where: { type } });
    if (template) return template.content;
  } catch (err) {
    console.error(`[SMS] Error fetching template for ${type}:`, err);
  }
  return getDefaultTemplate(type);
}

function getDefaultTemplate(type: SMSType): string {
  const defaults: Record<SMSType, string> = {
    NEW_LEAD_NOTIFICATION:
      `Hi {leadName}, welcome to Harvest! We're excited to have you on our journey.`,
    ADMIN_ALERT:
      `New lead: {leadName} ({phone}) from {location}. Status: {status}`,
    FOLLOWUP_ASSIGNMENT:
      `Hi {assigneeName}, a new lead has been assigned to you: {leadName} from {location}. Phone: {phone}`,
    SOULSTATE_UNBELIEVER:
      `Hello {leadName}, we'd love to share the good news of Jesus Christ with you. Welcome!`,
    SOULSTATE_NEW_CONVERT:
      `Welcome to the family of Christ, {leadName}! We're here to help you grow in your faith.`,
    SOULSTATE_UNCHURCHED_BELIEVER:
      `Hi {leadName}, welcome! We're excited to help you reconnect with your faith community.`,
    SOULSTATE_HUNGRY_BELIEVER:
      `Welcome, {leadName}! We're thrilled to journey with you as you grow deeper in Christ.`,
  };
  return defaults[type];
}

// ─── Soul state welcome SMS ───────────────────────────────────────────────────

/**
 * Send a soul-state welcome SMS to a lead based on their soul state.
 * Fires asynchronously after lead creation.
 */
export async function sendSoulStateWelcomeSMS(lead: {
  id: string;
  fullName: string;
  phone: string | null;
  location: string;
  soulState: string;
}): Promise<void> {
  if (!lead.phone) return;

  const smsTypeMap: Record<string, SMSType> = {
    UNBELIEVER: SMSType.SOULSTATE_UNBELIEVER,
    NEW_CONVERT: SMSType.SOULSTATE_NEW_CONVERT,
    UNCHURCHED_BELIEVER: SMSType.SOULSTATE_UNCHURCHED_BELIEVER,
    HUNGRY_BELIEVER: SMSType.SOULSTATE_HUNGRY_BELIEVER,
  };

  const smsType = smsTypeMap[lead.soulState];
  if (!smsType) return; // Soul state not found in mapping

  try {
    const template = await getSMSTemplate(smsType);
    const message = renderTemplate(template, {
      leadName: lead.fullName,
      location: lead.location,
    });

    await sendSMS({
      phone: lead.phone,
      message,
      type: smsType,
      leadId: lead.id,
    });
  } catch (err) {
    console.error(`[Soul State SMS] Failed for lead ${lead.id}:`, err);
  }
}

// ─── Batch send ───────────────────────────────────────────────────────────────

/**
 * Send the same template to multiple recipients in parallel.
 */
export async function sendSMSBatch(
  recipients: Array<{ phone: string; name: string }>,
  templateContent: string,
  data: Record<string, string | number>,
  type: SMSType,
  leadId?: string
): Promise<Array<{ phone: string; success: boolean; error?: string }>> {
  return Promise.all(
    recipients.map(async (recipient) => {
      const message = renderTemplate(templateContent, { ...data, ...recipient });
      const result = await sendSMS({ phone: recipient.phone, message, type, leadId });
      return { phone: recipient.phone, ...result };
    })
  );
}
