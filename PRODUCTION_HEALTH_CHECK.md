# GB Medix AI Production Health Check

## 1. Deployment Steps

1. Confirm target commit.
2. Confirm environment variables.
3. Confirm PostgreSQL backup.
4. Install dependencies.

```bash
npm ci
```

5. Validate Prisma schema.

```bash
npx prisma validate
```

6. Check migration status.

```bash
npx prisma migrate status
```

7. Apply migrations.

```bash
npx prisma migrate deploy
```

8. Generate Prisma Client.

```bash
npx prisma generate
```

9. Run commercial flow mock tests.

```bash
npm run test:commercial
```

10. Build.

```bash
npm run build
```

11. Start.

```bash
npm start
```

## 2. Environment Checks

Required:

- `DATABASE_URL`
- `AUTH_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `OPENAI_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

Recommended:

- `ADMIN_EMAILS`
- `TRUST_PROXY_HEADERS`
- `TRUST_PROXY_IP_HEADER`

Email decision:

- If email verification is required, do not launch with `EMAIL_PROVIDER=console`.

## 3. Database Checks

Before migration:

```sql
SELECT "userId", "assessmentId", "type", COUNT(*)
FROM "AIReport"
GROUP BY "userId", "assessmentId", "type"
HAVING COUNT(*) > 1;
```

After migration:

```bash
npx prisma migrate status
```

Expected:

- Database schema is up to date.
- Migration provider is PostgreSQL.

## 4. HTTP Route Checks

Run after `npm start`.

Pages:

```bash
curl -I https://YOUR_DOMAIN/
curl -I https://YOUR_DOMAIN/en/tcm-check
curl -I https://YOUR_DOMAIN/en/dashboard
curl -I https://YOUR_DOMAIN/en/report/dry-run-report-id
```

Expected:

- `/`: `200`
- `/en/tcm-check`: `200`
- `/en/dashboard`: `200` or redirect/auth behavior if platform adds auth middleware later.
- `/en/report/dry-run-report-id`: should not expose another user's report; signed-out auth gate is acceptable.

API route registration:

```bash
curl -I https://YOUR_DOMAIN/api/checkout
curl -I https://YOUR_DOMAIN/api/webhooks/stripe
```

Expected:

- `405 Method Not Allowed` on GET is acceptable for POST-only routes.
- Do not configure `/api/webhook`; the correct endpoint is `/api/webhooks/stripe`.

## 5. Stripe Health Checks

Stripe webhook endpoint:

```text
https://YOUR_DOMAIN/api/webhooks/stripe
```

Required events:

- `checkout.session.completed`
- `checkout.session.expired`
- `payment_intent.payment_failed`
- `charge.refunded`
- `charge.dispute.created`

Staging test:

1. Complete Premium checkout.
2. Confirm PaymentRecord becomes `paid`.
3. Confirm Entitlement becomes `active`.
4. Generate Premium report.
5. Trigger refund.
6. Confirm Entitlement becomes `revoked`.

## 6. AI Health Checks

After launch:

1. Sign in as a verified user.
2. Complete `/en/tcm-check`.
3. Confirm free report renders.
4. Unlock Premium.
5. Generate Premium report.
6. Confirm `AIUsage` row is created.
7. Check `/api/admin/ai-usage` as admin.

Expected:

- Free report does not store Premium fields.
- Premium generation requires active Entitlement.
- Repeated Premium generation returns existing report.

## 7. Failure Handling

Build failure:

- Stop deployment.
- Check TypeScript/build output.
- Do not deploy partially built assets.

Migration failure:

- Stop app rollout.
- Keep previous app version running.
- Inspect Prisma error.
- Restore database snapshot if migration partially applied and app cannot continue.

Startup failure:

- Check missing env vars.
- Check `DATABASE_URL`.
- Check `AUTH_SECRET`.
- Check port binding.

Route health failure:

- Confirm `npm start` is running.
- Confirm reverse proxy routes to the correct port.
- Confirm `NEXT_PUBLIC_APP_URL` matches public domain.

Stripe webhook failure:

- Confirm endpoint path is `/api/webhooks/stripe`.
- Confirm `STRIPE_WEBHOOK_SECRET`.
- Replay failed event from Stripe dashboard after fixing config.

AI cost or provider failure:

- Confirm `OPENAI_API_KEY`.
- Check AI provider dashboard.
- Check `AIUsage` volume.
- Temporarily disable AI report generation if runaway cost is detected.

## 8. Rollback

Preferred rollback:

1. Disable new traffic.
2. Restore pre-deploy database snapshot.
3. Redeploy previous app commit.
4. Verify `/`, `/en/tcm-check`, and report access.

Do not roll back app code only after Sprint 1B payment/report data has been written unless the database state is confirmed compatible.
