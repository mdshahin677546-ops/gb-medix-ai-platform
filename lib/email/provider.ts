export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
};

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

/**
 * Development provider: logs the email instead of sending it. Never use in
 * production — a real provider (Resend, SES, SendGrid, ...) must be bound
 * before verification emails are relied upon.
 */
export class ConsoleEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<void> {
    console.info(
      `[email:console] to=${message.to} subject=${JSON.stringify(message.subject)} text=${JSON.stringify(message.text)}`
    );
  }
}

let cached: EmailProvider | null = null;

/**
 * Returns the active email provider. Only the console provider exists so far;
 * production provider selection (via env) is a later step.
 */
export function getEmailProvider(): EmailProvider {
  cached ??= new ConsoleEmailProvider();
  return cached;
}
