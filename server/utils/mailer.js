import nodemailer from 'nodemailer';

// Configure nodemailer transporter
// Can be customized via environment variables or falls back to standard local transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || process.env.EMAIL_USER || 'samethxu@gmail.com',
    pass: process.env.SMTP_PASS || process.env.EMAIL_PASS || 'Sa12252005@',
  },
  tls: {
    rejectUnauthorized: false,
  },
});

/**
 * Send an email notification when someone sends files or photos to a user's Inbox
 */
export async function sendIncomingTransferNotification({
  recipientEmail,
  recipientName,
  senderName,
  title,
  fileCount,
  totalSizeFormatted,
  note,
  reviewUrl,
}) {
  if (!recipientEmail) {
    console.warn('[Mailer] No recipient email provided. Skipping notification.');
    return { success: false, error: 'No recipient email' };
  }

  const subject = `[QR Drop Notification] New Files Received from ${senderName || 'A Nearby Device'}`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #090d16; color: #f1f5f9; margin: 0; padding: 24px; }
    .container { max-width: 560px; margin: 0 auto; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
    .header { background: linear-gradient(135deg, #0d9488, #059669); padding: 28px 24px; text-align: center; }
    .header h1 { margin: 0; color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
    .header p { margin: 6px 0 0 0; color: #ccfbf1; font-size: 13px; }
    .body { padding: 24px; }
    .greeting { font-size: 15px; font-weight: 600; color: #e2e8f0; margin-bottom: 16px; }
    .info-card { background-color: #020617; border: 1px solid #1e293b; border-radius: 14px; padding: 18px; margin-bottom: 20px; }
    .info-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #0f172a; font-size: 13px; }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #94a3b8; font-weight: 500; }
    .info-value { color: #f8fafc; font-weight: 700; text-align: right; }
    .note-box { background-color: #1e293b; border-left: 4px solid #14b8a6; padding: 12px 14px; border-radius: 8px; font-size: 12px; color: #cbd5e1; font-style: italic; margin-bottom: 20px; }
    .btn-container { text-align: center; margin: 24px 0 12px 0; }
    .btn { display: inline-block; background: linear-gradient(135deg, #14b8a6, #10b981); color: #020617; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 800; font-size: 14px; }
    .footer { padding: 18px 24px; background-color: #020617; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #1e293b; }
    .footer a { color: #14b8a6; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>QR Drop File Notification</h1>
      <p>Incoming transfer received for your account</p>
    </div>
    <div class="body">
      <p class="greeting">Hello ${recipientName || 'User'},</p>
      <p style="font-size: 13px; color: #94a3b8; margin-top: 0; line-height: 1.5;">
        A user has just scanned your Personal Receive QR code and sent files to your device.
      </p>

      <div class="info-card">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">Sender:</td>
            <td style="padding: 6px 0; color: #f8fafc; font-size: 13px; font-weight: 700; text-align: right;">${senderName || 'Anonymous Device'}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">Transfer Title:</td>
            <td style="padding: 6px 0; color: #14b8a6; font-size: 13px; font-weight: 700; text-align: right;">${title || 'Files Transfer'}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">Total Files:</td>
            <td style="padding: 6px 0; color: #f8fafc; font-size: 13px; font-weight: 700; text-align: right;">${fileCount} file(s)</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">Total Size:</td>
            <td style="padding: 6px 0; color: #f8fafc; font-size: 13px; font-weight: 700; text-align: right;">${totalSizeFormatted || 'N/A'}</td>
          </tr>
        </table>
      </div>

      ${note ? `
      <div class="note-box">
        Sender Note: "${note}"
      </div>
      ` : ''}

      ${reviewUrl ? `
      <div class="btn-container">
        <a href="${reviewUrl}" class="btn">View & Accept Transfer on Device</a>
      </div>
      ` : ''}

      <p style="font-size: 11px; color: #64748b; text-align: center; margin-top: 16px;">
        You can preview all photos and confirm saving directly from your active QR Drop receiver screen.
      </p>
    </div>
    <div class="footer">
      QR Drop Fast File Sharing • Developed by Korb Sameth • <a href="https://www.facebook.com/korb.sameth/">Facebook</a>
    </div>
  </div>
</body>
</html>
  `;

  const textContent = `
[QR Drop Notification]
Hello ${recipientName || 'User'},

A new transfer has been sent to your Personal Receive QR code:
- Sender: ${senderName || 'Nearby Device'}
- Title: ${title || 'Files Transfer'}
- Files Count: ${fileCount}
- Total Size: ${totalSizeFormatted}
${note ? `- Sender Note: "${note}"\n` : ''}
${reviewUrl ? `Review URL: ${reviewUrl}\n` : ''}

You can preview the photos and confirm saving directly on your screen.
QR Drop - Instant Photo & File Sharing
  `.trim();

  try {
    const info = await transporter.sendMail({
      from: `"QR Drop Notification" <${process.env.SMTP_USER || 'samethxu@gmail.com'}>`,
      to: recipientEmail,
      subject,
      text: textContent,
      html: htmlContent,
    });

    console.log(`[Mailer] Email notification sent successfully to ${recipientEmail}: ID=${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.warn(`[Mailer] Notice: Could not deliver email to ${recipientEmail} (${err.message}). Logged notification to server records.`);
    return { success: false, error: err.message };
  }
}
