# GB Medix AI 2.0 Production Launch Runbook

## 0. Critical Launch Requirements — Session Security Hardening (v2)

> Mandatory reading before any production deploy of this release. All six points
> below must be satisfied.

1. **Named migration.** This release includes
   `prisma/migrations/20260710120000_add_user_session_version`. It adds the
   column `User.sessionVersion`.

2. **Migration risk.** If production does **not** run:

```bash
npx prisma migrate deploy
```

   the production database will be missing the `sessionVersion` column, which
   causes `getCurrentUser` / session validation to fail (every authenticated
   request errors).

3. **AUTH_SECRET rules.**
   - Production must configure a strong random `AUTH_SECRET`.
   - If `AUTH_SECRET` is missing, the app refuses to run.
   - If `AUTH_SECRET=dev-only-change-me`, the app refuses to run.

4. **Old cookie impact.** After deploy, previously issued 2-part user cookies are
   invalidated. Users must sign in once more. This is expected security behavior,
   not a bug.

5. **Doctor / merchant sessions.** Doctor and merchant sessions are **not**
   affected by this user `sessionVersion` change.

6. **Change scope.** This runbook update only documents the launch security
   hardening requirements. No business code was modified.

## 1. Deployment Order

Follow this order for the first production launch:

1. Code deployment
   - Confirm release branch/commit.
   - Deploy the Sprint 1B release candidate code.

2. Environment variable configuration
   - Configure production secrets in the hosting platform.
   - Do not use sample values from `.env.example`.

3. PostgreSQL connection
   - Confirm `DATABASE_URL` points to the production PostgreSQL database.
   - Confirm the database user has migration privileges.

4. Prisma migration
   - Run:

```bash
npx prisma validate
npx prisma migrate status
npx prisma migrate deploy
npx prisma generate
```

   - **Required this release (security hardening):** migration
     `20260710120000_add_user_session_version` adds the `User.sessionVersion`
     column. `npx prisma migrate deploy` MUST run in production. If it is skipped,
     the column is missing and `getCurrentUser` / session validation fail at
     runtime — every authenticated request errors.

5. Build

```bash
npm ci
npm run build
```

6. Startup check

```bash
npm start
```

7. Route health check
   - `/`
   - `/en/tcm-check`
   - `/en/dashboard`
   - `/api/checkout`
   - `/api/webhooks/stripe`

## 2. Environment Variable Checklist

### Database

- `DATABASE_URL`
  - PostgreSQL connection string used by Prisma.
  - Required for migrations and runtime database access.

### Auth

- `AUTH_SECRET`
  - Secret used to sign authentication cookies.
  - Must be a long random production-only value (≥32 bytes).
  - Enforced: in production the app throws and refuses to run if `AUTH_SECRET` is
    missing or left as the development fallback `dev-only-change-me`.
  - Rotating it invalidates all existing sessions (global logout).

- `NEXT_PUBLIC_APP_URL`
  - Public production origin.
  - Used for Stripe redirect URLs and absolute app links.

- `ADMIN_EMAILS`
  - Optional comma-separated list of admin emails.
  - Required for admin AI usage API access.

### AI

- `OPENAI_API_KEY`
  - Required for real AI report generation.
  - If empty, the app cannot provide production AI-backed reports.

### Stripe

- `STRIPE_SECRET_KEY`
  - Production Stripe secret key.
  - Must be `sk_live_...` for production.

- `STRIPE_WEBHOOK_SECRET`
  - Stripe webhook signing secret for `/api/webhooks/stripe`.
  - Must match the production webhook endpoint.

- `ALIPAY_CHECKOUT_URL`
  - Optional redirect URL if Alipay checkout is enabled.

### Email

- `EMAIL_PROVIDER`
  - Set to `resend` in production.
  - `console` is allowed only outside production.

- `RESEND_API_KEY`
  - Resend production API key.

- `EMAIL_FROM`
  - Verified Resend sender, for example `GB Medix AI <verify@your-domain.example>`.

- `AWS_SES_REGION`
  - AWS SES region if using SES.

- `AWS_ACCESS_KEY_ID`
  - AWS credential for SES if using SES.

- `AWS_SECRET_ACCESS_KEY`
  - AWS credential secret for SES if using SES.

- `SENDGRID_API_KEY`
  - SendGrid API key if using SendGrid.

### Proxy

- `TRUST_PROXY_HEADERS`
  - Set to `true` only when a trusted edge proxy overwrites client IP headers.

- `TRUST_PROXY_IP_HEADER`
  - Header to read for client IP when trusted proxy mode is enabled.
  - Examples: `cf-connecting-ip`, `x-vercel-forwarded-for`.

## 3. Stripe Launch Flow

1. Create Production Product
   - Name: `Premium AI Health Management Report`
   - SKU/reference: `premium_report`
   - Type: one-time purchase.

2. Configure Price
   - Current app amount: USD `$9.99`.
   - Current implementation uses dynamic `price_data` in Checkout.
   - Keep dashboard product/price aligned for finance and support tracking.

3. Configure Webhook
   - Production endpoint:

```text
https://YOUR_DOMAIN/api/webhooks/stripe
```

4. Configure Events
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `payment_intent.payment_failed`
   - `charge.refunded`
   - `charge.dispute.created`

5. Configure Secret
   - Copy webhook signing secret to:

```env
STRIPE_WEBHOOK_SECRET="whsec_..."
```

6. Test Payment
   - Complete free AI health assessment.
   - Click Premium unlock.
   - Complete Stripe Checkout.
   - Confirm payment status becomes `paid`.
   - Confirm Entitlement becomes `active`.
   - Generate Premium report.

7. Test Refund
   - Refund the charge in Stripe dashboard.
   - Confirm webhook is delivered.
   - Confirm payment status becomes `refunded`.
   - Confirm Entitlement becomes `revoked`.
   - Confirm Premium report access is locked.

## 4. Database Launch Flow

1. Backup
   - Take a managed database snapshot before migration.
   - If snapshots are unavailable, run:

```bash
pg_dump "$DATABASE_URL" --format=custom --file=gbmedix-pre-launch.backup
```

2. Pre-migration duplicate check

```sql
SELECT "userId", "assessmentId", "type", COUNT(*)
FROM "AIReport"
GROUP BY "userId", "assessmentId", "type"
HAVING COUNT(*) > 1;
```

3. Migration deploy

```bash
npx prisma validate
npx prisma migrate status
npx prisma migrate deploy
npx prisma generate
```

   - This release includes migration `20260710120000_add_user_session_version`,
     which adds `User.sessionVersion`. Running `npx prisma migrate deploy` is
     mandatory in production; without it, `getCurrentUser` / session validation
     fail because the column is missing.

4. Verify schema

```bash
npx prisma migrate status
```

Expected result:

- Database schema is up to date.
- Migration provider is PostgreSQL.

5. Failure rollback plan
   - Stop new traffic.
   - Restore pre-launch database snapshot.
   - Redeploy previous stable commit.
   - Verify `/`, `/en/tcm-check`, and report access.

Do not rely on code-only rollback after payment/report data has been written with Sprint 1B schema.

## 5. First User Test Flow

Run this after production deploy and migration.

1. User registration
   - Open `/en/account`.
   - Register with a test user email.

2. Email verification
   - Trigger verification email.
   - Confirm Resend delivers the email.
   - Click the verification link:
     - `${NEXT_PUBLIC_APP_URL}/api/auth/verify-email?token=xxx`
   - Confirm user status becomes `active`.
   - Confirm user receives a signed-in session.

3. AI assessment
   - Open `/en/tcm-check`.
   - Complete the health assessment form.
   - Submit.

4. Free report
   - Confirm redirect to `/en/report/[id]`.
   - Confirm free report shows:
     - Health score.
     - Constitution pattern.
     - Basic insights.
     - Limited recommendations.

5. Premium purchase
   - Click Premium unlock.
   - Complete Stripe Checkout.
   - Confirm success page.

6. Payment success
   - Confirm Stripe webhook delivered.
   - Confirm `PaymentRecord.status = paid`.
   - Confirm resource-scoped Entitlement exists for the assessment.

7. Report unlock
   - Return to report page.
   - Generate Premium report.
   - Confirm Premium content renders:
     - Analysis.
     - Lifestyle guidance.
     - Product recommendations.
     - Follow-up plan.

## 6. Failure Handling

### Payment Failure

Symptoms:

- Checkout fails.
- `payment_intent.payment_failed` received.
- User cannot unlock Premium.

Actions:

1. Check Stripe dashboard for failed payment reason.
2. Confirm `STRIPE_SECRET_KEY` is production key.
3. Confirm checkout session metadata includes product and assessment scope.
4. Confirm no Entitlement is granted for failed payment.
5. Ask user to retry payment with another method.

### AI Unavailable

Symptoms:

- `/api/tcm` or `/api/reports/generate` fails.
- AI report output validation fails.
- AI usage spikes or provider rejects calls.

Actions:

1. Check `OPENAI_API_KEY`.
2. Check provider dashboard for quota/rate-limit errors.
3. Check `AIUsage` for abnormal volume.
4. Confirm token budgets are enforcing.
5. Temporarily pause Premium generation if cost or provider instability is severe.

### Database Exception

Symptoms:

- Prisma connection errors.
- Migration failure.
- API routes return 500.

Actions:

1. Confirm `DATABASE_URL`.
2. Confirm database is reachable from app environment.
3. Check connection pool and provider status.
4. Run `npx prisma migrate status`.
5. If migration caused failure, stop traffic and restore backup.

### Webhook Failure

Symptoms:

- Payment succeeds in Stripe but Premium is not unlocked.
- Refund succeeds but Premium remains unlocked.
- Stripe dashboard shows webhook delivery failures.

Actions:

1. Confirm endpoint is exactly:

```text
/api/webhooks/stripe
```

2. Confirm `STRIPE_WEBHOOK_SECRET`.
3. Confirm required events are enabled.
4. Replay failed event from Stripe dashboard.
5. Check `PaymentRecord` and `Entitlement` consistency.
6. Manually revoke Entitlement only after verifying payment/refund state.

## 7. Launch Approval Checklist

Before opening production traffic:

- Production build passed.
- PostgreSQL migration deployed.
- Stripe webhook verified.
- Resend API key configured.
- `EMAIL_FROM` sender/domain verified.
- Test verification email delivered.
- Test user becomes `active` after clicking email link.
- First user test flow passed.
- Email provider decision accepted.
- Monitoring plan active.
- Rollback snapshot available.
- Strong `AUTH_SECRET` configured (not the `dev-only-change-me` fallback).
- `User.sessionVersion` migration (`20260710120000_add_user_session_version`) deployed.

## 8. Session Security Hardening Notes (v2)

This release hardens authentication (`AUTH_SECRET` enforcement + revocable
sessions). Account for the following at launch:

- Production **must** configure a strong random `AUTH_SECRET` (≥32 bytes).
- If `AUTH_SECRET` is missing or set to `dev-only-change-me`, the app **refuses
  to run** in production (it throws when signing/verifying sessions).
- This release adds the `User.sessionVersion` column. Run `npx prisma migrate
  deploy` in production (migration `20260710120000_add_user_session_version`).
  Without it, `getCurrentUser` / session validation fail due to the missing
  column.
- After deploy, previously issued 2-part user cookies are invalidated; users
  must sign in once more. This is expected — equivalent to a one-time forced
  session rotation. Consider noting it in release/support communications.
- Doctor and merchant sessions are **not** affected by the user `sessionVersion`
  change and do not require re-login.

## DeepSeek Production Switch Checklist

必须逐项确认：

* [ ] Vercel Production 已部署 commit `e069bc2` 或更新版本
* [ ] `npx prisma migrate status` 显示全部 migrations 已应用
* [ ] 已执行 `npx prisma migrate deploy`
* [ ] 生产库存在 `AIUsage.provider`
* [ ] 生产库存在 `AIProcessingConsent`
* [ ] 生产库存在 `User.sessionVersion`
* [ ] `/zh/third-party-ai-privacy` 可访问
* [ ] `/en/third-party-ai-privacy` 可访问
* [ ] AI consent UI 已上线，可主动同意和撤回
* [ ] 负责人已书面批准启用第三方 AI Provider
* [ ] Vercel 已配置 `AI_PROVIDER`
* [ ] Vercel 已配置 `DEEPSEEK_API_KEY`
* [ ] `DEEPSEEK_BASE_URL=https://api.deepseek.com`
* [ ] 已配置 `DEEPSEEK_MODEL`
* [ ] 强随机 `AUTH_SECRET` 已配置
* [ ] Neon、Resend、Stripe 生产配置仍有效
* [ ] 已准备回退方案：将 `AI_PROVIDER` 切回原 Provider
* [ ] 已准备生产 Smoke Test
