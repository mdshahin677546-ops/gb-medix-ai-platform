# GB Medix AI 2.0 Sprint 1B Report

## 1. Completed Work

- Rebuilt `/` as a consumer Landing page for AI Health Assessment.
- Separated route responsibilities:
  - `/`: consumer Landing.
  - `/[lang]/tcm-check`: free AI health assessment intake.
  - `/[lang]/dashboard`: user health center.
  - `/[lang]/report/[id]`: free and Premium report display.
  - `/admin`: internal operations entry.
- Implemented free report creation from `/api/tcm`.
- Implemented Premium report generation through `/api/reports/generate`.
- Added resource-scoped Entitlement checks for `premium_report`.
- Added Stripe checkout support for `premium_report`.
- Added Stripe webhook handling for completed, expired, failed, refunded, and disputed payments.
- Added refund/dispute entitlement revocation.
- Added Premium report idempotency through `userId + assessmentId + type`.
- Added ProductRecommendation model and Premium recommendation persistence.
- Replaced consumer-visible clinical/dashboard language with health management language.
- Added trusted proxy IP configuration documentation.

## 2. Modified Files

- `app/page.tsx`
- `components/Shell.tsx`
- `app/admin/page.tsx`
- `app/[lang]/dashboard/page.tsx`
- `app/[lang]/report/[id]/page.tsx`
- `app/[lang]/report/[id]/premium-actions.tsx`
- `app/[lang]/tcm-check/tcm-check-form.tsx`
- `app/[lang]/tcm-result/result-view.tsx`
- `app/[lang]/checkout/page.tsx`
- `app/[lang]/checkout/checkout-button.tsx`
- `app/[lang]/success/page.tsx`
- `app/[lang]/shop/page.tsx`
- `app/api/tcm/route.ts`
- `app/api/reports/generate/route.ts`
- `app/api/reports/[id]/route.ts`
- `app/api/checkout/route.ts`
- `app/api/webhooks/stripe/route.ts`
- `app/api/products/route.ts`
- `app/api/admin/ai-usage/route.ts`
- `lib/entitlement/index.ts`
- `lib/entitlements.ts`
- `lib/report-schema.ts`
- `lib/ai-security.ts`
- `prisma/schema.prisma`
- `prisma/migrations/20260708190000_sprint_1b_commercial_loop/migration.sql`
- `TRUST_PROXY_CONFIG.md`

## 3. Database Changes

- Added to `PaymentRecord`:
  - `paymentIntentId`
  - `resourceType`
  - `resourceId`
  - indexes for payment intent and resource scope.
- Added to `Entitlement`:
  - `resourceType`
  - `resourceId`
  - resource-scope index.
- Added to `AIReport`:
  - `followUpPlan` JSONB.
  - unique key on `userId, assessmentId, type`.
- Added `ProductRecommendation`:
  - `userId`
  - `reportId`
  - `productId`
  - `category`
  - `title`
  - `reason`
  - `score`
  - `createdAt`
- Existing request-path DDL remains disabled. `ensureDatabase()` is not called by routes.

## 4. API Changes

- `POST /api/tcm`
  - Creates a `free_health_report`.
  - Returns `reportId`.
  - Free report stores only free fields.
- `POST /api/reports/generate`
  - Accepts `assessmentId` and `reportType`.
  - Enforces Premium entitlement before `premium_health_report`.
  - Returns existing report for idempotent repeats.
  - Records AI usage.
- `GET /api/reports/[id]`
  - Enforces user ownership.
  - Enforces entitlement for Premium reports.
  - Redacts Premium fields for free reports.
- `POST /api/checkout`
  - Supports `premium_report`.
  - Requires assessment ownership for Premium checkout.
  - Stores resource scope on payment records.
- `POST /api/webhooks/stripe`
  - Handles completed checkout, expired checkout, failed payment intent, refunds, and disputes.
  - Grants or revokes entitlement idempotently.

## 5. Page Changes

- `/` no longer displays clinical operations, patient names, condition data, triage content, or supply-chain operations metrics.
- `/[lang]/dashboard` is now positioned as a user health center.
- `/[lang]/report/[id]` shows:
  - free report summary and limited suggestions.
  - Premium unlock CTA if entitlement is missing.
  - Premium generation CTA if entitlement exists.
  - Premium lifestyle guidance, product recommendations, and follow-up plan after generation.
- Checkout and report pages include medical/wellness disclaimers.

## 6. Test Results

- Passed: `npx prisma validate`
- Passed: `npx prisma generate`
- Passed: `npx tsc --noEmit --incremental false`
- Passed: `npm run build`
- Static verification completed:
  - Consumer Landing no longer exposes clinical/patient/supply-chain mock data.
  - Premium report generation calls `checkEntitlement()`.
  - Premium report reads enforce user ownership and entitlement.
  - Stripe webhook refund/dispute paths revoke entitlements.
  - Trusted proxy headers are disabled by default.

Not executed locally due missing live PostgreSQL and Stripe webhook environment:

- Real checkout session completion.
- Real Stripe refund event.
- Real Stripe dispute event.
- User A/User B report isolation against a seeded production-like database.
- Full browser free assessment flow with live auth and database.

## 7. Remaining Risks

- Production must run `prisma migrate deploy` against PostgreSQL before release.
- The new `AIReport_userId_assessmentId_type_key` migration can fail if existing duplicate reports exist; deduplicate before deploy if needed.
- Stripe webhook idempotency relies on `PaymentRecord.sessionId` and `paymentIntentId`; historical payments without `paymentIntentId` may need backfill.
- `TRUST_PROXY_HEADERS=true` must only be enabled behind a proxy that strips spoofed forwarding headers.
- Product recommendations are linked to active products when available; if no products exist, recommendations are stored without `productId`.
- End-to-end Premium payment tests require real Stripe test keys, webhook signing secret, and PostgreSQL.

Sprint 1B coding is complete and ready for Claude Code review.
