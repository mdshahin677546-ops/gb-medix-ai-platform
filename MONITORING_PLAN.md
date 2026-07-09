# GB Medix AI Production Monitoring Plan

## 1. Error Logging

Minimum requirements:

- Capture Next.js server exceptions.
- Capture API route errors.
- Capture Prisma/database exceptions.
- Capture Stripe webhook verification failures.
- Capture AI provider failures and invalid structured output.

Recommended tools:

- Sentry
- Axiom
- Datadog
- New Relic
- Cloud provider native logs

Initial alert thresholds:

- Any sustained 5xx rate over 1 percent for 5 minutes.
- Any Stripe webhook signature verification spike.
- Any Prisma connection failure.
- Any `/api/reports/generate` failure spike.

## 2. API Monitoring

Track:

- Request count by route.
- p50/p95/p99 latency.
- 4xx and 5xx rate.
- Auth failures.
- Rate-limit responses.

Critical routes:

- `/api/tcm`
- `/api/reports/generate`
- `/api/reports/[id]`
- `/api/checkout`
- `/api/webhooks/stripe`
- `/api/auth/send-verification`
- `/api/auth/verify-email`
- `/api/admin/ai-usage`

## 3. AI Cost Monitoring

The app records AI usage in `AIUsage`.

Track daily:

- Total tokens.
- Total estimated cost.
- Tokens by endpoint.
- Tokens by user.
- Failed AI report generations.

Available internal endpoint:

```text
GET /api/admin/ai-usage
```

Requires `ADMIN_EMAILS` and a signed-in admin user.

Suggested alerts:

- Daily token usage exceeds expected baseline by 50 percent.
- Any single user reaches daily token budget repeatedly.
- `AIUsage.ip = direct` or `unknown` dominates production traffic.
- AI report generation failure rate exceeds 5 percent.

## 4. Payment Monitoring

Track:

- Checkout sessions created.
- Paid PaymentRecords.
- Active Entitlements.
- Refunded/disputed PaymentRecords.
- Entitlements revoked after refund/dispute.

Consistency checks:

```sql
SELECT p."id", p."status", p."product"
FROM "PaymentRecord" p
LEFT JOIN "Entitlement" e ON e."paymentId" = p."id"
WHERE p."status" = 'paid'
  AND p."product" = 'premium_report'
  AND e."id" IS NULL;
```

```sql
SELECT p."id", p."status", e."id" AS "entitlementId"
FROM "PaymentRecord" p
JOIN "Entitlement" e ON e."paymentId" = p."id"
WHERE p."status" IN ('refunded', 'disputed')
  AND e."status" = 'active';
```

## 5. Database Monitoring

Track:

- Connection count.
- Slow queries.
- Migration status.
- Database CPU/memory/storage.
- Backup success/failure.

Suggested alerts:

- Connection pool exhaustion.
- Disk usage over 80 percent.
- Slow query p95 above agreed threshold.
- Backup failure.

## 6. Security Monitoring

Track:

- Repeated auth failures.
- Repeated report access denials.
- Premium generation attempts without entitlement.
- Stripe webhook signature failures.
- Suspicious AI usage bursts.

Log fields to preserve:

- userId
- endpoint
- status code
- paymentId/sessionId where applicable
- reportId/assessmentId where applicable
- request correlation id if platform provides one

Do not log:

- Full health assessment content.
- Full AI report content.
- Stripe secrets.
- Auth cookies.
- OpenAI API keys.

## 7. Launch Dashboard

Minimum first-launch dashboard:

- Traffic by route.
- Error rate by route.
- AI tokens and cost per day.
- Checkout conversion count.
- Webhook success/failure count.
- Entitlement grants/revokes.
- Database health.

## 8. Incident Response

Payment issue:

1. Disable Premium checkout if needed.
2. Inspect Stripe webhook delivery.
3. Compare PaymentRecord and Entitlement rows.
4. Replay Stripe webhook event if safe.

AI cost spike:

1. Inspect `/api/admin/ai-usage`.
2. Tighten user/token budgets if needed.
3. Verify trusted proxy config.
4. Temporarily disable AI provider key if runaway cost is severe.

Database issue:

1. Stop writes if data integrity is at risk.
2. Check migration state.
3. Restore from snapshot if required.
4. Redeploy last known stable commit.
