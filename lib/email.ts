// lib/email.ts
import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import type { MonthlyReport, UserActivityRow } from '@/lib/reports';

// ─── Transport ────────────────────────────────────────────────────────────────

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    // Warn loudly at startup so misconfiguration is obvious in logs.
    console.warn(
      '[Email] SMTP_HOST, SMTP_USER, or SMTP_PASS is not set — email will fail at send time.'
    );
  }

  const port = Number(process.env.SMTP_PORT ?? 587);

  const options: SMTPTransport.Options = {
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  };

  return nodemailer.createTransport(options);
}

const transporter = createTransporter();

const FROM_ADDRESS = `"TLAC Harvest" <${process.env.SMTP_FROM ?? process.env.SMTP_USER ?? 'noreply@tlacharvest.com.ng'}>`;

// ─── Password reset email ─────────────────────────────────────────────────────

export async function sendPasswordResetEmail(
  to: string,
  name: string,
  resetUrl: string
): Promise<void> {
  const year = new Date().getFullYear();

  await transporter.sendMail({
    from: FROM_ADDRESS,
    to,
    subject: 'Reset Your Password – TLAC Harvest',
    text: [
      `Hi ${name},`,
      '',
      'You requested a password reset. Click the link below to set a new password.',
      'This link expires in 1 hour.',
      '',
      resetUrl,
      '',
      "If you didn't request this, you can safely ignore this email.",
      '',
      '— TLAC Harvest Team',
    ].join('\n'),
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#f9f5ee;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f5ee;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0"
          style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#451504,#c74406);padding:36px 40px;text-align:center;">
              <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:16px;padding:12px 16px;margin-bottom:16px;">
                <span style="font-size:28px;">🌾</span>
              </div>
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">The Harvest</h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.7);font-size:13px;">Password Reset Request</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 8px;font-size:15px;color:#533321;font-weight:600;">Hi ${name},</p>
              <p style="margin:0 0 24px;font-size:14px;color:#7f6652;line-height:1.6;">
                We received a request to reset the password for your account. Click the button
                below to choose a new password. This link will expire in <strong>1 hour</strong>.
              </p>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 32px;">
                    <a href="${resetUrl}"
                       style="display:inline-block;background:#f05e05;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 36px;border-radius:12px;letter-spacing:0.2px;">
                      Reset My Password
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Fallback URL -->
              <div style="background:#fff8ed;border:1px solid #ffdba8;border-radius:10px;padding:16px;">
                <p style="margin:0 0 6px;font-size:12px;color:#9e360d;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Or copy this link</p>
                <p style="margin:0;font-size:11px;color:#7f6652;word-break:break-all;">${resetUrl}</p>
              </div>

              <p style="margin:28px 0 0;font-size:13px;color:#b8a090;line-height:1.6;">
                If you didn't request a password reset, you can safely ignore this email.
                Your password will remain unchanged.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#fff8ed;padding:20px 40px;text-align:center;border-top:1px solid #ffefd4;">
              <p style="margin:0;font-size:12px;color:#c4a882;">© ${year} TLAC Harvest. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  });
}

// ─── Monthly report email ─────────────────────────────────────────────────────

function userRowsHtml(rows: UserActivityRow[], kind: 'evangelist' | 'followup'): string {
  if (rows.length === 0) {
    return `<tr><td colspan="6" style="padding:14px;text-align:center;color:#9e8068;font-size:13px;">No ${kind}s on file.</td></tr>`;
  }
  return rows
    .map((r, i) => {
      const bg = i % 2 === 0 ? '#ffffff' : '#fffaf3';
      const primaryLabel = kind === 'evangelist' ? 'Leads Added' : 'Leads Handled';
      return `
        <tr style="background:${bg};">
          <td style="padding:10px 12px;font-size:13px;color:#533321;font-weight:600;">${i + 1}. ${escapeHtml(r.name)}</td>
          <td style="padding:10px 12px;font-size:12px;color:#7f6652;">${escapeHtml(r.email)}</td>
          <td style="padding:10px 12px;font-size:13px;color:#533321;text-align:center;" title="${primaryLabel}">${r.leadsAdded}</td>
          <td style="padding:10px 12px;font-size:13px;color:#16a34a;text-align:center;font-weight:600;">${r.conversions}</td>
          <td style="padding:10px 12px;font-size:13px;color:#533321;text-align:center;">${r.notesAdded}</td>
          <td style="padding:10px 12px;font-size:13px;color:#f05e05;text-align:center;font-weight:700;">${r.activityScore}</td>
        </tr>`;
    })
    .join('');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function statTile(label: string, value: number | string, color = '#451504'): string {
  return `
    <td style="padding:8px;" width="33%">
      <div style="background:#fff8ed;border:1px solid #ffdba8;border-radius:12px;padding:16px;text-align:center;">
        <div style="font-size:24px;font-weight:700;color:${color};line-height:1;">${value}</div>
        <div style="font-size:11px;color:#7f6652;margin-top:6px;text-transform:uppercase;letter-spacing:0.5px;">${label}</div>
      </div>
    </td>`;
}

export function renderMonthlyReportText(report: MonthlyReport): string {
  const lines: string[] = [];
  lines.push(`TLAC Harvest — Monthly Report for ${report.periodLabel}`);
  lines.push('');
  lines.push('TOTALS');
  lines.push(`  Leads created: ${report.totals.leadsCreated}`);
  lines.push(`  Leads converted: ${report.totals.leadsConverted}`);
  lines.push(`  Leads in follow-up: ${report.totals.leadsFollowingUp}`);
  lines.push(`  Notes added: ${report.totals.notesAdded}`);
  lines.push(`  SMS sent: ${report.totals.smsSent} (failed: ${report.totals.smsFailed})`);
  lines.push(`  Active evangelists: ${report.totals.activeEvangelists}`);
  lines.push(`  Active follow-up team: ${report.totals.activeFollowups}`);
  lines.push(`  Inactive (14d+) evangelists: ${report.totals.inactiveEvangelists}`);
  lines.push(`  Inactive (14d+) follow-up: ${report.totals.inactiveFollowups}`);
  lines.push('');
  if (report.topEvangelist) {
    lines.push(`MOST ACTIVE EVANGELIST: ${report.topEvangelist.name} — score ${report.topEvangelist.activityScore}, ${report.topEvangelist.leadsAdded} leads, ${report.topEvangelist.conversions} conversions`);
  }
  if (report.topFollowup) {
    lines.push(`MOST ACTIVE FOLLOW-UP: ${report.topFollowup.name} — score ${report.topFollowup.activityScore}, ${report.topFollowup.notesAdded} notes, ${report.topFollowup.conversions} conversions`);
  }
  lines.push('');
  lines.push('EVANGELISTS');
  for (const r of report.evangelists) {
    lines.push(`  - ${r.name}: ${r.leadsAdded} leads, ${r.conversions} converted, ${r.notesAdded} notes, score ${r.activityScore}`);
  }
  lines.push('');
  lines.push('FOLLOW-UP TEAM');
  for (const r of report.followups) {
    lines.push(`  - ${r.name}: ${r.leadsAdded} handled, ${r.conversions} converted, ${r.notesAdded} notes, ${r.statusChanges} status changes, score ${r.activityScore}`);
  }
  return lines.join('\n');
}

export function renderMonthlyReportHtml(report: MonthlyReport): string {
  const t = report.totals;
  const year = new Date().getFullYear();

  const top = (label: string, row: UserActivityRow | null, kind: 'evangelist' | 'followup'): string => {
    if (!row) {
      return `<div style="padding:14px;border-radius:12px;background:#fff8ed;border:1px solid #ffdba8;color:#9e8068;font-size:13px;">No ${kind} activity this period.</div>`;
    }
    return `
      <div style="padding:16px;border-radius:14px;background:linear-gradient(135deg,#fff3e0,#ffe2c2);border:1px solid #ffc788;">
        <div style="font-size:11px;color:#9e360d;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">${label}</div>
        <div style="font-size:18px;color:#451504;font-weight:700;">${escapeHtml(row.name)}</div>
        <div style="font-size:12px;color:#7f6652;margin-top:4px;">
          Activity score: <strong style="color:#f05e05;">${row.activityScore}</strong> · ${row.leadsAdded} leads · ${row.conversions} converted · ${row.notesAdded} notes
        </div>
      </div>`;
  };

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#f9f5ee;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f5ee;padding:32px 12px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:720px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
        <tr>
          <td style="background:linear-gradient(135deg,#451504,#c74406);padding:32px 40px;color:#ffffff;">
            <div style="font-size:24px;">🌾</div>
            <h1 style="margin:8px 0 4px;font-size:22px;font-weight:700;">Monthly Report</h1>
            <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.85);">${report.periodLabel}</p>
          </td>
        </tr>
        <tr><td style="padding:28px 32px 8px;">
          <h2 style="margin:0 0 14px;font-size:14px;color:#451504;text-transform:uppercase;letter-spacing:0.5px;">Snapshot</h2>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              ${statTile('Leads Created', t.leadsCreated)}
              ${statTile('Converted', t.leadsConverted, '#16a34a')}
              ${statTile('In Follow-up', t.leadsFollowingUp, '#c74406')}
            </tr>
            <tr>
              ${statTile('Notes Added', t.notesAdded)}
              ${statTile('SMS Sent', t.smsSent)}
              ${statTile('SMS Failed', t.smsFailed, '#b91c1c')}
            </tr>
            <tr>
              ${statTile('Active Evangelists', t.activeEvangelists)}
              ${statTile('Active Follow-up', t.activeFollowups)}
              ${statTile('Inactive (14d+)', t.inactiveEvangelists + t.inactiveFollowups, '#b91c1c')}
            </tr>
          </table>
        </td></tr>

        <tr><td style="padding:8px 32px 16px;">
          <h2 style="margin:16px 0 10px;font-size:14px;color:#451504;text-transform:uppercase;letter-spacing:0.5px;">Top Performers</h2>
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td width="50%" style="padding:6px;">${top('Most Active Evangelist', report.topEvangelist, 'evangelist')}</td>
            <td width="50%" style="padding:6px;">${top('Most Active Follow-up', report.topFollowup, 'followup')}</td>
          </tr></table>
        </td></tr>

        <tr><td style="padding:8px 32px 16px;">
          <h2 style="margin:16px 0 10px;font-size:14px;color:#451504;text-transform:uppercase;letter-spacing:0.5px;">Evangelist Activity</h2>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #ffefd4;border-radius:12px;overflow:hidden;">
            <thead><tr style="background:#451504;color:#ffffff;">
              <th align="left" style="padding:10px 12px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Name</th>
              <th align="left" style="padding:10px 12px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Email</th>
              <th style="padding:10px 12px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Leads</th>
              <th style="padding:10px 12px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Conv.</th>
              <th style="padding:10px 12px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Notes</th>
              <th style="padding:10px 12px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Score</th>
            </tr></thead>
            <tbody>${userRowsHtml(report.evangelists, 'evangelist')}</tbody>
          </table>
        </td></tr>

        <tr><td style="padding:8px 32px 24px;">
          <h2 style="margin:16px 0 10px;font-size:14px;color:#451504;text-transform:uppercase;letter-spacing:0.5px;">Follow-up Team Activity</h2>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #ffefd4;border-radius:12px;overflow:hidden;">
            <thead><tr style="background:#451504;color:#ffffff;">
              <th align="left" style="padding:10px 12px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Name</th>
              <th align="left" style="padding:10px 12px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Email</th>
              <th style="padding:10px 12px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Handled</th>
              <th style="padding:10px 12px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Conv.</th>
              <th style="padding:10px 12px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Notes</th>
              <th style="padding:10px 12px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Score</th>
            </tr></thead>
            <tbody>${userRowsHtml(report.followups, 'followup')}</tbody>
          </table>
        </td></tr>

        <tr><td style="background:#fff8ed;padding:18px 32px;text-align:center;border-top:1px solid #ffefd4;">
          <p style="margin:0;font-size:12px;color:#c4a882;">Generated ${report.generatedAt.toUTCString()} · © ${year} TLAC Harvest</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export async function sendMonthlyReportEmail(
  recipients: string[],
  report: MonthlyReport
): Promise<void> {
  if (recipients.length === 0) return;
  await transporter.sendMail({
    from: FROM_ADDRESS,
    to: recipients.join(', '),
    subject: `Monthly Report — ${report.periodLabel} · TLAC Harvest`,
    text: renderMonthlyReportText(report),
    html: renderMonthlyReportHtml(report),
  });
}
