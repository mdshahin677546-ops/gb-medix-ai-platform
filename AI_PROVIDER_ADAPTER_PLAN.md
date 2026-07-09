# GB Medix AI Provider Adapter Implementation Plan

Status: Planning only. No business code, database schema, payment, entitlement, email, or production deployment logic is changed by this document.

## 1. Current AI Dependency Audit

The current implementation is still OpenAI-first. AI calls are embedded directly inside API route handlers instead of going through a shared provider abstraction.

| Area | File | Current call pattern | Notes |
| --- | --- | --- | --- |
| AI assistant | `app/api/assistant/route.ts` | Imports `OpenAI` from `openai`, checks `process.env.OPENAI_API_KEY`, creates `new OpenAI({ apiKey })`, calls `openai.chat.completions.create()` with `model = "gpt-4o-mini"` | Uses `enforceAIUsageBudget()`, `estimateTokens()`, and `recordAIUsage()`. Falls back to local wellness copy when no OpenAI key exists. Writes `AssistantSession`. |
| AI consult | `app/api/consult/route.ts` | Imports `OpenAI`, checks `process.env.OPENAI_API_KEY`, creates `new OpenAI({ apiKey })`, calls `chat.completions.create()` with `model = "gpt-4o-mini"` | Includes medical safety system prompt. Sends full conversation context. Records `AIUsage`. Writes `Conversation`, `Message`, and `AssistantSession`. |
| TCM health assessment | `app/api/tcm/route.ts` | Imports `OpenAI`, checks `process.env.OPENAI_API_KEY`, creates `new OpenAI({ apiKey })`, calls `chat.completions.create()` with `response_format: { type: "json_object" }` | Uses `ReportSchema.safeParse()` and rejects invalid JSON/schema output with `502`. Records `AIUsage`. Writes `TCMRecord` and free `AIReport`. |
| Report generation | `app/api/reports/generate/route.ts` | Imports `OpenAI`, checks `process.env.OPENAI_API_KEY`, creates `new OpenAI({ apiKey })`, calls `chat.completions.create()` with JSON response format | Premium path checks `checkEntitlement()` first. Creates processing placeholder, validates with `ReportSchema`, marks report `failed` on invalid JSON/schema, records `AIUsage`, saves free or premium fields. |
| Prompt/schema | `lib/report-schema.ts` | Central Zod `ReportSchema` plus `reportJsonInstruction()` | Already requires JSON-only output and wellness language. Needs to become provider-neutral and reused by all structured providers. |
| Budget/cost logging | `lib/ai-security.ts` | `enforceAIUsageBudget()`, `recordAIUsage()`, `estimateCost(model, tokens)` | Cost is currently model-only and only recognizes `gpt-4o-mini`. No provider dimension. |
| Database | `prisma/schema.prisma` | `AIUsage` has `userId`, `ip`, `model`, `tokens`, `cost`, `endpoint`, `createdAt` | `provider` is missing. Additive migration is required for provider-aware cost audit. |

Current direct OpenAI dependency summary:

- `OpenAI` SDK import is repeated in 4 API routes.
- `OPENAI_API_KEY` is required by behavior in each route, not by a single provider factory.
- Model selection is hardcoded as `gpt-4o-mini`.
- Structured JSON behavior exists for assessment/report routes but is not abstracted.
- Cost estimation cannot distinguish OpenAI from DeepSeek or future providers.
- Medical safety prompts exist but are route-local and can drift.

## 2. Provider Adapter Design

Add a small provider layer under `lib/ai/` and migrate API routes to call this layer instead of constructing SDK clients directly.

Recommended files:

| File | Responsibility |
| --- | --- |
| `lib/ai/providers/types.ts` | Shared provider interfaces, request/response types, usage type. |
| `lib/ai/providers/openai.ts` | OpenAI implementation. |
| `lib/ai/providers/deepseek.ts` | DeepSeek implementation using OpenAI-compatible SDK client. |
| `lib/ai/provider-factory.ts` | Reads env, validates required variables, returns selected provider. |
| `lib/ai/prompts.ts` | Shared medical safety prompt and structured report prompt helpers. |
| `lib/ai/structured-json.ts` | JSON parsing and Zod validation helper. |
| `lib/ai/cost.ts` | Provider/model cost calculation. |

Proposed TypeScript interface:

```ts
export type AIProviderName =
  | "openai"
  | "deepseek"
  | "qwen"
  | "kimi"
  | "glm"
  | "doubao";

export type AIProviderUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens: number;
};

export type AIProviderResult<TContent = string> = {
  content: TContent;
  raw: unknown;
  usage: AIProviderUsage;
  provider: AIProviderName;
  model: string;
};

export interface AIProvider {
  name: AIProviderName;
  model: string;

  generateHealthAssessment(input: HealthAssessmentInput): Promise<AIProviderResult<StructuredReport>>;

  generateReport(input: GenerateReportInput): Promise<AIProviderResult<StructuredReport>>;

  generateChatCompletion(input: ChatCompletionInput): Promise<AIProviderResult<string>>;

  generateStructuredJSON<T>(
    input: StructuredJSONInput<T>
  ): Promise<AIProviderResult<T>>;
}
```

Route migration target:

- `app/api/assistant/route.ts` calls `provider.generateChatCompletion()`.
- `app/api/consult/route.ts` calls `provider.generateChatCompletion()` with full conversation context.
- `app/api/tcm/route.ts` calls `provider.generateHealthAssessment()`.
- `app/api/reports/generate/route.ts` calls `provider.generateReport()`.
- All routes continue to use existing authentication, email verification, entitlement, rate limit, idempotency, and persistence logic.

Unified return shape:

```ts
{
  content,
  raw,
  usage,
  provider,
  model
}
```

## 3. Environment Variable Design

New provider selection variables:

| Variable | Required when | Purpose |
| --- | --- | --- |
| `AI_PROVIDER` | Always in production | Provider selector: `openai`, `deepseek`, `qwen`, `kimi`, `glm`, or `doubao`. |
| `AI_MODEL` | Recommended | Explicit model override for selected provider. |
| `OPENAI_API_KEY` | `AI_PROVIDER=openai` | OpenAI API key. |
| `DEEPSEEK_API_KEY` | `AI_PROVIDER=deepseek` | DeepSeek API key. |
| `DEEPSEEK_BASE_URL` | Optional for DeepSeek | Defaults to `https://api.deepseek.com`. |
| `QWEN_API_KEY` | Future `AI_PROVIDER=qwen` | Alibaba Cloud Model Studio key. |
| `QWEN_BASE_URL` | Future `AI_PROVIDER=qwen` | Qwen OpenAI-compatible or provider-specific base URL. |
| `KIMI_API_KEY` | Future `AI_PROVIDER=kimi` | Moonshot API key. |
| `KIMI_BASE_URL` | Future `AI_PROVIDER=kimi` | Defaults to `https://api.moonshot.ai/v1`. |
| `GLM_API_KEY` | Future `AI_PROVIDER=glm` | Zhipu/GLM API key. |
| `GLM_BASE_URL` | Future `AI_PROVIDER=glm` | Provider base URL. |
| `DOUBAO_API_KEY` | Future `AI_PROVIDER=doubao` | Volcengine/Doubao key. |
| `DOUBAO_BASE_URL` | Future `AI_PROVIDER=doubao` | Provider base URL. |

Validation rules:

- If `AI_PROVIDER=openai`, require `OPENAI_API_KEY`; do not require `DEEPSEEK_API_KEY`.
- If `AI_PROVIDER=deepseek`, require `DEEPSEEK_API_KEY`; do not require `OPENAI_API_KEY`.
- In production, missing `AI_PROVIDER` should fail fast with a clear configuration error.
- Unknown provider values should fail fast.
- `AI_MODEL` should default per provider only when omitted:
  - OpenAI default: existing production model, currently `gpt-4o-mini`.
  - DeepSeek default: `deepseek-chat` unless a product decision selects another DeepSeek model.

## 4. DeepSeek Provider Design

DeepSeek first implementation should use the existing `openai` npm package because DeepSeek exposes an OpenAI-compatible API.

Implementation concept:

```ts
const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com"
});
```

DeepSeek provider requirements:

- Use `DEEPSEEK_API_KEY`.
- Use `DEEPSEEK_BASE_URL`, defaulting to `https://api.deepseek.com`.
- Use `AI_MODEL` or default `deepseek-chat`.
- Preserve route-level token budget checks before model calls.
- Return normalized usage:
  - `inputTokens`
  - `outputTokens`
  - `totalTokens`
- Support structured JSON output through a shared helper:
  - request JSON output when the provider supports it;
  - still parse response text;
  - validate with Zod;
  - reject invalid output before database writes.
- Preserve medical safety prompts:
  - no diagnosis;
  - no treatment promises;
  - no prescription;
  - no disease probability;
  - no triage direction;
  - emergency concerns must direct users to local emergency services or qualified clinicians.
- Preserve disclaimer constraints in health assessment, free report, premium report, assistant, and consult flows.
- Record `AIUsage` with `provider = "deepseek"`, selected model, endpoint, token count, and estimated cost.

## 5. Prompt Compatibility Strategy

Different providers have different JSON-following behavior, so prompts must be stricter and validation must remain server-side.

Required strategy:

- Centralize safety copy in `lib/ai/prompts.ts`.
- Keep route-specific context, but share the same prohibited medical claims list.
- All structured outputs must pass `ReportSchema.safeParse()` or a route-specific Zod schema.
- Invalid JSON must not be stored as successful report data.
- Invalid schema output must not be stored as successful report data.
- Premium report placeholder behavior should stay as-is: mark `failed` when provider output cannot be parsed or validated.
- Do not allow provider output to override application policy, entitlement checks, disclaimers, or report type boundaries.
- Do not allow any provider to output:
  - diagnosis;
  - treatment instructions or treatment promises;
  - prescriptions or dosage instructions;
  - disease probability;
  - clinical triage recommendations;
  - claims that the AI replaces a licensed clinician.

Recommended shared structured generation flow:

1. Build system prompt from safety prompt plus schema instruction.
2. Call selected provider.
3. Extract provider text content.
4. Parse JSON.
5. Validate with Zod.
6. Return normalized provider result.
7. Only then persist report data.

## 6. Fallback Strategy

First version should not implement automatic cross-provider fallback.

Reason:

- Health management reports must remain consistent and auditable.
- Silent fallback can make report behavior hard to reproduce.
- Cost, safety behavior, model capability, and data residency differ across providers.

Allowed switching mode:

- Configuration-level switch only:
  - `AI_PROVIDER=openai`
  - `AI_PROVIDER=deepseek`

Operational behavior:

- If configured provider is unavailable, return a safe service-unavailable error.
- Log provider failure without leaking API keys or raw private health data.
- Do not automatically retry against another provider.

## 7. Cost Recording

Current `AIUsage` model:

```prisma
model AIUsage {
  id        String   @id @default(cuid())
  userId    String
  ip        String   @default("unknown")
  model     String
  tokens    Int
  cost      Float
  endpoint  String   @default("unknown")
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id])
}
```

Gap:

- `provider` is missing.
- `estimateCost(model, tokens)` is model-only and currently recognizes only `gpt-4o-mini`.

Migration proposal:

```prisma
model AIUsage {
  id        String   @id @default(cuid())
  userId    String
  ip        String   @default("unknown")
  provider  String   @default("openai")
  model     String
  tokens    Int
  cost      Float
  endpoint  String   @default("unknown")
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([ip])
  @@index([provider])
  @@index([model])
  @@index([provider, model])
  @@index([endpoint])
  @@index([createdAt])
}
```

Code-level plan:

- Update `recordAIUsage()` signature to accept `provider`.
- Keep `model` required.
- Move cost logic to `estimateAICost({ provider, model, tokens })`.
- Unknown provider/model cost should be explicitly handled:
  - either return `0` with a warning log; or
  - use a conservative configured estimate.
- Admin usage reporting should group by provider, model, endpoint, and day.

## 8. Test Plan

Required tests before coding is accepted:

| Test | Expected result |
| --- | --- |
| `AI_PROVIDER=deepseek` without `OPENAI_API_KEY` | Provider factory succeeds when `DEEPSEEK_API_KEY` exists. |
| `AI_PROVIDER=openai` without `OPENAI_API_KEY` | Provider factory fails with clear configuration error. |
| Provider factory selection | `openai` returns OpenAI provider; `deepseek` returns DeepSeek provider; unknown provider fails. |
| DeepSeek base URL | DeepSeek client uses `DEEPSEEK_BASE_URL` or defaults to `https://api.deepseek.com`. |
| DeepSeek request construction | Uses OpenAI-compatible chat completion call with selected model. |
| Invalid JSON handling | Invalid JSON response returns safe error and does not persist successful report data. |
| Schema validation | Output failing `ReportSchema` returns safe error and does not save premium/free success data. |
| Premium report validation | Existing premium schema validation and failed-placeholder behavior remain effective. |
| Medical safety prompt | Provider requests include the shared no-diagnosis/no-treatment/no-prescription safety prompt. |
| AIUsage provider logging | Usage records include provider, model, endpoint, tokens, and cost. |
| OpenAI route parity | Existing OpenAI behavior remains functional when `AI_PROVIDER=openai`. |
| DeepSeek route parity | Health assessment, report generation, assistant, and consult use DeepSeek when configured. |

Recommended test files:

- `tests/ai-provider-factory.test.mjs`
- `tests/ai-provider-deepseek.test.mjs`
- `tests/ai-structured-output.test.mjs`
- Update `tests/sprint-1b-commercial-flow.test.mjs` only if provider behavior affects premium report generation mocks.

Validation commands:

```bash
npx tsc --noEmit --incremental false
npm run test:commercial
npm run build
```

If a new AI provider test script is added:

```bash
npm run test:ai-provider
```

## 9. Implementation Boundary

Do not change these systems unless a direct compile/test dependency requires a tiny interface update:

- Stripe checkout and webhook logic.
- Entitlement grant/revoke/check behavior.
- Report ownership and IDOR protections.
- Email provider and verification flow.
- Existing production PostgreSQL migrations, except the additive `AIUsage.provider` migration if approved.
- Landing page, dashboard, report page layout, or marketing copy.
- Product recommendation business rules.

Allowed implementation scope after this plan is approved:

- Add provider abstraction files.
- Replace direct route-level OpenAI construction with provider factory calls.
- Add provider-aware `AIUsage` logging.
- Add `AIUsage.provider` migration if approved.
- Add environment variable documentation.
- Add provider-focused tests.

## 10. Risk Analysis

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Different JSON stability by model | Reports can fail more often or produce malformed output | Keep strict Zod validation, do not persist invalid output, use safe error responses, tune provider prompts separately. |
| Health compliance drift | Provider may output diagnostic or treatment language | Centralize medical safety prompts, validate/scan generated text for prohibited claims where feasible, keep disclaimers visible in UI. |
| Cost calculation differences | AIUsage cost may be inaccurate | Maintain provider/model cost table and document unknown-cost behavior. Review pricing before production switch. |
| Provider availability | Domestic/international providers may have outages or regional issues | No automatic fallback in v1; use operational config switch and status monitoring. |
| Data residency and cross-border privacy | User health data may be processed in different jurisdictions | Document provider data processing location, update privacy policy before using non-US providers for production users, avoid sending unnecessary PII. |
| SDK compatibility differences | OpenAI-compatible APIs may not support every parameter identically | Keep provider implementations isolated and test `response_format`, model names, token usage fields, and error formats per provider. |
| Auditability | Switching providers can make old reports hard to trace | Store `provider`, `model`, `endpoint`, `tokens`, and cost in `AIUsage`; consider adding provider metadata to `AIReport` in a later audit-focused phase if needed. |

## Recommended Rollout Sequence

1. Add provider interface and factory behind tests.
2. Add DeepSeek provider with mocked SDK calls.
3. Add provider-aware cost calculation and `AIUsage.provider` migration.
4. Move assistant and consult routes to provider adapter.
5. Move TCM assessment and report generation routes to provider adapter.
6. Run OpenAI parity tests with `AI_PROVIDER=openai`.
7. Run DeepSeek tests with mocked DeepSeek client.
8. Deploy to staging with `AI_PROVIDER=deepseek`.
9. Run smoke tests:
   - register verified user;
   - complete health assessment;
   - generate free report;
   - generate premium report with entitlement;
   - confirm `AIUsage.provider = deepseek`.
10. Only after staging acceptance, configure production provider switch.

## Acceptance Criteria

- No API route directly imports or constructs `OpenAI`.
- `AI_PROVIDER=deepseek` works without `OPENAI_API_KEY`.
- `AI_PROVIDER=openai` still works with `OPENAI_API_KEY`.
- DeepSeek uses `DEEPSEEK_API_KEY` and `DEEPSEEK_BASE_URL`.
- All structured report output passes Zod validation before persistence.
- Invalid JSON/schema output is rejected safely and not stored as successful report content.
- Medical safety/disclaimer prompt is present for every provider and every AI route.
- `AIUsage` records provider, model, endpoint, tokens, cost, and createdAt.
- Existing Stripe, Entitlement, Email, report permission, and PostgreSQL production behavior remain unchanged except the approved `AIUsage` additive migration.

## Review Findings & Acceptance Criteria (Required Before / During Codex Development)

Architect review verdict: **PASS WITH CONDITIONS.** The dependency audit is
complete (OpenAI is constructed only in `assistant`, `consult`, `tcm`, and
`reports/generate`), the adapter architecture is sound and future-extensible,
DeepSeek uses an OpenAI-compatible client with independent keys/base URL, Zod
validation and medical-safety prompts are preserved, `AIUsage` becomes
provider-aware via an additive migration, and v1 is config-switch-only with no
auto fallback. The items below are binding. C-1 and C-2 are medical-data
cross-border compliance gates and MUST be satisfied before any production
switch to a non-US provider; C-2 also shapes how the provider layer builds
prompts, so it must be implemented during coding, not deferred.

### C-1 (P0 for production switch) — Cross-border data & informed consent gate

DeepSeek, Qwen, Kimi, GLM, and Doubao are China-based providers. Sending a
user's health assessment signals (sleep, stress, diet, fatigue, body
sensations) to them is a cross-border transfer of sensitive health data
(PIPL / GDPR exposure). This must be a hard gate, not a risk-table mitigation:

- Before switching production traffic to any non-US provider:
  - Update the privacy policy to disclose third-party AI processing of health
    data and the processing jurisdiction.
  - Obtain user consent for that processing.
- Document, per provider, the data-processing region.
- Acceptance: production is not switched to a non-US provider until the privacy
  disclosure + consent are live and recorded.

### C-2 (implement during coding) — Data minimization in provider payloads

The provider layer must not send PII to the model:

- Never send `email`, `userId`, user names, or account identifiers in prompts.
- For `assistant`/`consult`, strip or omit free-text PII and
  `familyMember.name` / `familyMember.note`; send only the wellness signals
  needed for the response.
- Define, at field level, exactly what each route forwards to the provider.
- Acceptance: a test asserts provider request payloads contain no email,
  userId, or configured PII fields.

### C-3 (should) — Test the real provider factory, not only mocks

- `AI_PROVIDER` → provider selection and missing-key fail-fast must be unit
  tested against the real `provider-factory` (pure logic, no network), in
  addition to mocked SDK behaviour tests.

### Minor (fold in)

- Update `.env.example` and `DEPLOYMENT_CHECKLIST.md` with `AI_PROVIDER`,
  `AI_MODEL`, `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL` and the validation rules.
- Consider collapsing `generateHealthAssessment` / `generateReport` into the
  generic `generateStructuredJSON<T>` to reduce interface redundancy.

### Already correct — preserve
- Complete dependency audit; config-switch-only (no auto fallback); Zod
  validation before persistence; centralized medical-safety prompt; premium
  field isolation and entitlement/IDOR boundaries untouched; additive
  `AIUsage.provider` migration; staging smoke asserting `AIUsage.provider`.
