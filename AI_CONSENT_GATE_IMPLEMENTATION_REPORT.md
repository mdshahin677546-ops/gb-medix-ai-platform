# GB Medix AI Consent Gate Implementation Report

Status: Implementation complete on `feature/ai-consent-gate`.

## Modified Files

Application code:

- `app/api/assistant/route.ts`
- `app/api/consult/route.ts`
- `app/api/tcm/route.ts`
- `app/api/reports/generate/route.ts`
- `app/api/ai-consent/status/route.ts`
- `app/api/ai-consent/accept/route.ts`
- `app/api/ai-consent/revoke/route.ts`
- `app/[lang]/tcm-check/tcm-check-form.tsx`
- `app/[lang]/dashboard/page.tsx`
- `app/[lang]/dashboard/ai-consent-manager.tsx`
- `lib/ai/provider-factory.ts`
- `lib/ai-consent/consent-policy.ts`
- `lib/ai-consent/consent-service.ts`

Database:

- `prisma/schema.prisma`
- `prisma/migrations/20260709130000_ai_processing_consent/migration.sql`

Tests and docs:

- `package.json`
- `tests/ai-consent-gate.test.mjs`
- `THIRD_PARTY_AI_PRIVACY_NOTICE.md`
- `AI_PROVIDER_PRODUCTION_SETUP.md`
- `AI_CONSENT_GATE_IMPLEMENTATION_REPORT.md`

## New Migration

Migration file:

- `prisma/migrations/20260709130000_ai_processing_consent/migration.sql`

Adds:

- `AIProcessingConsent`
- `userId`
- `provider`
- `consentVersion`
- `acceptedAt`
- `revokedAt`
- `createdAt`
- `updatedAt`
- indexes for user, provider, version, revokedAt, and active consent lookup.

The migration is additive and does not alter Stripe, Entitlement, Payment, Email, or existing report permission tables.

## Consent Gate Rules

Current consent version:

```ts
AI_CONSENT_VERSION = "2026-07-09-v1"
```

Providers requiring consent in v1:

- `deepseek`
- `qwen`
- `kimi`
- `glm`
- `doubao`

Provider temporarily exempt in v1:

- `openai`

Valid consent requires:

- current user ID;
- current server-side `AI_PROVIDER`;
- current consent version;
- `revokedAt = null`.

If consent is missing, revoked, or outdated, third-party AI routes return:

```json
{
  "error": "AI_CONSENT_REQUIRED",
  "message": "Please review and accept the third-party AI processing notice before using AI health features."
}
```

Status code: `403`.

## P1-1 Implementation

P1-1 required v1 to gate only third-party providers and not gate OpenAI.

Implemented in:

- `lib/ai-consent/consent-policy.ts`

`requiresAIConsent()` returns true only for:

- `deepseek`
- `qwen`
- `kimi`
- `glm`
- `doubao`

`openai` returns false and is not blocked by the v1 consent gate.

## P1-2 Implementation

P1-2 required revocation support.

Implemented through:

- `AIProcessingConsent.revokedAt`
- `revokeAIConsent(userId, provider)`
- `POST /api/ai-consent/revoke`

Revocation behavior:

- sets `revokedAt`;
- does not delete history;
- makes the consent invalid for future third-party AI calls;
- user must accept again before using third-party AI provider features.

## API List

### GET `/api/ai-consent/status`

Returns:

```json
{
  "provider": "deepseek",
  "required": true,
  "accepted": false,
  "consentVersion": "2026-07-09-v1"
}
```

### POST `/api/ai-consent/accept`

Body:

```json
{
  "accepted": true
}
```

Provider is read from server-side `AI_PROVIDER`. Client provider input is ignored.

### POST `/api/ai-consent/revoke`

Revokes active consent for the current user and current server-side provider.

## UI Locations

- `/[lang]/tcm-check`
  - Shows consent card only when consent is required and missing.
  - Requires active checkbox confirmation.
  - Calls `POST /api/ai-consent/accept`.
  - Blocks assessment submit until accepted.

- `/[lang]/dashboard`
  - Adds "Manage AI Processing Consent".
  - Shows provider, required status, consent status, consent version, acceptedAt.
  - Calls `POST /api/ai-consent/revoke`.

## Test Results

Run before final handoff:

```bash
npx prisma generate
npx tsc --noEmit --incremental false
npm run test:ai-provider
npm run test:email
npm run test:commercial
npm run test:ai-consent
npm run build
git diff --check
```

## Remaining Risks

- Production privacy notice still needs product/legal approval before enabling DeepSeek.
- This is a minimum consent gate, not a complete privacy center.
- OpenAI is intentionally exempt in v1 and should be revisited later for a unified consent policy.
- Real DeepSeek staging validation is still required before production switch.

## DeepSeek Production Checklist

Before setting `AI_PROVIDER=deepseek` in production:

- Deploy `AIProcessingConsent` migration.
- Confirm users can actively accept consent.
- Confirm users can revoke consent.
- Confirm revoked users receive `403` for third-party AI routes.
- Publish or link `THIRD_PARTY_AI_PRIVACY_NOTICE.md` content in production.
- Confirm existing Stripe, Entitlement, Email, Payment, and Report permission tests pass.
- Run staging smoke test with `AI_PROVIDER=deepseek`.
