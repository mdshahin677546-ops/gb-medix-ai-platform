# GB Medix AI 2.0 Production Deployment Config Report

## Summary

- Release commit: `2b67dbb52cf6758c9d3ae637129bc2e048927ef5`
- Release tag: `release-sprint-1b-approved`
- Local branch: `main`
- Local/remote status: `main` is synchronized with `origin/main`
- Production traffic decision: **Not ready to open traffic yet**

This report is a deployment configuration check based on the current repository, local environment, and `PRODUCTION_LAUNCH_RUNBOOK.md`. No business code was changed. Production platform dashboards, Stripe dashboard, Resend DNS status, and production database credentials still require operator-side confirmation.

## 1. GitHub Main Status

| Check | Result |
| --- | --- |
| Local `main` HEAD | `2b67dbb52cf6758c9d3ae637129bc2e048927ef5` |
| `origin/main` HEAD | `2b67dbb52cf6758c9d3ae637129bc2e048927ef5` |
| Release tag | `release-sprint-1b-approved` |
| Release tag target | `2b67dbb52cf6758c9d3ae637129bc2e048927ef5` |
| Worktree | Clean |

Deployment source requirements:

- Repository: `git@github.com:mdshahin677546-ops/gb-medix-ai-platform.git`
- Branch: `main`
- Commit: `2b67dbb52cf6758c9d3ae637129bc2e048927ef5`

## 2. Deployment Platform Status

The deployment platform must be configured to pull:

- Branch: `main`
- Commit: `2b67dbb52cf6758c9d3ae637129bc2e048927ef5`

Pending platform-side checks:

- Confirm deployment platform is connected to `mdshahin677546-ops/gb-medix-ai-platform`.
- Confirm production deployment branch is `main`.
- Confirm latest production deployment uses commit `2b67dbb52cf6758c9d3ae637129bc2e048927ef5`.
- Confirm build command is `npm run build`.
- Confirm install command is `npm ci` or the platform-approved equivalent.

## 3. Production Environment Variables

Local `.env` is not production-ready. It appears to be a local development configuration.

| Variable | Required Production Value | Current Local Check |
| --- | --- | --- |
| `DATABASE_URL` | Production PostgreSQL URL | Configured, but points to local PostgreSQL |
| `AUTH_SECRET` | Long random production secret | Missing locally |
| `OPENAI_API_KEY` | Production OpenAI key | Missing locally |
| `STRIPE_SECRET_KEY` | Stripe live secret key | Missing locally |
| `STRIPE_WEBHOOK_SECRET` | Production webhook signing secret | Missing locally |
| `EMAIL_PROVIDER` | `resend` | Missing locally |
| `RESEND_API_KEY` | Resend production API key | Missing locally |
| `EMAIL_FROM` | Verified sender/domain | Missing locally |
| `NEXT_PUBLIC_APP_URL` | `https://ai.gbmedix.com` | Configured to non-production value locally |
| `TRUST_PROXY_HEADERS` | `true` for trusted edge proxy | Missing locally |

Production environment variables still required in the deployment platform:

- `DATABASE_URL`
- `AUTH_SECRET`
- `OPENAI_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `EMAIL_PROVIDER=resend`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `NEXT_PUBLIC_APP_URL=https://ai.gbmedix.com`
- `TRUST_PROXY_HEADERS=true`
- `TRUST_PROXY_IP_HEADER` if the platform provides a specific trusted client IP header

## 4. PostgreSQL Status

Local validation:

- `npx prisma validate`: Passed.
- `npx prisma migrate status`: Passed against local PostgreSQL.
- Local datasource observed by Prisma: PostgreSQL database `gbmedix`, schema `public`, at `localhost:5432`.
- Migrations present:
  - `20260708173621_sprint_1a_postgres_foundation`
  - `20260708190000_sprint_1b_commercial_loop`
- Local migration state: Database schema is up to date.

Production status:

- Database supplier: Not confirmed.
- Production `DATABASE_URL`: Not available in local environment.
- Production connectivity: Not verified.
- Production migration deploy: Not verified.
- Production migration status: Not verified.

Required production database steps:

```bash
npx prisma validate
npx prisma migrate status
npx prisma migrate deploy
npx prisma generate
npx prisma migrate status
```

Do not run `prisma migrate reset` in production.

## 5. Resend Status

Code readiness:

- Production email provider must be `resend`.
- Console email provider is not acceptable in production.
- Verification links must use:

```text
${NEXT_PUBLIC_APP_URL}/api/auth/verify-email?token=xxx
```

Production status:

- `RESEND_API_KEY`: Not confirmed.
- `EMAIL_FROM`: Not confirmed.
- Sender domain DNS/SPF/DKIM/DMARC: Not confirmed.
- Real verification email delivery: Not tested in production.
- User status transition to `active`: Not tested in production.

Required Resend checks:

- Create or confirm Resend production API key.
- Configure `EMAIL_PROVIDER=resend`.
- Configure verified `EMAIL_FROM`.
- Verify sender domain DNS, SPF, DKIM, and DMARC.
- Send a real verification email.
- Click the verification link.
- Confirm the user becomes `active`.

## 6. Stripe Status

Required production setup:

- Product: `Premium AI Health Management Report`
- SKU/reference: `premium_report`
- Price: `$9.99`
- Webhook URL:

```text
https://ai.gbmedix.com/api/webhooks/stripe
```

Required webhook events:

- `checkout.session.completed`
- `charge.refunded`
- `checkout.session.expired`
- `payment_intent.payment_failed`
- `charge.dispute.created`

Production status:

- Production Product: Not confirmed.
- `$9.99` Price: Not confirmed.
- Webhook URL: Not confirmed in Stripe dashboard.
- Required events: Not confirmed in Stripe dashboard.
- `STRIPE_WEBHOOK_SECRET`: Not confirmed in production environment.
- Live checkout: Not tested in production.
- Refund entitlement revocation: Not tested in production.

Required Stripe checks:

- Confirm `STRIPE_SECRET_KEY` is a live `sk_live_...` key.
- Confirm webhook endpoint points to `https://ai.gbmedix.com/api/webhooks/stripe`.
- Confirm webhook event list exactly includes the required events.
- Copy the production webhook signing secret into `STRIPE_WEBHOOK_SECRET`.
- Complete a live or controlled production-mode payment test.
- Issue a refund and confirm Entitlement is revoked.

## 7. OpenAI Status

Production status:

- `OPENAI_API_KEY`: Not confirmed.
- AI health assessment call: Not tested in production.
- Structured report generation: Not tested in production.
- `AIUsage` production recording: Not tested in production.

Required OpenAI checks:

- Configure production `OPENAI_API_KEY`.
- Run one authenticated AI health assessment.
- Confirm report generation succeeds.
- Confirm `AIUsage` records model, endpoint, tokens, cost, IP, user, and timestamp.
- Confirm token budget controls remain active.

## 8. Production Smoke Test Plan

Run after production deploy, production environment variables, production database migration, Resend, Stripe, and OpenAI are configured.

1. Open `https://ai.gbmedix.com/`.
2. Register a new test user.
3. Confirm verification email is received.
4. Click verification link.
5. Confirm user status becomes `active`.
6. Open `https://ai.gbmedix.com/en/tcm-check`.
7. Complete health assessment.
8. View free report.
9. Click Premium upgrade.
10. Start Stripe Checkout.
11. Complete payment.
12. Confirm `checkout.session.completed` webhook is delivered.
13. Confirm `PaymentRecord.status = paid`.
14. Confirm resource-scoped Entitlement is active.
15. View or generate Premium report.
16. Confirm Premium report fields render.
17. Confirm ProductRecommendation entries link to Product records.
18. Issue Stripe refund.
19. Confirm `charge.refunded` webhook is delivered.
20. Confirm Payment status updates to `refunded`.
21. Confirm Entitlement is revoked.
22. Confirm Premium report is no longer accessible.

Smoke test status: **Not run against production yet**.

## 9. Blocking Items Before Opening Traffic

- Production deployment platform connection must be confirmed.
- Production environment variables must be configured.
- Production PostgreSQL database provider and connection must be confirmed.
- `prisma migrate deploy` must be run against production.
- Resend DNS/SPF/DKIM/DMARC and sender must be verified.
- Real verification email must be delivered and clicked.
- Stripe production Product, Price, webhook URL, events, and signing secret must be verified.
- OpenAI production key must be configured and tested.
- End-to-end production smoke test must pass.

## 10. Traffic Decision

**Do not open public production traffic yet.**

The release code is approved and pushed, and the repository source is ready. Production traffic should wait until the external production environment, database, Resend, Stripe, OpenAI, and smoke test checks above are complete.
