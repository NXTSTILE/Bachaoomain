import { unavailable } from './errors';

export function emailConfig() {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  const senderEmail = process.env.BREVO_SENDER_EMAIL?.trim();
  if (!apiKey || !senderEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail)) throw unavailable('Email verification');
  return { apiKey, senderEmail };
}

async function transactionalEmail(toEmail: string, subject: string, textContent: string): Promise<void> {
  const { apiKey, senderEmail } = emailConfig();
  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'api-key': apiKey },
      body: JSON.stringify({
        sender: { name: 'Bachaoo', email: senderEmail },
        to: [{ email: toEmail }],
        subject, textContent,
      }),
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null);
      const message = body && typeof body === 'object' && 'message' in body && typeof body.message === 'string' ? body.message.toLowerCase() : '';
      const reason = /\bip\b|ip address/.test(message) ? 'IP_ACCESS_DENIED'
        : response.status === 401 ? 'AUTHENTICATION_REJECTED'
        : response.status === 429 ? 'PROVIDER_RATE_LIMIT'
        : response.status >= 500 ? 'PROVIDER_UNAVAILABLE' : 'REQUEST_REJECTED';
      // Monitor failures without logging the API key, recipient, OTP, or raw body.
      console.error('Email verification provider failure', { status: response.status, reason });
      throw new Error('Email provider rejected request');
    }
    // Do not retain provider response bodies, which may include private request data.
    await response.body?.cancel();
  } catch {
    throw unavailable('Email verification');
  }
}

export function sendOTP(toEmail: string, otpCode: string): Promise<void> {
  return transactionalEmail(toEmail, 'Your Bachaoo verification code', `Your Bachaoo verification code is ${otpCode}. It expires in 10 minutes. If you did not request it, ignore this email.`);
}

export function sendAdminInvitation(toEmail: string, link: string): Promise<void> {
  return transactionalEmail(toEmail, 'Activate your Bachaoo Admin account', `The Bachaoo operator invited you to manage Helpers. Open this one-time link to verify your mailbox and choose your password:\n\n${link}\n\nThe invitation expires in 24 hours. If you did not expect it, ignore this email. Do not forward the link.`);
}
