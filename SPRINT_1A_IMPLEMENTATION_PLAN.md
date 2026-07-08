# GB Medix AI 2.0 Sprint 1A Implementation Plan

Branch: `feature/sprint-1a-commercial-foundation`  
Status: Plan only, pending review  
Base: approved Sprint 0.5 branch state  
Rule: do not modify database or run destructive migration steps before review approval

## 1. Current Schema Analysis

### Current Datasource

Current Prisma datasource is still SQLite:

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

Current local development database is expected to be `prisma/dev.db` through `DATABASE_URL="file:./dev.db"`.

### Existing Production-Readiness Work From Sprint 0.5

Sprint 0.5 already introduced important security baseline models:

- `Entitlement`
- `AIUsage`
- `DoctorVerification`
- `PatientConsent`
- `Conversation`
- `Message`
- `AIReport`

It also removed request-path runtime DDL and moved toward Prisma migrations. Current `lib/db.ts` should remain a no-op compatibility layer or be removed only after verifying all imports are gone.

### Existing Core Models

Current models:

- `User`
- `Merchant`
- `Product`
- `TCMRecord`
- `PaymentRecord`
- `RFQRecord`
- `AssistantSession`
- `Doctor`
- `ConsultationOrder`
- `Entitlement`
- `AIUsage`
- `DoctorVerification`
- `PatientConsent`
- `Conversation`
- `Message`
- `AIReport`

### Current Gaps For Sprint 1A

Database:

- Datasource is not PostgreSQL.
- Migrations are not yet a clean PostgreSQL chain.
- Existing migration lock must be moved to PostgreSQL.
- Existing SQLite-oriented SQL types must be reviewed for PostgreSQL compatibility.

AI report system:

- `AIReport` currently stores report payloads as text fields:
  - `content String`
  - `recommendations String`
- Sprint 1A requires structured fields and PostgreSQL JSONB:
  - `analysis Json @db.JsonB`
  - `recommendations Json @db.JsonB`
  - `lifestylePlan Json @db.JsonB`
  - `productSuggestions Json @db.JsonB`

Entitlement:

- Entitlement exists, but the service should be formalized under `/lib/entitlement`.
- Required service functions:
  - `checkEntitlement()`
  - `grantEntitlement()`
  - `revokeEntitlement()`

Email verification:

- `User` has no status or email verification timestamp.
- No `EmailVerification` model exists yet.
- No abstract email provider exists.

AI usage:

- `AIUsage` already includes `userId`, `ip`, `model`, `tokens`, `cost`, `createdAt`.
- Sprint 1A requires adding `endpoint`.
- Admin usage aggregation API does not exist yet.

## 2. Migration Strategy

### Principle

Sprint 1A is an architecture upgrade PR. Migration work should be explicit, reviewable, and reversible.

No request should execute DDL. All schema changes must be represented as Prisma migrations.

### Step 1: Stabilize Baseline

Before changing provider:

1. Confirm current Sprint 0.5 migrations are present and represent the approved schema.
2. Confirm `lib/db.ts` does not execute DDL.
3. Confirm no route imports `ensureDatabase()` for runtime table creation.

### Step 2: Switch Prisma Provider

Change:

```prisma
provider = "sqlite"
```

to:

```prisma
provider = "postgresql"
```

Update `.env.example`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/gbmedix?schema=public"
```

Do not overwrite the local `.env` file because it may contain secrets.

### Step 3: Convert Migration Chain To PostgreSQL

Review existing migration SQL for SQLite-only types:

- `DATETIME`
- SQLite-specific defaults
- SQLite-specific `REAL`
- incompatible `ALTER TABLE` patterns

Convert to PostgreSQL-compatible forms:

- `TIMESTAMP(3)`
- `DOUBLE PRECISION`
- JSONB fields where required

Update `prisma/migrations/migration_lock.toml`:

```toml
provider = "postgresql"
```

### Step 4: Add Sprint 1A Migration

Create migration:

```text
prisma/migrations/YYYYMMDDHHMMSS_sprint_1a_commercial_foundation/migration.sql
```

Expected changes:

- Add `User.status`
- Add `User.emailVerifiedAt`
- Add `EmailVerification`
- Add `AIUsage.endpoint`
- Replace/upgrade `AIReport` text payload fields with JSONB structured fields
- Add required indexes

### Step 5: Migration Validation

Before touching a real database:

1. Run `npx prisma validate`.
2. Run `npx prisma generate`.
3. Run `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`.
4. Run `npm run build` using a PostgreSQL-shaped `DATABASE_URL`.

Against a real PostgreSQL database after approval:

1. Provision empty PostgreSQL database.
2. Run `npx prisma migrate deploy`.
3. Run API integration tests.
4. Verify report JSONB insert/read.
5. Verify entitlement indexes.
6. Verify AIUsage aggregation.

## 3. Data Migration Plan

### Local Development Data

SQLite `prisma/dev.db` should not be automatically migrated in this PR without review.

Recommended approach:

1. Treat SQLite as development-only legacy data.
2. For production-like testing, provision a clean PostgreSQL database.
3. Use Prisma migrations to create schema.
4. Seed only minimal test users/payments/reports as test data.

### Existing SQLite Data Export Option

If local MVP data must be preserved:

1. Export SQLite rows to JSON or CSV.
2. Transform records to new PostgreSQL schema.
3. Import in controlled scripts after migration.
4. Validate row counts and foreign key relationships.

This should be a separate data migration script, not hidden inside request handlers.

### AIReport Data Upgrade

Current `AIReport` stores:

- `content` as string
- `recommendations` as string

Sprint 1A target:

- `summary String`
- `analysis Json @db.JsonB`
- `recommendations Json @db.JsonB`
- `lifestylePlan Json @db.JsonB`
- `productSuggestions Json @db.JsonB`

Data migration strategy:

1. Add new structured columns with safe defaults.
2. Convert valid legacy JSON text into JSONB.
3. Use fallback empty JSON for malformed rows.
4. Only drop legacy `content` after conversion is verified.

### User Verification Data

Add:

- `User.status` default `pending`
- `User.emailVerifiedAt`
- `EmailVerification`

Existing users:

- Conservative default: `pending`.
- Alternative after product approval: mark existing trusted users as `active`.

Recommendation:

- Keep existing users `pending` unless product owner approves a backfill rule.

### AIUsage Data

Add:

- `endpoint String @default("unknown")`

Existing rows:

- Set `endpoint = "unknown"` during migration.
- New writes must record the actual endpoint.

## 4. Implementation Scope

### In Scope

1. PostgreSQL datasource and migrations.
2. Structured `AIReport` model and JSONB fields.
3. `ReportSchema` validation.
4. `POST /api/reports/generate`.
5. `GET /api/reports/[id]` with user-owned access check.
6. `/lib/entitlement` service.
7. Email verification foundation:
   - `EmailVerification`
   - `POST /api/auth/send-verification`
   - `POST /api/auth/verify-email`
   - abstract `EmailProvider`
8. `AIUsage.endpoint`.
9. `/api/admin/ai-usage` aggregation endpoint.
10. Build/typecheck/migration validation.

### Out Of Scope

Do not implement:

- Shopping cart
- Product checkout
- Supply chain workflows
- RFQ expansion
- Supplier models
- Doctor-end feature expansion
- Admin dashboard UI
- Production email provider binding
- Sprint 1B work

## 5. Risk Assessment

### PostgreSQL Migration Risk

Risk:

- Existing SQLite migrations may not run as-is against PostgreSQL.

Mitigation:

- Convert migration SQL explicitly.
- Run `prisma validate`, `prisma generate`, and `migrate diff`.
- Run `migrate deploy` only against a real PostgreSQL database after review.

### AIReport JSONB Migration Risk

Risk:

- Existing `AIReport.content` or `recommendations` may contain malformed JSON.

Mitigation:

- Use safe defaults.
- Validate conversion in staging.
- Keep legacy columns until conversion is verified if needed.

### Auth Compatibility Risk

Risk:

- Requiring verified email immediately could break current users.

Mitigation:

- Add verification infrastructure first.
- Create users as `pending`.
- Continue preserving current session flow until product decides enforcement points.

### Entitlement Refactor Risk

Risk:

- Moving logic into `/lib/entitlement` could break existing paid content checks.

Mitigation:

- Keep compatibility exports from `lib/entitlements.ts`.
- Update paid content paths gradually.
- Test body reset and consult pack independently.

### Build-Time DB Access Risk

Risk:

- Next.js may prerender public API routes and hit PostgreSQL during build.

Mitigation:

- Mark DB-backed API routes dynamic where needed.
- Verify with `npm run build`.

## 6. Rollback Plan

### Code Rollback

Use git revert on the Sprint 1A PR commit(s), since this work is isolated on:

```text
feature/sprint-1a-commercial-foundation
```

### Database Rollback

Prisma does not auto-generate down migrations.

Rollback options:

1. Preferred: restore database from pre-migration backup.
2. For staging only: drop and recreate database from previous migration chain.
3. For partial rollback: manually reverse the Sprint 1A migration after DBA review.

### Safe Deployment Order

1. Merge code only after migration review.
2. Backup database.
3. Run `prisma migrate deploy`.
4. Run smoke tests.
5. Deploy application.
6. Monitor AIUsage, report generation, auth, and entitlement logs.

### Emergency Disable Switches

Recommended environment-level mitigations:

- Disable report generation by removing `OPENAI_API_KEY`.
- Disable admin usage access by clearing `ADMIN_EMAILS`.
- Disable checkout entitlements by withholding payment webhook secrets in non-prod.

## 7. Review Checklist

Before implementation starts:

- Confirm PostgreSQL migration approach.
- Confirm whether existing users should be `pending` or backfilled to `active`.
- Confirm AIReport legacy data conversion rule.
- Confirm admin identity source for `/api/admin/ai-usage`.
- Confirm email provider abstraction is enough for Sprint 1A.
- Confirm no shop, supply chain, or doctor-end feature work should be included.

## 8. Proposed Test Plan

After approval and implementation:

1. New user registration test.
2. Email verification send test.
3. Email verification token test.
4. AI detection generates structured report.
5. Report owner can read own report.
6. User A cannot read User B report.
7. `prisma migrate deploy` against PostgreSQL.
8. `prisma generate`.
9. `npm run build`.
10. AIUsage admin aggregation with authorized and unauthorized users.

## 9. Review Findings & Acceptance Criteria (Required Before Implementation)

These items are binding. They come from reviewing the first Sprint 1A draft
(now reverted to `stash@{0}: preplan-sprint-1a-implementation-draft`), which
passed all non-executing checks yet was not deployable and shipped decorative
email verification. Do not repeat those two failures.

### Must-fix 1: Migration approach must produce a chain that actually deploys

Problem observed in the draft: the datasource was switched to PostgreSQL, but
the `baseline` and `sprint_0_5` migrations still contained SQLite `DATETIME`
(18 occurrences) and `REAL`. PostgreSQL has no `DATETIME` type, so
`prisma migrate deploy` fails on the first migration. This was missed because
`prisma validate`, `prisma generate`, `migrate diff --to-schema-datamodel`, and
`npm run build` **do not execute migration SQL** — they cannot catch bad DDL.

Required approach (replaces the "hand-convert existing migration SQL" wording in
Step 3):

- Do **not** hand-edit historical migration files to swap types. Regenerate the
  PostgreSQL migration chain natively: point `DATABASE_URL` at an empty
  PostgreSQL (local Docker is fine:
  `docker run -e POSTGRES_PASSWORD=dev -p 5432:5432 postgres`) and run
  `prisma migrate dev` so Prisma emits correct Postgres DDL (`TIMESTAMP(3)`,
  `DOUBLE PRECISION`, JSONB). This also removes the `cost REAL` vs schema
  `DOUBLE PRECISION` drift automatically.
- Acceptance criterion (hard merge gate): `prisma migrate deploy` succeeds
  against a real, empty PostgreSQL from a clean state. Phase 1 is not "done"
  until this passes. The non-executing checks in Step 5 are necessary but
  **not sufficient** and must never be treated as deploy validation.

### Must-fix 2: Email verification must gate access and must not be abusable

Problems observed in the draft:

- `POST /api/auth/send-verification` issued a login session cookie *before*
  verification, so verification gated nothing (a login oracle).
- Its `upsert` used `update: { status: "pending" }`, so calling it with any
  existing user's email reset an already-`active` account back to `pending`
  (account-state tampering). The endpoint was also unauthenticated and
  unthrottled (email bombing + unbounded `EmailVerification` rows).
- No endpoint checked `status === "active"`, so unverified `pending` users kept
  full AI access — verification was decorative and left P1-1 fully open.

Acceptance criteria for the three auth endpoints:

- `send-verification` must **not** set a session cookie. A session is granted
  only after a verification token is successfully consumed.
- `send-verification` must **not** downgrade or overwrite an existing user's
  `status` (never move `active` → `pending`).
- `send-verification` must be rate-limited per email and per IP.
- Define and document the enforcement gate in this sprint: list exactly which
  endpoints require `status === "active"`. Verification that gates nothing is
  not acceptable. (If the product chooses a soft-launch grace period, state it
  explicitly with an end condition rather than leaving it open.)

### Already correct — preserve as-is

- `GET /api/reports/[id]` scoped by `{ id, userId }` (IDOR-safe); keep test 6.
- Structured AI output via `ReportSchema` + Zod; reject invalid JSON before
  insert.
- Branch isolation, rollback plan, `lib/entitlements.ts` compatibility export,
  DB-backed routes marked dynamic, and phased AIReport JSONB upgrade
  (add columns → convert → verify → drop `content`).

### Accepted open items (no change needed this sprint)

- Existing users default to `pending` (conservative; approved).
- `/api/admin/ai-usage` guarded by `ADMIN_EMAILS` is an interim measure; note
  the follow-up to a real role model.
