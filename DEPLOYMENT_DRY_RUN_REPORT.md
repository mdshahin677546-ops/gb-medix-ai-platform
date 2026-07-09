# GB Medix AI Production Deployment Dry Run Report

## 1. Summary

Dry run date: 2026-07-08

Result: conditional pass.

Application build, production start, page route health checks, and mock commercial tests passed. PostgreSQL migration execution could not complete in this local dry-run environment because no reachable PostgreSQL instance was available at the simulated `DATABASE_URL`.

## 2. Environment Check

Current branch:

- `feature/sprint-1b`

Runtime:

- Node.js: `v20.19.0`
- npm: `10.8.2`

Environment sample:

- `.env.example` is present.
- Required production variable categories are documented:
  - Database
  - Authentication
  - AI Provider
  - Stripe
  - Email
  - Proxy

Required production variables before real deploy:

- `DATABASE_URL`
- `AUTH_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `OPENAI_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

## 3. PostgreSQL and Prisma Checks

Prisma schema validation:

```bash
npx prisma validate
```

Result: passed.

Migration lock:

- `provider = "postgresql"`

Migration order:

1. `20260708173621_sprint_1a_postgres_foundation`
2. `20260708190000_sprint_1b_commercial_loop`

Migration status/deploy simulation:

```bash
npx prisma migrate status
npx prisma migrate deploy
```

Result: blocked in local dry run.

Reason:

- The simulated `DATABASE_URL` pointed to `localhost:5432`.
- No reachable PostgreSQL service was available in this dry-run environment.

Production requirement:

- Re-run `npx prisma migrate status` and `npx prisma migrate deploy` against the real production or staging PostgreSQL database.

## 4. Migration Safety Review

New database execution:

- Expected to apply Sprint 1A first, then Sprint 1B.
- No request-time DDL is required.
- `prisma migrate deploy` is the required command.

Existing database upgrade:

- Sprint 1B adds columns to `PaymentRecord` and `Entitlement`.
- Sprint 1B adds `AIReport.followUpPlan`.
- Sprint 1B creates `ProductRecommendation`.
- Sprint 1B creates a unique index on `AIReport(userId, assessmentId, type)`.

Required pre-upgrade duplicate check:

```sql
SELECT "userId", "assessmentId", "type", COUNT(*)
FROM "AIReport"
GROUP BY "userId", "assessmentId", "type"
HAVING COUNT(*) > 1;
```

Rollback risk:

- Once payment/report data is written using Sprint 1B resource fields, code-only rollback can orphan access logic.
- Preferred rollback is database snapshot restore plus previous app version.

## 5. Build Check

Command:

```bash
npm run build
```

Result: passed.

Observed:

- Prisma Client generated.
- Next.js production build completed.
- Static and dynamic route manifest generated successfully.

## 6. Production Start Check

Command:

```bash
npm start
```

Dry-run environment:

- `PORT=3107`
- `NEXT_PUBLIC_APP_URL=http://127.0.0.1:3107`
- temporary local dummy `DATABASE_URL`

Result: passed.

Observed startup:

- Next.js `14.2.35`
- Local server ready at `http://localhost:3107`
- Ready in about 503 ms.
- Temporary server was stopped after health checks.
- Port `3107` was confirmed not responding after cleanup.

## 7. Route Health Checks

Production start route probes:

| Route | Expected | Observed |
| --- | --- | --- |
| `/` | Landing responds | `200` |
| `/en/tcm-check` | Health assessment page responds | `200` |
| `/en/dashboard` | User health center responds | `200` |
| `/en/report/dry-run-report-id` | Report auth gate responds | `200` |
| `/api/checkout` | POST-only route registered | `405` on GET |
| `/api/webhooks/stripe` | POST-only Stripe webhook route registered | `405` on GET |
| `/api/webhook` | Not implemented | `404` |

Important note:

- The correct Stripe webhook endpoint is `/api/webhooks/stripe`.
- `/api/webhook` singular does not exist and must not be configured in Stripe.

## 8. Commercial Flow Tests

Command:

```bash
npm run test:commercial
```

Result: passed.

Coverage:

- Premium purchase grants entitlement.
- Free user cannot generate Premium report.
- Report IDOR isolation.
- Refund revokes entitlement.
- Premium generation idempotency.
- Source guard assertions for report, webhook, and IP-rate-limit protections.

## 9. Dry Run Risks

Blocking for real production:

- PostgreSQL migration was not executed in this local dry run due missing database connectivity.

Must complete before real deployment:

- Run migration status/deploy against the real target database.
- Verify Stripe webhook using Stripe test or live dashboard.
- Confirm production `AUTH_SECRET` is strong and not the sample value.
- Confirm email provider decision, because current provider is console-only.

## 10. Go/No-Go

Dry-run go:

- Build passes.
- Start passes.
- Key routes respond.
- Mock commercial tests pass.
- Migration files and order are present.

Production no-go until:

- Real PostgreSQL connection is verified.
- `prisma migrate deploy` succeeds on staging/production.
- Stripe webhook endpoint `/api/webhooks/stripe` is configured and verified.
