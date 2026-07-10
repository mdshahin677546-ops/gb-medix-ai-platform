# DeepSeek Production Preflight Report

Date: 2026-07-10

Scope: verify readiness before switching production AI provider to DeepSeek.

Hard boundaries followed:

- No secrets printed.
- No business code modified.
- Production `AI_PROVIDER=deepseek` was not enabled by this audit.
- Sprint 2 was not started.

## 1. GitHub / Vercel Deployment Source

Expected production commit:

- `1b467d9b266eddfcfd02c48e6a8e5fda5b3caaa9`

Local Git status:

- Current branch: `main`
- `main`: `1b467d9b266eddfcfd02c48e6a8e5fda5b3caaa9`
- `origin/main`: `1b467d9b266eddfcfd02c48e6a8e5fda5b3caaa9`

GitHub deployment metadata:

- Latest `Production` deployment SHA: `1b467d9b266eddfcfd02c48e6a8e5fda5b3caaa9`
- Deployment state: `success`
- Deployment created at: `2026-07-10T00:24:35Z`

Production domain check:

- `https://ai.gbmedix.com`: HTTP `200`
- Vercel response headers present: `X-Vercel-Cache`, `X-Vercel-Id`

Status:

- PASS: production deployment points to the latest `main` commit `1b467d9`.

## 2. Prisma Migration Requirement

PR #5 includes a new migration:

- `prisma/migrations/20260709130000_ai_processing_consent/migration.sql`

This migration creates:

- `AIProcessingConsent`
- indexes for `userId`, `provider`, `consentVersion`, `revokedAt`
- composite index for `userId`, `provider`, `consentVersion`, `revokedAt`
- foreign key to `User`

Production build command in `vercel.json` / `package.json`:

- build uses `npm run build`
- `npm run build` runs `prisma generate && next build`
- it does not run `prisma migrate deploy`

Local migration status check:

- `npx prisma migrate status` attempted.
- Result: failed against local `.env` datasource with Prisma schema engine error.
- No production database mutation was attempted.

Status:

- ACTION REQUIRED: run `npx prisma migrate deploy` against the production PostgreSQL database unless it has already been run after deployment `1b467d9`.

## 3. AIProcessingConsent Table

Code/migration verification:

- Prisma schema contains `model AIProcessingConsent`.
- Migration SQL contains `CREATE TABLE "AIProcessingConsent"`.
- Consent APIs exist:
  - `GET /api/ai-consent/status`
  - `POST /api/ai-consent/accept`
  - `POST /api/ai-consent/revoke`

Database verification:

- A read-only Prisma query for `public."AIProcessingConsent"` was attempted against local `.env` datasource.
- Result: `PrismaClientInitializationError`.
- Production DB table existence could not be verified from this machine.

Status:

- CODE READY.
- DB VERIFICATION BLOCKED.
- Production table must be confirmed after `prisma migrate deploy`.

## 4. Third-Party AI Privacy Notice

Repository file exists:

- `THIRD_PARTY_AI_PRIVACY_NOTICE.md`

Public URL checks:

- `https://ai.gbmedix.com/THIRD_PARTY_AI_PRIVACY_NOTICE.md`: HTTP `404`
- `https://ai.gbmedix.com/third-party-ai-privacy-notice`: HTTP `404`

Status:

- ACTION REQUIRED: publish the third-party AI privacy notice or add an accessible route/page before enabling DeepSeek in production.

## 5. Vercel Production Environment Variables

Required variables for DeepSeek production switch:

- `AI_PROVIDER=deepseek`
- `DEEPSEEK_API_KEY`
- `DEEPSEEK_BASE_URL=https://api.deepseek.com`
- `DEEPSEEK_MODEL`

Verification limitations:

- Vercel CLI is not installed locally.
- `npx vercel --version` failed before CLI could be used.
- No Vercel API token or project link was available for safe environment variable inspection.
- Therefore Vercel Production env vars could not be verified from this machine.

Local `.env` presence check only:

- `DATABASE_URL`: present locally
- `OPENAI_API_KEY`: present locally
- `AI_PROVIDER`: not present locally
- `DEEPSEEK_API_KEY`: not present locally
- `DEEPSEEK_BASE_URL`: not present locally
- `DEEPSEEK_MODEL`: not present locally

Status:

- VERCEL ENV VERIFICATION BLOCKED.
- Before production switch, confirm all four required variables in Vercel Production.
- Do not expose or paste secret values in logs or chat.

## 6. Consent Gate Readiness

Implemented readiness:

- DeepSeek and other third-party providers require active `AIProcessingConsent`.
- Consent is versioned via `AI_CONSENT_VERSION`.
- OpenAI remains not gated by the current policy, while third-party providers are gated.
- AI routes call consent enforcement before provider calls.
- Premium report entitlement remains separate from consent.

Status:

- CODE READY.

## 7. Final Preflight Decision

DeepSeek production switch is not yet cleared from this audit because:

1. Production database migration status could not be verified.
2. `AIProcessingConsent` table existence in production could not be verified.
3. Third-party AI privacy notice is not publicly accessible.
4. Vercel Production DeepSeek environment variables could not be verified.

Required before enabling `AI_PROVIDER=deepseek`:

1. Run or confirm `npx prisma migrate deploy` against production PostgreSQL.
2. Confirm `AIProcessingConsent` exists in production.
3. Publish an accessible third-party AI privacy notice.
4. Configure and verify Vercel Production env vars:
   - `AI_PROVIDER=deepseek`
   - `DEEPSEEK_API_KEY`
   - `DEEPSEEK_BASE_URL=https://api.deepseek.com`
   - `DEEPSEEK_MODEL`
5. Perform a production smoke test:
   - sign in
   - accept third-party AI processing consent
   - run health assessment
   - confirm report generation
   - confirm `AIUsage.provider` records `deepseek`

Conclusion:

DEEPSEEK_PRODUCTION_PREFLIGHT_BLOCKED
