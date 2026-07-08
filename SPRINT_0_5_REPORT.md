# GB Medix AI 2.0 Sprint 0.5 Report

Status: Completed for review  
Scope: P0 security, payment, data, and compliance baseline fixes only  
Note: No Sprint 1 commercialization features were implemented.

## 1. Modified Files

Payment and entitlement:

- `app/api/checkout/route.ts`
- `app/api/webhooks/stripe/route.ts`
- `app/[lang]/success/page.tsx`
- `app/[lang]/checkout/checkout-button.tsx`
- `lib/entitlements.ts`

AI access control and usage:

- `app/api/assistant/route.ts`
- `app/api/tcm/route.ts`
- `lib/ai-security.ts`

Doctor verification and patient consent:

- `app/api/doctor/session/route.ts`
- `app/api/doctor/orders/route.ts`
- `app/api/consult/orders/route.ts`
- `app/doctor/login/doctor-login-form.tsx`
- `app/doctor/dashboard/doctor-orders.tsx`

Consultation context:

- `app/api/consult/route.ts`
- `app/[lang]/consult/consult-room.tsx`

Runtime DDL removal:

- `lib/db.ts`
- `app/api/session/route.ts`
- `app/api/products/route.ts`
- `app/api/rfq/route.ts`
- `app/api/merchant/session/route.ts`
- `app/api/merchant/products/route.ts`
- `app/merchant/dashboard/page.tsx`
- `app/[lang]/dashboard/page.tsx`
- `app/[lang]/shop/page.tsx`

Database:

- `prisma/schema.prisma`
- `prisma/migrations/20260708030000_baseline/migration.sql`
- `prisma/migrations/20260708031500_sprint_0_5_security_baseline/migration.sql`

Report:

- `SPRINT_0_5_REPORT.md`

## 2. Database Changes

Added models:

- `Entitlement`
  - `id`
  - `userId`
  - `productId`
  - `paymentId`
  - `status`
  - `expiresAt`
  - `createdAt`

- `AIUsage`
  - `id`
  - `userId`
  - `model`
  - `tokens`
  - `cost`
  - `createdAt`

- `DoctorVerification`
  - `id`
  - `doctorId`
  - `licenseNumber`
  - `country`
  - `status`
  - `createdAt`

- `PatientConsent`
  - `id`
  - `userId`
  - `doctorId`
  - `status`
  - `createdAt`

- `Conversation`
  - `id`
  - `userId`
  - `type`
  - `createdAt`

- `Message`
  - `id`
  - `conversationId`
  - `role`
  - `content`
  - `tokens`
  - `createdAt`

- `AIReport`
  - `id`
  - `userId`
  - `assessmentId`
  - `content`
  - `score`
  - `recommendations`
  - `createdAt`

Index changes:

- Added foreign key and query indexes for `Product`, `TCMRecord`, `PaymentRecord`, `RFQRecord`, `AssistantSession`, `ConsultationOrder`, `Entitlement`, `AIUsage`, `DoctorVerification`, `PatientConsent`, `Conversation`, `Message`, and `AIReport`.
- Existing unique indexes on user, merchant, doctor email and payment session remain in place.

Migration changes:

- Added a baseline migration for the existing MVP schema.
- Added Sprint 0.5 migration for new security and compliance tables.
- Applied the baseline flow locally by marking the baseline migration as applied, then running `prisma migrate deploy`.

Runtime DDL:

- Removed all request-path `ensureDatabase()` calls.
- Replaced `lib/db.ts` with a no-op compatibility function so future accidental calls do not execute `CREATE TABLE` or `ALTER TABLE` during requests.

## 3. Security Fixes

Payment authorization:

- Removed `demo=1` unlock logic from the success page.
- Removed local demo payment unlock paths from checkout.
- Removed `demo_without_stripe_key` and `alipay_demo` entitlement behavior.
- Added product-specific `Entitlement` checks.
- `body_reset_plan` only unlocks the paid AI health report.
- `consult_pack` only unlocks consultation continuation.
- A generic paid `PaymentRecord` no longer unlocks all products.
- Stripe webhook now grants entitlements only after a paid checkout session is recorded.

AI endpoint protection:

- `/api/assistant` now requires a logged-in user.
- `/api/tcm` now requires a logged-in user.
- Added IP hourly rate limiting.
- Added user daily AI call limit.
- Added user daily token budget.
- Added per-request token budget.
- Added `AIUsage` records with model, token count, estimated cost, and timestamp.

Doctor access control:

- Added `DoctorVerification`.
- Doctors must submit license number and country.
- New or updated doctor verification status is `pending`.
- Only doctors with `DoctorVerification.status = "approved"` can list or accept consultation orders.
- Added `PatientConsent`.
- Consultation order submission creates a granted consent record.
- Doctor order listing and acceptance require patient consent.

Consultation context:

- Added `Conversation` and `Message`.
- `/api/consult` stores conversation messages.
- The AI consult call now sends conversation context, not only the last user sentence.
- The client preserves and resends `conversationId`.

AI report generation:

- `/api/tcm` now creates an `AIReport` from the user's assessment output.
- The paid success page no longer renders a static hard-coded report.
- The paid success page displays the latest stored `AIReport` for the entitled user.

## 4. Test Results

Passed:

- `npx prisma validate`
- `npx prisma generate`
- `npx prisma migrate resolve --applied 20260708030000_baseline`
- `npx prisma migrate deploy`
- `npx tsc --noEmit --incremental false`
- `npm run build`

Build result:

- Next.js production build completed successfully.
- Static and dynamic routes compiled successfully.
- Prisma Client generated successfully after stopping the local Next dev process that held the Windows Prisma engine DLL lock.

Static checks:

- No remaining `demo=1` unlock path in app/lib code.
- No remaining `demo_without_stripe_key` or `alipay_demo` unlock state in app/lib code.
- No request-path `CREATE TABLE`, `ALTER TABLE`, or `$executeRawUnsafe` DDL remains.
- `ensureDatabase()` remains only as a no-op compatibility function.

## 5. Remaining Risks

Authentication:

- User login is still email-only and does not verify email ownership.
- This should be addressed before production launch with verified magic link, OTP, OAuth, or equivalent.

Doctor approval operations:

- Doctor verification approval is now enforced, but there is no admin UI yet to approve or reject doctors.
- For now, approval must be handled directly in the database.

Alipay:

- Alipay no longer grants demo access.
- A real signed Alipay callback still needs to be implemented before Alipay can unlock entitlements in production.

Rate limiting:

- IP rate limiting is in-memory and suitable only as a baseline.
- Production should move rate limiting to Redis, database-backed counters, or edge middleware.

AI governance:

- AIUsage logging exists, but prompt versioning, model version governance, safety classification, and eval tests are still pending.

Commerce:

- Entitlements protect digital products, but physical shop cart/order/fulfillment is still not implemented.
- This was intentionally left out because Sprint 0.5 forbids large new features.

Database:

- Local SQLite now has migrations applied.
- Production should still move to PostgreSQL before global scale.

Compliance:

- Medical disclaimers remain prompt/UI based.
- Full privacy consent, data export, data deletion, audit log, and jurisdiction-specific compliance review are still required.
