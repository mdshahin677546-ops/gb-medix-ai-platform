# DeepSeek Production Switch Runbook

Purpose: enable `AI_PROVIDER=deepseek` in production safely, after the code and
compliance gate are already merged.

Prerequisites (already done in code, verified in review):
- Consent gate enforces third-party providers server-side (403 when unconsented).
- Privacy notice page exists at `/[lang]/third-party-ai-privacy` and is linked
  from the tcm-check consent UI and the dashboard consent manager.
- Provider payloads are minimized (no email / userId / paymentId / entitlementId
  / ip / session sent to the model).
- `AIUsage` records `provider`; migration `20260709130000_ai_processing_consent`
  is in the repo.

Rules:
- Never print secret values in logs or chat.
- v1 has no automatic cross-provider fallback; switching is config-only.
- Do not enable DeepSeek until every step below is confirmed.

---

## Step 1 — Apply the consent migration to production PostgreSQL

`vercel`/`npm run build` runs `prisma generate && next build` only — it does NOT
run migrations. Run the migration manually with `DATABASE_URL` pointed at the
production database:

```bash
npx prisma migrate deploy
npx prisma migrate status            # expect all applied, incl. 20260709130000_ai_processing_consent
psql "$DATABASE_URL" -c '\d "AIProcessingConsent"'   # confirm the table exists
```

Gate: `AIProcessingConsent` exists in production.

## Step 2 — Deploy the latest main (privacy notice must be live)

Production must run a commit that includes the privacy notice page
(`7b372d2` or later). If production is still on `1b467d9`, redeploy:

```bash
git push origin main
# after the Vercel deploy finishes:
curl -s -o /dev/null -w "%{http_code}\n" https://ai.gbmedix.com/en/third-party-ai-privacy   # expect 200
curl -s -o /dev/null -w "%{http_code}\n" https://ai.gbmedix.com/zh/third-party-ai-privacy   # expect 200
```

Gate: both notice URLs return 200.

## Step 3 — Configure Vercel Production environment variables

Set and verify (do not print values):

```bash
vercel env ls production
```

Required:
- `AI_PROVIDER=deepseek`
- `DEEPSEEK_API_KEY=<secret>`
- `DEEPSEEK_BASE_URL=https://api.deepseek.com`
- `DEEPSEEK_MODEL=deepseek-chat`   (or the approved model)

Keep `OPENAI_API_KEY` set so rollback works.

Gate: all four present; `OPENAI_API_KEY` still present.

## Step 4 — Production smoke test

Happy path:
1. Sign in and verify email (status `active`).
2. Accept third-party AI processing consent.
3. Run a health assessment (`/[lang]/tcm-check`).
4. Confirm the free report is generated.
5. Optionally: pay for and generate a Premium report (entitlement path).

Negative consent (the critical security assertion — do not skip):
- Before accepting consent, call an AI route (e.g. `POST /api/tcm`) → expect
  **403** and no provider call.
- After revoking consent from the dashboard, call again → expect **403** again.

Provider attribution:
```bash
psql "$DATABASE_URL" -c "SELECT provider, count(*) FROM \"AIUsage\" WHERE \"createdAt\" > now() - interval '1 hour' GROUP BY provider;"
# expect provider = 'deepseek'
```

Gate: happy path works, unconsented/revoked users get 403, `AIUsage.provider = deepseek`.

## Step 5 — Rollback (keep ready; run only if needed)

If DeepSeek causes malformed JSON, schema-validation 502s, or an outage, roll
back config-only (no redeploy, no code change):

- Set `AI_PROVIDER=openai` in Vercel Production (requires `OPENAI_API_KEY`).
- Redeploy the current build (or trigger a no-op deploy) so the new env takes
  effect.

No data cleanup is needed: reports failing schema validation are never persisted
as successful data, and `AIUsage` rows keep their real `provider`/`model`.

---

## Go / No-Go

Enable `AI_PROVIDER=deepseek` in production only when Steps 1–4 gates all pass
and Step 5 rollback is confirmed ready. If any gate fails, keep
`AI_PROVIDER=openai`.
