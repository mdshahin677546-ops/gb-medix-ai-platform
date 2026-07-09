# GB Medix AI Provider Production Setup

This document explains how to switch the production AI provider after the adapter implementation.

## Supported Providers

Implemented:

- `AI_PROVIDER=openai`
- `AI_PROVIDER=deepseek`

Reserved but not implemented:

- `qwen`
- `kimi`
- `glm`
- `doubao`

## Production Gate Before DeepSeek

Do not enable `AI_PROVIDER=deepseek` in production until the product has shipped user consent for cross-border or third-party AI processing.

Minimum consent requirements:

- Tell users that their health assessment answers may be processed by a third-party AI provider.
- Tell users which provider is used before submission.
- Explain that the output is health management and lifestyle guidance, not medical diagnosis.
- Provide a clear opt-in before sending health assessment data to a non-default provider.
- Update privacy policy and launch copy if provider data processing location changes.

The current implementation adds the adapter and tests only. It does not enable DeepSeek by default.

## Required Consent Gate Checklist Before DeepSeek Production

Before setting `AI_PROVIDER=deepseek` in production, confirm:

- `AIProcessingConsent` migration has been deployed with `prisma migrate deploy`.
- `/api/ai-consent/status` returns provider, required, accepted, and consentVersion.
- `/api/ai-consent/accept` records active consent for the current user and current provider.
- `/api/ai-consent/revoke` sets `revokedAt` without deleting history.
- `/[lang]/tcm-check` lets users actively accept the third-party AI processing notice.
- `/[lang]/dashboard` lets users view and revoke current provider consent.
- `openai` remains ungated in v1.
- `deepseek`, `qwen`, `kimi`, `glm`, and `doubao` require consent before AI calls.
- Privacy notice has been published or linked from the production flow.
- `npm run test:ai-consent` passes.

## OpenAI Configuration

Production variables:

```env
AI_PROVIDER=openai
AI_MODEL=
OPENAI_MODEL=gpt-4o-mini
OPENAI_API_KEY=
```

Validation:

1. Deploy with OpenAI variables.
2. Register and verify a test user.
3. Complete `/en/tcm-check`.
4. Confirm free report generation succeeds.
5. Confirm `AIUsage.provider = openai`.

## DeepSeek Configuration

Production variables:

```env
AI_PROVIDER=deepseek
AI_MODEL=
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

Validation:

1. Confirm cross-border or third-party AI processing consent is live.
2. Deploy to staging first with `AI_PROVIDER=deepseek`.
3. Register and verify a test user.
4. Complete `/en/tcm-check`.
5. Generate a free report.
6. Purchase Premium in test mode or grant a scoped test entitlement.
7. Generate a Premium report.
8. Confirm invalid JSON/schema failures do not save successful reports.
9. Confirm `AIUsage.provider = deepseek` and `AIUsage.model = deepseek-chat` or configured model.

## Provider Failure Behavior

The first version does not automatically fallback across providers.

If the configured provider is missing credentials or fails:

- API returns a safe error.
- Raw provider errors are not exposed to users.
- Reports with processing placeholders are marked `failed` when generation fails.
- Operators must switch provider by changing environment configuration and redeploying.

## Data Minimization

All provider calls pass through `sanitizeAIInput()` or `buildMinimalHealthPayload()` before leaving the application.

Blocked fields include:

- `email`
- `userId`
- `paymentId`
- `stripeSessionId`
- `entitlementId`
- `ip`
- auth session fields
- raw database object fields
- admin/internal notes
- secrets and tokens

Allowed payloads should contain only AI-task fields such as assessment answers, symptoms or lifestyle fields, desensitized wellness context, current language, and report type.
