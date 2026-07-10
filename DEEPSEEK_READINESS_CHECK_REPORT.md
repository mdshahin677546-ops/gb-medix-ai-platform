# DeepSeek Production Readiness Check Report

Date: 2026-07-10

## Summary

Status: PARTIALLY VERIFIED - NOT READY TO ENABLE DEEPSEEK UNTIL MANUAL CONFIRMATIONS ARE COMPLETE

The production deployment for commit `93e4961f823d26418fec2c5ae4a314ed49ddbe8b` is live and the public third-party AI privacy notice pages are reachable. However, production Vercel environment variables and production PostgreSQL migration/table state could not be fully verified from this workstation because the local repository is not linked to the Vercel project and no Vercel token/project metadata is available locally.

DeepSeek was not enabled or modified during this check.

## 1. GitHub / Vercel Deployment

Expected commit:

`93e4961f823d26418fec2c5ae4a314ed49ddbe8b`

Local and remote git state:

- `main`: `93e4961f823d26418fec2c5ae4a314ed49ddbe8b`
- `origin/main`: `93e4961f823d26418fec2c5ae4a314ed49ddbe8b`

GitHub commit status:

- Context: Vercel
- State: success
- Description: Deployment has completed
- Target: `https://vercel.com/gbm-deix/gb-medix-ai-platform/9Bgc1WEmAKoQypnsK7jAMvZV5k8x`

GitHub deployment record:

- Environment: Production
- SHA: `93e4961f823d26418fec2c5ae4a314ed49ddbe8b`
- State: success
- Created at: 2026-07-10T07:58:09Z
- Environment URL: `https://gb-medix-ai-platform-piv2afo8t-gbm-deix.vercel.app`

Conclusion: VERIFIED. Vercel has a successful Production deployment for commit `93e4961`.

## 2. Public URL Checks

Checked URLs:

| URL | Result | Notes |
| --- | --- | --- |
| `https://ai.gbmedix.com` | 200 OK | Landing page reachable. |
| `https://ai.gbmedix.com/zh/third-party-ai-privacy` | 200 OK | Third-party AI notice content detected. |
| `https://ai.gbmedix.com/en/third-party-ai-privacy` | 200 OK | Third-party AI notice content detected. |
| `https://ai.gbmedix.com/zh/tcm-check` | 200 OK | Consent-related text detected in production HTML. |
| `https://ai.gbmedix.com/api/ai-consent/status` | 401 Unauthorized | Expected for unauthenticated request; confirms route is deployed and protected. |

Conclusion: VERIFIED. Required public pages are reachable.

## 3. Current Production AI Provider

Requirement:

- Confirm production is still not enabled with `AI_PROVIDER=deepseek`.

Result:

- NOT FULLY VERIFIED from this workstation.
- The production app does not expose the active AI provider through a public endpoint, which is good for security.
- Vercel environment variables could not be read locally because the repo is not linked to Vercel and the Vercel CLI has no available project context.
- No local code or production configuration was changed.

Manual confirmation required in Vercel:

- Open Vercel project `gb-medix-ai-platform`.
- Go to Settings -> Environment Variables -> Production.
- Confirm `AI_PROVIDER` is not set to `deepseek` until the final switch window.

Conclusion: BLOCKED FOR FULL CONFIRMATION. Requires Vercel dashboard or authenticated Vercel CLI access.

## 4. Production Database / Migrations

Migration files present in repository:

- `20260708173621_sprint_1a_postgres_foundation`
- `20260708190000_sprint_1b_commercial_loop`
- `20260709120000_ai_provider_usage_provider`
- `20260709130000_ai_processing_consent`

Local Prisma migration status attempt:

- Command: `npx prisma migrate status --schema prisma/schema.prisma`
- Result: failed before status could be confirmed.
- Observed datasource: PostgreSQL database `gbmedix`, schema `public`, host `localhost:5432`.
- Interpretation: local `.env` points at a local database, not a confirmed production database. This cannot prove production migration state.

Manual production checks required:

- Confirm Vercel Production `DATABASE_URL` points to the production PostgreSQL database.
- Run or verify `npx prisma migrate deploy` in the production deployment environment.
- Confirm migration `20260709130000_ai_processing_consent` is applied.

Conclusion: BLOCKED FOR FULL CONFIRMATION. Production migration state was not verifiable from this workstation.

## 5. AIProcessingConsent Table

Requirement:

- Confirm `AIProcessingConsent` table exists in production.

Result:

- NOT VERIFIED directly.
- The migration file `20260709130000_ai_processing_consent` exists locally.
- The public API route `/api/ai-consent/status` returns `401 Unauthorized` for unauthenticated users, which confirms the route is deployed and protected but does not prove the production table exists.

Manual verification options:

1. In the production PostgreSQL console, run a metadata-only check:

```sql
select exists (
  select 1
  from information_schema.tables
  where table_schema = 'public'
    and table_name = 'AIProcessingConsent'
) as exists;
```

2. Or run a logged-in smoke test:

- Create or use a verified test user.
- Visit `/zh/tcm-check`.
- Accept the third-party AI processing consent.
- Confirm the consent status persists.

Conclusion: BLOCKED FOR FULL CONFIRMATION. Requires production DB access or authenticated smoke test.

## 6. Vercel DeepSeek Environment Variables

Required Production variables:

- `AI_PROVIDER`
- `DEEPSEEK_API_KEY`
- `DEEPSEEK_BASE_URL`
- `DEEPSEEK_MODEL`

Local verification result:

- Global `vercel` CLI is not installed.
- `npx vercel@latest env ls production --scope gbm-deix` failed because this codebase is not linked to a Vercel project.
- No Vercel token or project metadata was available locally.
- No secret values were printed or accessed.

Manual confirmation required in Vercel:

- Confirm all variable names exist in Production.
- Confirm `DEEPSEEK_BASE_URL=https://api.deepseek.com`.
- Confirm `DEEPSEEK_MODEL` is set to the approved production model.
- Confirm `DEEPSEEK_API_KEY` is present and scoped appropriately.
- Do not switch `AI_PROVIDER=deepseek` until migration and consent smoke tests are complete.

Conclusion: BLOCKED FOR FULL CONFIRMATION. Requires Vercel dashboard or linked/authenticated Vercel CLI.

## 7. Readiness Decision

Can publicly access production site: YES

Can publicly access third-party AI privacy notice: YES

Vercel deployed latest commit `93e4961`: YES

Can confirm production is not using DeepSeek: NOT FROM THIS WORKSTATION

Can confirm production migrations are current: NOT FROM THIS WORKSTATION

Can confirm `AIProcessingConsent` table exists in production: NOT FROM THIS WORKSTATION

Can confirm DeepSeek Production variables are prepared: NOT FROM THIS WORKSTATION

Final decision:

DO NOT ENABLE `AI_PROVIDER=deepseek` YET.

Before switching production to DeepSeek, complete these manual checks:

1. Confirm Vercel Production env vars are present and `AI_PROVIDER` is still not `deepseek`.
2. Confirm `npx prisma migrate deploy` has run against the production database.
3. Confirm `AIProcessingConsent` exists in production.
4. Perform a logged-in negative consent smoke test.
5. Perform a logged-in consent acceptance smoke test.
6. Only then set `AI_PROVIDER=deepseek` during a controlled switch window.
