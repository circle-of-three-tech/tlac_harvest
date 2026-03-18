import { prisma } from './prisma';
import { SMSType, SMSStatus } from '@prisma/client';

const BULK_SMS_API_URL = process.env.BULK_SMS_API_URL || 'https://www.bulksmsnigeria.com/api/v2/sms';
const BULK_SMS_TOKEN = process.env.SMS_BEARER_TOKEN;
const BULK_SMS_SENDER_ID = process.env.BULK_SMS_SENDER_ID || 'TLAC HARVEST';


interface SendSMSOptions {
  phone: string;
  message: string;
  type: SMSType;
  leadId?: string;
}

/**
 * Render template with placeholders
 * Example: renderTemplate("Hello {leadName}", { leadName: "John" }) => "Hello John"
 */
export function renderTemplate(
  template: string,
  data: Record<string, string | number>
): string {
  let result = template;
  Object.entries(data).forEach(([key, value]) => {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  });
  return result;
}

/**
 * Send SMS via Bulk SMS Nigeria API
 */
export async function sendSMS({
  phone,
  message,
  type,
  leadId,
}: SendSMSOptions): Promise<{ success: boolean; error?: string }> {
  try {
    if (!BULK_SMS_TOKEN) {
      throw new Error('BULK_SMS_TOKEN not configured');
    }

    // Validate phone format (basic check)
    if (!phone || phone.length < 10) {
      throw new Error(`Invalid phone number: ${phone}`);
    }

    // Ensure phone starts with country code (234 for Nigeria)
    let normalizedPhone = phone;
    if (phone.startsWith('0')) {
      normalizedPhone = '234' + phone.substring(1);
    } else if (!phone.startsWith('234')) {
      normalizedPhone = '234' + phone;
    }

    // Create SMS log entry with PENDING status
    const smsLog = await prisma.sMSLog.create({
      data: {
        type,
        recipientPhone: normalizedPhone,
        content: message,
        status: SMSStatus.PENDING,
        leadId,
      },
    });

    // Call Bulk SMS API
    const response = await fetch(`${BULK_SMS_API_URL}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${BULK_SMS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: normalizedPhone,
        body: message,
        from: BULK_SMS_SENDER_ID,
      }),
    });

    // console.log(`[SMS] Sent to ${normalizedPhone}:`, {message, BULK_SMS_SENDER_ID, BULK_SMS_API_URL, BULK_SMS_TOKEN, type, leadId, responseStatus: response.status });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Bulk SMS API error: ${response.status} - ${errorData}`);
    }

    // Update SMS log to SENT
    await prisma.sMSLog.update({
      where: { id: smsLog.id },
      data: {
        status: SMSStatus.SENT,
        sentAt: new Date(),
      },
    });

    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    console.error(`[SMS Error] ${type}:`, errorMessage);

    // Try to log error to SMS log if we can
    try {
      await prisma.sMSLog.create({
        data: {
          type,
          recipientPhone: phone,
          content: message,
          status: SMSStatus.FAILED,
          errorMessage,
          leadId,
        },
      });
    } catch (logError) {
      console.error('[SMS] Failed to log error to database:', logError);
    }

    return { success: false, error: errorMessage };
  }
}

/**
 * Get SMS template by type with fallback to default
 */
export async function getSMSTemplate(type: SMSType): Promise<string> {
  try {
    const template = await prisma.sMSTemplate.findUnique({
      where: { type },
    });

    if (template) {
      return template.content;
    }
  } catch (error) {
    console.error(`Error fetching SMS template for ${type}:`, error);
  }

  // Fallback to default templates
  return getDefaultTemplate(type);
}

/**
 * Default SMS templates
 */
function getDefaultTemplate(type: SMSType): string {
  const templates: Record<SMSType, string> = {
    NEW_LEAD_NOTIFICATION: `Hi {leadName}, welcome to Harvest! We're excited to have you on our journey. If you have any questions, feel free to reach out.`,
    ADMIN_ALERT: `New lead added: {leadName} ({phone}) from {location}. Status: {status}`,
    FOLLOWUP_ASSIGNMENT: `Hi {assigneeName}, a new lead has been assigned to you: {leadName} from {location}. Phone: {phone}`,
  };

  return templates[type];
}

/**
 * Send SMS to multiple recipients
 */
export async function sendSMSBatch(
  recipients: Array<{ phone: string; name: string }>,
  templateContent: string,
  data: Record<string, string | number>,
  type: SMSType,
  leadId?: string
): Promise<Array<{ phone: string; success: boolean; error?: string }>> {
  const results = await Promise.all(
    recipients.map(async (recipient) => {
      const message = renderTemplate(templateContent, { ...data, ...recipient });
      const result = await sendSMS({
        phone: recipient.phone,
        message,
        type,
        leadId,
      });
      return {
        phone: recipient.phone,
        ...result,
      };
    })
  );

  return results;
}
