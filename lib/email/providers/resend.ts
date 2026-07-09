import type { EmailMessage, EmailProvider } from "@/lib/email/provider";

const resendApiUrl = "https://api.resend.com/emails";
const productionEmailError = "Email provider is not configured for production.";

export class ResendEmailProvider implements EmailProvider {
  private readonly apiKey: string;
  private readonly from: string;

  constructor({
    apiKey = process.env.RESEND_API_KEY || "",
    from = process.env.EMAIL_FROM || ""
  }: {
    apiKey?: string;
    from?: string;
  } = {}) {
    if (!apiKey || !from) {
      throw new Error(productionEmailError);
    }
    this.apiKey = apiKey;
    this.from = from;
  }

  async send(message: EmailMessage): Promise<void> {
    const response = await fetch(resendApiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html
      })
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Resend email send failed: ${response.status} ${body}`.trim());
    }
  }
}
