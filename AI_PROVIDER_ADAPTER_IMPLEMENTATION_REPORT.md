# GB Medix AI Provider Adapter Implementation Report

Status: Implementation complete on `feature/ai-provider-adapter`.

## 1. Completed Scope

- Added a provider adapter layer for OpenAI-compatible AI calls.
- Implemented `OpenAIProvider`.
- Implemented `DeepSeekProvider` with OpenAI-compatible client support.
- Replaced direct `new OpenAI(...)` usage in AI API routes with `getAIProvider()`.
- Centralized medical safety prompt helpers.
- Added provider payload minimization with `sanitizeAIInput()` and `buildMinimalHealthPayload()`.
- Added provider-aware `AIUsage` tracking.
- Added an additive Prisma migration for `AIUsage.provider`.
- Added AI provider adapter tests.
- Added production setup documentation for AI provider switching.

## 2. Modified Files

Application code:

- `app/api/assistant/route.ts`
- `app/api/consult/route.ts`
- `app/api/tcm/route.ts`
- `app/api/reports/generate/route.ts`
- `app/api/admin/ai-usage/route.ts`
- `lib/ai-security.ts`

New AI provider files:

- `lib/ai/provider-factory.ts`
- `lib/ai/prompts.ts`
- `lib/ai/sanitize.ts`
- `lib/ai/providers/types.ts`
- `lib/ai/providers/openai-compatible.ts`
- `lib/ai/providers/openai.ts`
- `lib/ai/providers/deepseek.ts`

Database:

- `prisma/schema.prisma`
- `prisma/migrations/20260709120000_ai_provider_usage_provider/migration.sql`

Configuration and tests:

- `.env.example`
- `package.json`
- `tests/ai-provider-adapter.test.mjs`

Documentation:

- `AI_PROVIDER_PRODUCTION_SETUP.md`
- `AI_PROVIDER_ADAPTER_IMPLEMENTATION_REPORT.md`

## 3. Provider Architecture

Provider selection now goes through:

```ts
getAIProvider()
```

Supported provider values:

- `openai`
- `deepseek`

Reserved provider values:

- `qwen`
- `kimi`
- `glm`
- `doubao`

Unified provider methods:

- `generateHealthAssessment()`
- `generateReport()`
- `generateChatCompletion()`
- `generateStructuredJSON()`

Unified response shape:

```ts
{
  content,
  raw,
  usage: {
    inputTokens,
    outputTokens,
    totalTokens
  },
  provider,
  model
}
```

## 4. Environment Variables

Added to `.env.example`:

```env
AI_PROVIDER="openai"
AI_MODEL=""
OPENAI_MODEL=""
OPENAI_API_KEY=""
DEEPSEEK_API_KEY=""
DEEPSEEK_BASE_URL="https://api.deepseek.com"
DEEPSEEK_MODEL=""
QWEN_API_KEY=""
QWEN_BASE_URL=""
KIMI_API_KEY=""
KIMI_BASE_URL="https://api.moonshot.ai/v1"
GLM_API_KEY=""
DOUBAO_API_KEY=""
```

Rules:

- `AI_PROVIDER=openai` requires `OPENAI_API_KEY`.
- `AI_PROVIDER=deepseek` requires `DEEPSEEK_API_KEY`.
- DeepSeek does not require `OPENAI_API_KEY`.
- OpenAI does not require `DEEPSEEK_API_KEY`.
- Production is not defaulted to DeepSeek.

## 5. DeepSeek Configuration

DeepSeek uses the existing OpenAI SDK compatible client:

```ts
new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com"
})
```

Model resolution:

1. `DEEPSEEK_MODEL`
2. `AI_MODEL`
3. `deepseek-chat`

## 6. OpenAI Configuration

OpenAI model resolution:

1. `OPENAI_MODEL`
2. `AI_MODEL`
3. `gpt-4o-mini`

## 7. C-1 Production Gate: Cross-Border / Third-Party AI Consent

DeepSeek is implemented but must not be enabled in production before user consent and privacy review are complete.

Production gate:

- Do not set `AI_PROVIDER=deepseek` for production until cross-border or third-party AI processing consent is live.
- User-facing assessment flow must disclose third-party AI processing before health data is sent.
- Privacy policy must describe the AI provider and processing scope.
- This release does not add a new consent system. If a consent model exists later, it can be reused. Until then, this remains a Production Gate.

## 8. C-2 Data Minimization Implementation

New functions:

- `sanitizeAIInput()`
- `buildMinimalHealthPayload()`

Provider calls use these functions before sending payloads to OpenAI or DeepSeek.

Blocked from provider payloads:

- `email`
- `userId`
- `paymentId`
- `stripeSessionId`
- `entitlementId`
- `ip`
- auth session fields
- raw database object fields
- internal/admin fields
- secrets, tokens, API keys
- exact birth date fields

Allowed payloads:

- health assessment answers
- symptoms or lifestyle fields supplied by the user
- desensitized health context
- current language
- report type
- uploaded image content when explicitly submitted for assistant analysis

## 9. Structured Output and Safety

Structured report generation still requires:

- JSON-only model output.
- `JSON.parse()` success.
- Zod validation through `ReportSchema`.
- No successful database write for invalid JSON.
- No successful database write for invalid schema.
- Premium report field isolation through existing free/premium save functions.
- Existing entitlement checks before premium generation.

Medical safety prompt remains explicit:

- no diagnosis;
- no treatment;
- no prescription;
- no disease probability;
- no clinical triage direction;
- no replacement of licensed clinicians.

## 10. AIUsage Changes

Migration added:

```sql
ALTER TABLE "AIUsage" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'openai';
CREATE INDEX "AIUsage_provider_idx" ON "AIUsage"("provider");
CREATE INDEX "AIUsage_provider_model_idx" ON "AIUsage"("provider", "model");
```

`AIUsage` now records:

- `provider`
- `model`
- `endpoint`
- `tokens`
- `cost`
- `createdAt`

Unknown provider/model costs are recorded as `0` until pricing is audited. Token counts remain tracked.

## 11. Test Results

Passed:

```bash
npx prisma generate
npx tsc --noEmit --incremental false
npm run test:ai-provider
npm run test:email
npm run test:commercial
npm run build
```

Results:

- TypeScript: passed.
- AI provider adapter tests: 6 passed.
- Email provider tests: 6 passed.
- Commercial flow tests: 6 passed.
- Production build: passed.

## 12. Remaining Risks

- DeepSeek JSON stability must be validated in staging with real API responses.
- DeepSeek production use is blocked until cross-border or third-party AI processing consent is implemented and reviewed.
- DeepSeek cost calculation is currently conservative and records unknown model costs as `0`.
- Provider-specific error formats are normalized, but real provider outages should be observed in staging.
- Data residency and privacy policy review are required before enabling non-OpenAI providers in production.

## 13. Out of Scope

Unchanged by this implementation:

- Stripe checkout and webhooks.
- Entitlement grant/revoke/check behavior.
- Report IDOR and ownership checks.
- Email provider and verification flow.
- Payment flow.
- Marketplace, supply chain, and doctor-side features.
- Sprint 2 work.
