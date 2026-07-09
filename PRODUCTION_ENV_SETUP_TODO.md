# GB Medix AI 2.0 Production Environment Setup TODO

## Current Missing Items

Release code is approved and pushed, but production traffic should remain closed until these setup items are complete:

- Deployment platform connection to the GitHub repository is not confirmed.
- Production deployment branch and commit are not confirmed in the platform.
- Production environment variables are not configured or not verified.
- Production PostgreSQL provider, connection, and migration state are not verified.
- Resend API key, sender, and DNS records are not verified.
- Stripe live product, price, webhook, events, and signing secret are not verified.
- OpenAI production key and real AI report generation are not verified.
- Domain and DNS for `https://ai.gbmedix.com` are not verified.
- End-to-end production smoke test has not been run.

Do not put real secrets in this document. Configure secrets only in the deployment platform and provider dashboards.

## 1. Vercel / Deployment Platform

### Console

- Vercel dashboard or the selected production deployment platform.
- GitHub repository: `mdshahin677546-ops/gb-medix-ai-platform`.

### Configure

- Project source repository: `mdshahin677546-ops/gb-medix-ai-platform`.
- Production branch: `main`.
- Release commit: `2b67dbb52cf6758c9d3ae637129bc2e048927ef5`.
- Install command: `npm ci`.
- Build command: `npm run build`.
- Start command: platform default for Next.js, or `npm start` if using a Node server runtime.
- Production domain: `ai.gbmedix.com`.

### Verify

- Deployment platform shows the connected GitHub repository.
- Latest production deployment is from branch `main`.
- Latest production deployment commit is `2b67dbb52cf6758c9d3ae637129bc2e048927ef5`.
- Build logs show dependency install and Next.js production build completed successfully.
- No production environment variables are shown as missing during build.

### Success Standard

- Production deployment is created from `main` at `2b67dbb52cf6758c9d3ae637129bc2e048927ef5`.
- The platform can serve `https://ai.gbmedix.com/`.
- No fallback, preview, stale branch, or older commit is serving production traffic.

## 2. PostgreSQL

### Console

- Production PostgreSQL provider dashboard.
- Examples: Neon, Supabase, Railway, Render, AWS RDS, Google Cloud SQL, Azure Database for PostgreSQL.
- Deployment platform environment variables page.

### Configure

- `DATABASE_URL`
  - Must point to the production PostgreSQL database.
  - Must not point to `localhost`, `127.0.0.1`, a local Docker database, or a staging database.
  - Database user must have migration privileges for launch.

### Verify

Run against production environment only:

```bash
npx prisma validate
npx prisma migrate status
npx prisma migrate deploy
npx prisma generate
npx prisma migrate status
```

Also confirm the migration list includes:

- `20260708173621_sprint_1a_postgres_foundation`
- `20260708190000_sprint_1b_commercial_loop`

### Success Standard

- `DATABASE_URL` connects from the production runtime.
- `npx prisma migrate deploy` completes without reset or data deletion.
- Final `npx prisma migrate status` reports the database schema is up to date.
- Production database has the Sprint 1A and Sprint 1B tables and indexes.
- A pre-launch backup or managed snapshot exists.

## 3. Resend

### Console

- Resend dashboard.
- Domain DNS provider dashboard.
- Deployment platform environment variables page.

### Configure

- `EMAIL_PROVIDER=resend`
- `RESEND_API_KEY`
- `EMAIL_FROM`
  - Must use a verified sender or verified domain.
  - Recommended format: `GB Medix AI <verify@gbmedix.com>` or a verified subdomain sender.
- `NEXT_PUBLIC_APP_URL=https://ai.gbmedix.com`

DNS records to configure in the DNS provider:

- SPF record required by Resend.
- DKIM record required by Resend.
- DMARC record for the sending domain.
- Any Resend domain verification records shown in the dashboard.

### Verify

- Resend dashboard marks the sender domain as verified.
- SPF, DKIM, and DMARC checks pass.
- Register a production test user.
- Trigger email verification.
- Confirm the user receives a real email.
- Click the verification link.
- Confirm the link uses:

```text
https://ai.gbmedix.com/api/auth/verify-email?token=...
```

- Confirm the user status changes from `pending` to `active`.

### Success Standard

- Production never uses `ConsoleEmailProvider`.
- Verification email is delivered to a real mailbox.
- Verification link opens successfully.
- User becomes `active` after clicking the link.
- Verified user can continue into the health assessment flow.

## 4. Stripe

### Console

- Stripe dashboard in live mode.
- Deployment platform environment variables page.

### Configure

- Product:
  - Name: `Premium AI Health Management Report`
  - Reference/SKU: `premium_report`
- Price:
  - Amount: `$9.99`
  - Currency: USD
  - Purchase type: one-time payment
- Webhook endpoint:

```text
https://ai.gbmedix.com/api/webhooks/stripe
```

- Webhook events:
  - `checkout.session.completed`
  - `charge.refunded`
  - `checkout.session.expired`
  - `payment_intent.payment_failed`
  - `charge.dispute.created`

Environment variables:

- `STRIPE_SECRET_KEY`
  - Must be live-mode secret key.
- `STRIPE_WEBHOOK_SECRET`
  - Must be copied from the live webhook endpoint.

### Verify

- Stripe dashboard endpoint shows the exact production webhook URL.
- Webhook endpoint has all required events.
- Production deployment has `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`.
- Start checkout from a Premium report upgrade flow.
- Complete a controlled production payment.
- Confirm Stripe sends `checkout.session.completed`.
- Confirm the app creates or updates:
  - `PaymentRecord.status = paid`
  - resource-scoped active Entitlement
- Issue a refund in Stripe.
- Confirm Stripe sends `charge.refunded`.
- Confirm the app updates:
  - Payment status to `refunded`
  - Entitlement to revoked

### Success Standard

- Successful payment unlocks only the purchased Premium report scope.
- Failed, expired, disputed, or refunded payments do not leave Premium access active.
- Refund revokes Entitlement.
- Stripe webhook delivery has no persistent failures.

## 5. OpenAI

### Console

- OpenAI Platform dashboard.
- Deployment platform environment variables page.

### Configure

- `OPENAI_API_KEY`
  - Must be a production key with access to the configured model.
  - Must have billing/quota available.

### Verify

- Authenticated verified user completes a health assessment.
- AI report generation succeeds.
- AI output validates as structured JSON before storage.
- `AIUsage` records are created with:
  - user
  - endpoint
  - model
  - tokens
  - cost
  - created timestamp
  - IP when available
- Token budget controls still prevent excessive usage.

### Success Standard

- Production AI assessment and Premium report generation work without fallback/mock behavior.
- Invalid AI output is rejected instead of being saved.
- AI cost tracking is visible in `AIUsage`.
- Unverified users cannot call AI flows.

## 6. Domain / DNS

### Console

- Domain registrar or DNS provider for `gbmedix.com`.
- Deployment platform domain settings.
- Resend domain settings.

### Configure

- Production app domain:

```text
ai.gbmedix.com
```

- DNS record required by the deployment platform, usually one of:
  - `CNAME ai -> <platform target>`
  - `A` record to platform IP, if required by the platform
- HTTPS/TLS certificate through the deployment platform.
- Resend email DNS records for the sending domain.

Production environment variable:

- `NEXT_PUBLIC_APP_URL=https://ai.gbmedix.com`

Proxy/rate-limit variables:

- `TRUST_PROXY_HEADERS=true`
- `TRUST_PROXY_IP_HEADER`
  - Configure only to the trusted client IP header provided by the deployment platform or edge provider.

### Verify

- `https://ai.gbmedix.com/` resolves publicly.
- HTTPS certificate is valid.
- The deployed app redirects and links to `https://ai.gbmedix.com`, not localhost or preview URLs.
- Email verification links use the production domain.
- Stripe success/cancel redirects use the production domain.
- Trusted proxy IP header is documented by the platform and not user-spoofable.

### Success Standard

- Browser can open `https://ai.gbmedix.com/` without certificate warnings.
- `NEXT_PUBLIC_APP_URL` matches the public production origin.
- Verification email and Stripe redirects use production URLs.
- IP rate limiting does not trust arbitrary user-supplied forwarding headers.

## 7. Final Smoke Test

### Console

- Production app.
- Deployment platform logs.
- PostgreSQL provider dashboard or SQL console.
- Resend dashboard.
- Stripe dashboard.
- OpenAI usage dashboard.

### Test Flow

1. Visit `https://ai.gbmedix.com/`.
2. Register a new test user.
3. Receive verification email.
4. Click verification link.
5. Confirm user becomes `active`.
6. Visit `https://ai.gbmedix.com/en/tcm-check`.
7. Complete health assessment.
8. View free report.
9. Click Premium upgrade.
10. Start Stripe Checkout.
11. Complete payment.
12. Confirm Premium Entitlement is active.
13. Generate or view Premium report.
14. Confirm AI product recommendations render.
15. Issue a refund in Stripe.
16. Confirm webhook delivery.
17. Confirm Entitlement is revoked.
18. Confirm Premium access is locked again.

### Verify

- App routes:
  - `/`
  - `/en/tcm-check`
  - `/en/dashboard`
  - `/en/report/[id]`
  - `/api/checkout`
  - `/api/webhooks/stripe`
- Database records:
  - User moves from `pending` to `active`.
  - AI report is created.
  - `AIUsage` is recorded.
  - `PaymentRecord` is paid after checkout.
  - Entitlement is active after payment.
  - Entitlement is revoked after refund.
- Provider dashboards:
  - Resend shows delivered verification email.
  - Stripe shows successful payment and webhook delivery.
  - Stripe shows refund and webhook delivery.
  - OpenAI usage is visible.

### Success Standard

- One real user can complete the full free-to-Premium commercial loop.
- Refund closes the entitlement loop correctly.
- No production logs show persistent 500 errors during the flow.
- No user can access another user's report.
- Public traffic can be opened only after this full smoke test passes.

## Launch Gate

Production traffic remains blocked until every module above has a successful verification result.
