# GB Medix AI 2.0 Sprint 1B Release Notes

## Feature List

- Consumer Landing at `/` for AI Health Assessment.
- Free AI health assessment flow through `/[lang]/tcm-check`.
- Free AI health result with health score, constitution pattern, basic insights, and limited recommendations.
- Premium AI health report flow:
  - Stripe Checkout for `premium_report`.
  - Resource-scoped Entitlement unlock.
  - Premium report generation behind `checkEntitlement()`.
  - Premium report read protection with user ownership and entitlement checks.
- Stripe webhook lifecycle:
  - `checkout.session.completed`
  - `checkout.session.expired`
  - `payment_intent.payment_failed`
  - `charge.refunded`
  - `charge.dispute.created`
- Refund and dispute handling revokes Premium entitlement.
- Premium report idempotency by `userId + assessmentId + type`.
- ProductRecommendation persistence linked to Premium reports and Product where available.
- User health center at `/[lang]/dashboard`.
- Report page at `/[lang]/report/[id]`.
- Admin entry at `/admin`.
- AI usage tracking and trusted proxy IP rate-limit configuration.
- Commercial flow automated tests using mock webhook events.

## Database Migration Notes

Sprint 1B migration:

- `prisma/migrations/20260708190000_sprint_1b_commercial_loop/migration.sql`

Changes:

- `PaymentRecord`
  - Adds `paymentIntentId`.
  - Adds `resourceType`.
  - Adds `resourceId`.
  - Adds indexes for payment intent and resource scope.
- `Entitlement`
  - Adds `resourceType`.
  - Adds `resourceId`.
  - Adds resource-scope index.
- `AIReport`
  - Adds `followUpPlan` JSONB with default `[]`.
  - Adds unique index on `userId, assessmentId, type`.
- `ProductRecommendation`
  - New table with relations to User, AIReport, and optional Product.

Pre-deploy check:

- Ensure there are no duplicate `AIReport` rows for the same `userId, assessmentId, type`.
- Run `npx prisma validate`.
- Run `npx prisma migrate deploy` in production.
- Run `npx prisma generate` after deploy.

## Environment Variables

Required:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/gbmedix?schema=public"
AUTH_SECRET="change-me-to-a-long-random-secret"
NEXT_PUBLIC_APP_URL="https://your-production-domain.example"
```

AI:

```env
OPENAI_API_KEY=""
```

Payments:

```env
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
ALIPAY_CHECKOUT_URL=""
```

Admin:

```env
ADMIN_EMAILS="admin@example.com"
```

Trusted proxy configuration:

```env
TRUST_PROXY_HEADERS="false"
TRUST_PROXY_IP_HEADER=""
```

Use `TRUST_PROXY_HEADERS=true` only when the deployment edge overwrites and protects the configured client IP header. See `TRUST_PROXY_CONFIG.md`.

## Deployment Steps

1. Confirm production PostgreSQL is available and backed up.
2. Set all required environment variables.
3. Install dependencies:

```bash
npm ci
```

4. Validate Prisma schema:

```bash
npx prisma validate
```

5. Apply migrations:

```bash
npx prisma migrate deploy
```

6. Generate Prisma client:

```bash
npx prisma generate
```

7. Run commercial flow tests:

```bash
npm run test:commercial
```

8. Build:

```bash
npm run build
```

9. Configure Stripe webhook endpoint:

```text
POST https://your-production-domain.example/api/webhooks/stripe
```

Required Stripe events:

- `checkout.session.completed`
- `checkout.session.expired`
- `payment_intent.payment_failed`
- `charge.refunded`
- `charge.dispute.created`

10. Run a staging smoke test:

- Register and verify a user.
- Complete free health assessment.
- Confirm free report renders.
- Complete Stripe test checkout for Premium.
- Confirm Premium generation succeeds.
- Replay refund webhook.
- Confirm Premium entitlement is revoked.

## Known Risks

- The unique AIReport index can fail migration if duplicate historical reports exist.
- Mock webhook tests do not replace Stripe CLI staging verification.
- `TRUST_PROXY_HEADERS=true` is safe only behind a trusted edge that strips spoofed forwarding headers.
- When IP is `direct` or `unknown`, IP-level AI limits are skipped by design; user-level limits and token budgets still apply.
- Product recommendations may be stored without `productId` if no active Product exists.
- Alipay remains provider-configured through `ALIPAY_CHECKOUT_URL` and is not part of the Stripe webhook lifecycle.
