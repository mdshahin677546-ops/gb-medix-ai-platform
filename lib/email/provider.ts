import { ResendEmailProvider } from "@/lib/email/providers/resend";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

const productionEmailError = "Email provider is not configured for production.";

/**
 * Development provider: logs the email instead of sending it. Production must
 * use a real provider because verification gates AI assessment access.
 */
export class ConsoleEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<void> {
    console.info(
      `[email:console] to=${message.to} subject=${JSON.stringify(message.subject)} text=${JSON.stringify(message.text)}`
    );
  }
}

export function getEmailProvider(): EmailProvider {
  const provider = (process.env.EMAIL_PROVIDER || "console").toLowerCase();

  if (provider === "resend") {
    return new ResendEmailProvider();
  }

  if (provider === "console" && process.env.NODE_ENV !== "production") {
    return new ConsoleEmailProvider();
  }

  throw new Error(productionEmailError);
}
