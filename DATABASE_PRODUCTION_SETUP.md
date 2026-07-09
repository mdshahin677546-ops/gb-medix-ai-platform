# PostgreSQL Production Setup

## 1. Create Database

Create a PostgreSQL database for production:

```sql
CREATE DATABASE gbmedix;
CREATE USER gbmedix_app WITH PASSWORD 'replace-with-strong-password';
GRANT ALL PRIVILEGES ON DATABASE gbmedix TO gbmedix_app;
```

Use the provider-specific managed database console if using RDS, Supabase, Neon, Railway, Render, or another hosted PostgreSQL provider.

Production environment variable:

```env
DATABASE_URL="postgresql://gbmedix_app:PASSWORD@HOST:5432/gbmedix?schema=public"
```

## 2. Migration Steps

Run before deploying the app process:

```bash
npx prisma validate
npx prisma migrate status
npx prisma migrate deploy
npx prisma generate
```

Expected migration chain:

- `20260708173621_sprint_1a_postgres_foundation`
- `20260708190000_sprint_1b_commercial_loop`

## 3. Sprint 1B Schema Additions

Sprint 1B adds:

- Resource-scoped payment fields on `PaymentRecord`.
- Resource-scoped Entitlement fields.
- `AIReport.followUpPlan`.
- Unique report key on `userId, assessmentId, type`.
- `ProductRecommendation` table and indexes.

## 4. Pre-Migration Data Checks

Check duplicate AI reports:

```sql
SELECT "userId", "assessmentId", "type", COUNT(*)
FROM "AIReport"
GROUP BY "userId", "assessmentId", "type"
HAVING COUNT(*) > 1;
```

Check orphaned report assessment references:

```sql
SELECT r."id", r."assessmentId"
FROM "AIReport" r
LEFT JOIN "TCMRecord" t ON t."id" = r."assessmentId"
WHERE r."assessmentId" IS NOT NULL
  AND t."id" IS NULL;
```

Check payment rows missing user for Premium:

```sql
SELECT "id", "sessionId", "resourceId"
FROM "PaymentRecord"
WHERE "product" = 'premium_report'
  AND "userId" IS NULL;
```

## 5. Backup Recommendations

Before migration:

- Take a full database snapshot.
- Export schema and data if provider snapshots are not available.
- Confirm point-in-time recovery window.

Example:

```bash
pg_dump "$DATABASE_URL" --format=custom --file=gbmedix-pre-sprint-1b.backup
```

After migration:

- Run smoke tests.
- Take a post-migration snapshot.
- Record migration timestamp and deployed commit SHA.

## 6. Rollback Plan

Preferred rollback:

1. Stop app traffic.
2. Restore the pre-migration database snapshot.
3. Redeploy previous app version.
4. Verify login, free assessment, and report reads.

Code-only rollback is not enough if the migration has already applied new constraints or tables.

If snapshot restore is not possible:

- Disable Premium checkout at the edge/load balancer.
- Keep read-only access for existing reports.
- Investigate migration failure manually.
- Do not drop Sprint 1B columns without confirming no live payment/report state depends on them.

## 7. Production Smoke Test

After deploy:

1. Create/verify user.
2. Complete `/en/tcm-check`.
3. Confirm free report at `/en/report/[id]`.
4. Complete Stripe test or live low-risk checkout.
5. Generate Premium report.
6. Trigger refund webhook in Stripe.
7. Confirm Premium access is revoked.

## 8. Operational Notes

- Do not use `prisma db push` in production.
- Use `prisma migrate deploy` only.
- Keep database credentials out of logs.
- Rotate database password after incident response or vendor access changes.
