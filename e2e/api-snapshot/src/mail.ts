export type Email = { to: string; subject: string; text: string; html: string };

/**
 * Sends email. `send` never throws and answers whether the provider accepted the message, so a
 * mail problem can never break an order or a sign-in.
 */
export type Mailer = { enabled: boolean; send(email: Email): Promise<boolean> };

export const noMailer: Mailer = { enabled: false, send: async () => false };

const RESEND_URL = 'https://api.resend.com/emails';

/**
 * Resend over HTTPS. SMTP is not used on purpose: free Render services block the SMTP ports, while
 * ordinary HTTPS requests always work. Another provider only needs another function like this one.
 */
export function createResendMailer(
  settings: { apiKey: string; from: string },
  fetchImpl: typeof fetch = fetch,
): Mailer {
  return {
    enabled: true,
    async send(email) {
      try {
        const response = await fetchImpl(RESEND_URL, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${settings.apiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            from: settings.from,
            to: [email.to],
            subject: email.subject,
            text: email.text,
            html: email.html,
          }),
          signal: AbortSignal.timeout(8000),
        });
        if (response.ok) return true;
        // The provider's reason helps debugging; the key and the message body are never logged.
        const reason = (await response.text().catch(() => '')).slice(0, 300);
        console.error(
          `Email to ${email.to} was refused (${response.status}): ${reason}`,
        );
        return false;
      } catch (error) {
        console.error(
          `Email to ${email.to} could not be sent:`,
          (error as Error).message,
        );
        return false;
      }
    },
  };
}

/** The configured mailer, or one that does nothing when RESEND_API_KEY and MAIL_FROM are not set. */
export function mailerFromConfig(config: {
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
}): Mailer {
  return config.RESEND_API_KEY && config.MAIL_FROM
    ? createResendMailer({
        apiKey: config.RESEND_API_KEY,
        from: config.MAIL_FROM,
      })
    : noMailer;
}
