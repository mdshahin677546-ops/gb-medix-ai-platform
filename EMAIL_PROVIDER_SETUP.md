# Email Provider Setup

## 1. Current State

The codebase has an `EmailProvider` interface in `lib/email/provider.ts`.

Production provider:

- `ResendEmailProvider`
- Selected with `EMAIL_PROVIDER=resend`.
- Uses `RESEND_API_KEY` and `EMAIL_FROM`.
- Sends a clickable verification link:

```text
${NEXT_PUBLIC_APP_URL}/api/auth/verify-email?token=xxx
```

Development provider:

- `ConsoleEmailProvider`
- Allowed only when `NODE_ENV !== production`.
- Production fallback to console throws: `Email provider is not configured for production.`

## 2. Provider Interface

Current interface:

```ts
export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}
```

Future provider adapters should implement this interface and be selected by `EMAIL_PROVIDER`.

## 3. Resend

Recommended variables:

```env
EMAIL_PROVIDER="resend"
RESEND_API_KEY="re_..."
EMAIL_FROM="GB Medix AI <verify@your-domain.example>"
NEXT_PUBLIC_APP_URL="https://your-production-domain.example"
```

Setup steps:

1. Create a Resend account.
2. Verify sending domain.
3. Configure SPF, DKIM, and DMARC.
4. Create production API key.
5. Set `EMAIL_PROVIDER=resend`.
6. Set `RESEND_API_KEY`.
7. Set `EMAIL_FROM` to a verified sender.
8. Set `NEXT_PUBLIC_APP_URL` to the production origin.
9. Send test verification email.
10. Click the verification link.
11. Confirm the user status becomes `active`.
12. Monitor bounces and delivery.

Best use:

- Fast setup.
- Good default for first production launch.

## 4. AWS SES

Recommended variables:

```env
EMAIL_PROVIDER="ses"
AWS_SES_REGION="us-east-1"
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
```

Setup steps:

1. Verify domain in SES.
2. Configure SPF, DKIM, and DMARC.
3. Request production sending access if account is in sandbox.
4. Create least-privilege IAM credentials for SES send.
5. Implement `SesEmailProvider`.
6. Send test verification email.
7. Configure bounce/complaint handling through SNS if needed.

Best use:

- Existing AWS stack.
- Higher-volume production email.

## 5. SendGrid

Recommended variables:

```env
EMAIL_PROVIDER="sendgrid"
SENDGRID_API_KEY="SG..."
```

Setup steps:

1. Create SendGrid account.
2. Authenticate sending domain.
3. Configure SPF, DKIM, and DMARC.
4. Create restricted API key.
5. Implement `SendGridEmailProvider`.
6. Send test verification email.
7. Monitor suppression lists and bounce rate.

Best use:

- Teams already using SendGrid.
- Marketing/transactional separation in one provider.

## 6. Interface Switching

`getEmailProvider()` selects by env:

```ts
switch (process.env.EMAIL_PROVIDER) {
  case "resend":
    return new ResendEmailProvider();
  case "console":
    return new ConsoleEmailProvider();
  default:
    throw new Error("Email provider is not configured for production.");
}
```

Production guard:

- `EMAIL_PROVIDER=console` is allowed only outside production.
- Production without `EMAIL_PROVIDER=resend` fails at email-send time.

## 7. Verification Test Plan

Before production:

1. Register a new user.
2. Trigger `/api/auth/send-verification`.
3. Confirm email arrives.
4. Click the verification link.
5. Confirm user status changes from `pending` to `active`.
6. Confirm expired token fails.
7. Confirm rate limit prevents repeated spam.

## 8. Known Risk

Production email depends on Resend account and DNS readiness:

- Domain must be verified before launch.
- SPF/DKIM records must propagate.
- `EMAIL_FROM` must use a verified sender/domain.
- Resend API limits and bounce handling should be monitored.
