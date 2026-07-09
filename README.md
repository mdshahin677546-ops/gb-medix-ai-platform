# GB Medix AI Health Platform

GB Medix AI 2.0 is an AI health management platform with free health assessment, Premium AI health reports, Stripe payment, Entitlement unlock, and health product recommendation foundations.

## Sprint 1B Release

Release documentation:

- `SPRINT_1B_RELEASE_NOTES.md`
- `SPRINT_1B_REPORT.md`
- `SPRINT_1B_FINAL_FIX_REPORT.md`
- `TRUST_PROXY_CONFIG.md`

## Required Setup

Copy `.env.example` and configure production values:

```bash
cp .env.example .env
```

Minimum required variables:

- `DATABASE_URL`
- `AUTH_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `OPENAI_API_KEY`

## Deployment Checks

```bash
npx prisma validate
npx prisma migrate deploy
npx prisma generate
npm run test:commercial
npm run build
```

## Stripe Webhook

Configure Stripe to call:

```text
POST /api/webhooks/stripe
```

Required events:

- `checkout.session.completed`
- `checkout.session.expired`
- `payment_intent.payment_failed`
- `charge.refunded`
- `charge.dispute.created`

## Trusted Proxy

IP-level AI rate limiting is enabled only when trusted proxy headers are configured. See `TRUST_PROXY_CONFIG.md` before setting `TRUST_PROXY_HEADERS=true`.
