# Email Provider Setup

## 1. Current State

The codebase has an `EmailProvider` interface in `lib/email/provider.ts`.

Current active provider:

- `ConsoleEmailProvider`
- Logs messages instead of sending real email.

Production warning:

- Do not rely on email verification in production until a real provider is bound.
- The `.env.example` email variables are reserved for provider binding.

## 2. Provider Interface

Current interface:

```ts
export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
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
```

Setup steps:

1. Create a Resend account.
2. Verify sending domain.
3. Configure SPF, DKIM, and DMARC.
4. Create production API key.
5. Implement `ResendEmailProvider`.
6. Send test verification email.
7. Monitor bounces and delivery.

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

## 6. Interface Switching Plan

Future implementation should update `getEmailProvider()` to select by env:

```ts
switch (process.env.EMAIL_PROVIDER) {
  case "resend":
    return new ResendEmailProvider();
  case "ses":
    return new SesEmailProvider();
  case "sendgrid":
    return new SendGridEmailProvider();
  default:
    return new ConsoleEmailProvider();
}
```

Production guard recommendation:

- In `NODE_ENV=production`, fail startup or email-send attempts if `EMAIL_PROVIDER=console`.

## 7. Verification Test Plan

Before production:

1. Register a new user.
2. Trigger `/api/auth/send-verification`.
3. Confirm email arrives.
4. Use verification token through `/api/auth/verify-email`.
5. Confirm user status changes from `pending` to `active`.
6. Confirm expired token fails.
7. Confirm rate limit prevents repeated spam.

## 8. Known Risk

Email provider binding is not implemented in Sprint 1B. Production can launch only if one of these is true:

- Email verification is not required for the initial private launch.
- Operators manually verify users.
- A real provider adapter is implemented and reviewed before launch.
