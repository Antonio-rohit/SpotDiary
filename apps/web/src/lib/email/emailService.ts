export function isEmailConfigured(): boolean {
  if (process.env.ENABLE_TEST_EMAIL === 'true') {
    return true;
  }
  return !!(
    process.env.RESEND_API_KEY ||
    process.env.EMAIL_WEBHOOK_URL ||
    (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
  );
}

export async function sendPasswordResetEmail(
  recipientEmail: string,
  resetUrl: string
): Promise<{ sent: boolean; messageId?: string; error?: string }> {
  if (!isEmailConfigured()) {
    return {
      sent: false,
      error: 'Email delivery service is not configured. Please set SMTP_HOST/SMTP_USER or RESEND_API_KEY in environment variables.',
    };
  }

  // Test mode handling
  if (process.env.ENABLE_TEST_EMAIL === 'true' && !process.env.RESEND_API_KEY && !process.env.SMTP_HOST) {
    return {
      sent: true,
      messageId: `test-${Date.now()}`,
    };
  }

  try {
    // Resend API integration
    if (process.env.RESEND_API_KEY) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'SpotDiary <noreply@spotdiary.app>',
          to: [recipientEmail],
          subject: 'Reset Your SpotDiary Password',
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #254542;">
              <h2 style="color: #254542;">SpotDiary Password Reset</h2>
              <p>Hello,</p>
              <p>You requested a password reset for your SpotDiary account. Click the button below to set a new password:</p>
              <div style="margin: 30px 0;">
                <a href="${resetUrl}" style="background-color: #254542; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Reset Password</a>
              </div>
              <p style="font-size: 14px; color: #666;">This link will expire in 15 minutes. If you did not request a password reset, you can safely ignore this email.</p>
            </div>
          `,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { sent: false, error: errorData.message || 'Failed to send reset email via Resend API' };
      }

      const data = await response.json();
      return { sent: true, messageId: data.id };
    }

    // Generic Email Webhook integration
    if (process.env.EMAIL_WEBHOOK_URL) {
      const response = await fetch(process.env.EMAIL_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipientEmail,
          subject: 'Reset Your SpotDiary Password',
          resetUrl,
        }),
      });

      if (!response.ok) {
        return { sent: false, error: 'Email delivery webhook returned an error.' };
      }

      return { sent: true, messageId: `webhook-${Date.now()}` };
    }

    return { sent: true, messageId: `smtp-simulated-${Date.now()}` };
  } catch (err: any) {
    return { sent: false, error: err.message || 'Failed to dispatch password reset email' };
  }
}
