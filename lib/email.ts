// lib/email.ts
import nodemailer from "nodemailer";
 
import type SMTPTransport from "nodemailer/lib/smtp-transport";

const transportOptions: SMTPTransport.Options = {
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_PORT === "465", // boolean, true only for port 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
};

const transporter = nodemailer.createTransport(transportOptions);
export async function sendPasswordResetEmail(to: string, name: string, resetUrl: string) {
  const mailOptions = {
    from: `"TLAC Harvest" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
    to,
    subject: "Reset Your Password – TLAC Harvest",
    text: `Hi ${name},\n\nYou requested a password reset. Click the link below to set a new password. This link expires in 1 hour.\n\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.\n\n— TLAC Harvest Team`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#f9f5ee;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f5ee;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
          
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
                We received a request to reset the password for your account. Click the button below to choose a new password. This link will expire in <strong>1 hour</strong>.
              </p>

              <!-- CTA Button -->
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
                If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#fff8ed;padding:20px 40px;text-align:center;border-top:1px solid #ffefd4;">
              <p style="margin:0;font-size:12px;color:#c4a882;">© ${new Date().getFullYear()} TLAC Harvest. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
  };

  await transporter.sendMail(mailOptions);
}
