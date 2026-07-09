# GB Medix AI Production Deployment Checklist

## 1. Runtime Environment

- Node.js: verified locally with `v20.19.0`.
- npm: verified locally with `10.8.2`.
- Recommended production runtime: Node.js 20 LTS.
- Package install command:

```bash
npm ci
```

## 2. Build Verification

Verified:

```bash
npm run build
```

Result:

- Prisma Client generated successfully.
- Next.js production build completed successfully.
- Dynamic API routes are server-rendered on demand.

Pre-release command set:

```bash
npx prisma validate
npm run test:commercial
npm run build
```

## 3. Environment Variables

Required production variables:

- `DATABASE_URL`
- `AUTH_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `OPENAI_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `EMAIL_PROVIDER=resend`
- `RESEND_API_KEY`
- `EMAIL_FROM`

Recommended production variables:

- `ADMIN_EMAILS`
- `TRUST_PROXY_HEADERS`
- `TRUST_PROXY_IP_HEADER`

Optional or provider-specific variables:

- `ALIPAY_CHECKOUT_URL`
- `AWS_SES_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `SENDGRID_API_KEY`

See `.env.example` for grouped descriptions.

## 4. PostgreSQL Configuration

- Database provider: PostgreSQL.
- Prisma migration lock: `provider = "postgresql"`.
- Production `DATABASE_URL` must point to the production PostgreSQL database.
- Use pooled connection URL only if the deployment platform requires it and Prisma supports the provider configuration.

Pre-deploy database checks:

```bash
npx prisma validate
npx prisma migrate status
```

Deploy migrations:

```bash
npx prisma migrate deploy
npx prisma generate
```

## 5. Prisma Migration Flow

Migration order:

1. `20260708173621_sprint_1a_postgres_foundation`
2. `20260708190000_sprint_1b_commercial_loop`

Important Sprint 1B migration risk:

- `AIReport_userId_assessmentId_type_key` can fail if duplicate historical reports exist for the same user, assessment, and type.

Before production migration:

```sql
SELECT "userId", "assessmentId", "type", COUNT(*)
FROM "AIReport"
GROUP BY "userId", "assessmentId", "type"
HAVING COUNT(*) > 1;
```

If duplicates exist, deduplicate before running `prisma migrate deploy`.

## 6. Stripe Deployment

- Configure Stripe product and checkout price strategy.
- Set webhook endpoint:

```text
POST https://YOUR_DOMAIN/api/webhooks/stripe
```

Required events:

- `checkout.session.completed`
- `checkout.session.expired`
- `payment_intent.payment_failed`
- `charge.refunded`
- `charge.dispute.created`

See `STRIPE_PRODUCTION_SETUP.md`.

## 7. Email Readiness

Current implementation:

- `EmailProvider` abstraction exists.
- `ResendEmailProvider` is available for production.
- `ConsoleEmailProvider` is allowed only outside production.

Production requirement:

- Set `EMAIL_PROVIDER=resend`.
- Set `RESEND_API_KEY`.
- Set `EMAIL_FROM` to a verified Resend sender.
- Configure DNS/SPF/DKIM in Resend.
- Send a test verification email.
- Click the verification link and confirm user status changes to `active`.

See `EMAIL_PROVIDER_SETUP.md`.

## 8. Monitoring Readiness

Minimum production monitoring:

- Next.js server errors.
- API latency and error rate.
- Stripe webhook delivery failures.
- Prisma/database errors.
- AIUsage daily tokens and cost.
- Payment state anomalies.

See `MONITORING_PLAN.md`.

## 9. Final Go/No-Go

Go criteria:

- Production env vars configured.
- PostgreSQL backup completed.
- `prisma migrate deploy` completed.
- Stripe webhook verified.
- Email provider decision accepted.
- `npm run test:commercial` passed.
- `npm run build` passed.

No-go criteria:

- Missing `AUTH_SECRET`, `DATABASE_URL`, or Stripe webhook secret.
- Missing `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, or `EMAIL_FROM`.
- Resend sender domain is not verified.
- Migration duplicate conflict unresolved.
- Stripe webhook delivery failing.
- Email verification flow does not activate a test user.
