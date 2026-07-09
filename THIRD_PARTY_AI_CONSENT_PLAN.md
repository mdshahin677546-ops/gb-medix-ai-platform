# GB Medix AI Third-Party AI Processing Consent Gate Plan

Status: Planning only. No code, database schema, provider configuration, or production environment variable is changed by this document.

## 1. Current Risk Statement

GB Medix AI collects user-submitted health assessment information such as sleep quality, fatigue, digestion pattern, stress rhythm, lifestyle notes, uploaded context, and other wellness-related inputs. When `AI_PROVIDER` is switched from the default provider to a third-party AI provider such as DeepSeek, Qwen, Kimi, GLM, or Doubao, those health-related inputs may be processed by an external AI service.

This creates a consent requirement before production use because:

- Health assessment answers can be sensitive personal information.
- Users may not expect their wellness inputs to be sent to a third-party AI provider.
- Provider processing location, retention, and subprocessors may differ by vendor.
- Cross-border data handling may apply depending on user location and provider infrastructure.
- The platform must preserve its positioning as AI health management and lifestyle guidance, not medical diagnosis, treatment, prescription, or triage.

Therefore, before enabling non-default third-party providers in production, users should explicitly understand and accept that their submitted health assessment information may be processed by third-party AI services for the limited purpose of generating health management suggestions.

## 2. Minimum Product Plan

Add a minimal consent gate at three points:

| Location | Gate behavior |
| --- | --- |
| Before first entry to `/[lang]/tcm-check` | Show consent notice if the user has no valid consent for the active provider and consent version. |
| Before starting AI health assessment | Require active user confirmation before submitting assessment data to the AI provider. |
| Before Premium report generation | Re-check consent server-side before calling the AI provider for Premium report generation. |

Required behavior:

- If user has not accepted consent, block AI provider calls.
- If consent exists but `consentVersion` is outdated, require re-consent.
- Consent must be recorded before the first third-party AI request is sent.
- Consent gate must not weaken existing email verification, rate limits, entitlement, report ownership, or payment checks.

Suggested user flow:

1. User visits `/[lang]/tcm-check`.
2. System checks `/api/ai-consent/status`.
3. If consent is missing or outdated, show consent UI.
4. User actively accepts consent.
5. System records consent through `/api/ai-consent/accept`.
6. User can submit health assessment.
7. Before AI call, API re-checks consent server-side.
8. Premium report generation repeats the server-side consent check.

## 3. Data Model Plan

Add a minimal consent model:

```prisma
model AIProcessingConsent {
  id             String   @id @default(cuid())
  userId         String
  provider       String
  consentVersion String
  acceptedAt     DateTime
  createdAt      DateTime @default(now())
  user           User     @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([provider])
  @@index([consentVersion])
  @@index([acceptedAt])
  @@unique([userId, provider, consentVersion])
}
```

Notes:

- `provider` should store the configured provider value such as `openai`, `deepseek`, `qwen`, `kimi`, `glm`, or `doubao`.
- `consentVersion` should be a controlled app constant, for example `ai-processing-v1`.
- A version change requires users to accept again.
- Keep this additive and isolated from Stripe, Entitlement, Email, and Report schemas.

Optional future fields, not required for the minimum gate:

- `ip`
- `userAgent`
- `locale`
- `revokedAt`
- `source`

These should wait until a broader privacy center exists.

## 4. API Plan

### GET `/api/ai-consent/status`

Purpose:

- Returns whether the current signed-in user has valid consent for the active provider and current consent version.

Auth:

- Requires logged-in user.
- Should return `401` if not signed in.

Response example:

```json
{
  "provider": "deepseek",
  "consentVersion": "ai-processing-v1",
  "accepted": false,
  "requiresConsent": true
}
```

Rules:

- Resolve provider from server-side `AI_PROVIDER`.
- Use current app consent version constant.
- Treat missing or outdated consent as `requiresConsent: true`.

### POST `/api/ai-consent/accept`

Purpose:

- Records user acceptance for the active provider and current consent version.

Auth:

- Requires logged-in user.
- Should return `401` if not signed in.

Request body:

```json
{
  "accepted": true
}
```

Response example:

```json
{
  "provider": "deepseek",
  "consentVersion": "ai-processing-v1",
  "accepted": true,
  "acceptedAt": "2026-07-09T00:00:00.000Z"
}
```

Rules:

- Do not accept implicit consent.
- Do not accept if request body does not explicitly contain `accepted: true`.
- Use idempotent upsert by `userId + provider + consentVersion`.
- Do not expose internal database IDs unless needed.

## 5. UI Plan

Consent must require an active user action:

- checkbox plus button; or
- explicit confirmation button with clear text.

Recommended text:

> 我同意 GB Medix 使用第三方 AI 服务处理我提交的健康评估信息，用于生成健康管理建议。我理解该服务不构成医疗诊断、治疗或处方。

English equivalent:

> I agree that GB Medix may use third-party AI services to process the health assessment information I submit in order to generate health management guidance. I understand this service does not provide medical diagnosis, treatment, or prescriptions.

UI placement:

- `/[lang]/tcm-check`: show before the assessment form is submitted.
- Assessment submit button: disable until consent is accepted when consent is required.
- Premium report generation: show a short consent reminder if needed before generation starts.

UX rules:

- Do not pre-check the consent box.
- Do not hide the consent text behind only a link.
- Keep medical disclaimer visible.
- Keep copy aligned with health management and lifestyle guidance.
- Do not use diagnostic, treatment, prescription, disease probability, or triage language.

## 6. Provider Gate

Provider gate should run server-side before any AI provider call.

Required providers:

- `deepseek`
- `qwen`
- `kimi`
- `glm`
- `doubao`

Recommended consistency:

- Apply the same consent gate to `openai` as well, so the product has one consistent AI processing consent standard.

Server-side enforcement points:

- `/api/tcm`
- `/api/reports/generate`
- `/api/assistant`
- `/api/consult`

Minimum gate function:

```ts
requireAIProcessingConsent({
  userId,
  provider,
  consentVersion
})
```

Behavior:

- Return `403` if consent is required and missing.
- Return `403` if consent version is outdated.
- Continue only after valid consent is found.
- Do not rely on frontend-only checks.

Suggested safe error:

```json
{
  "error": "Please review and accept AI processing consent before using AI health features."
}
```

## 7. Privacy Policy Update

Before enabling third-party providers in production, update the privacy policy and related user-facing docs to cover:

- Third-party AI service explanation.
- Which AI provider may process submitted information.
- Types of data processed:
  - health assessment answers;
  - lifestyle and wellness inputs;
  - uploaded context submitted by the user;
  - language and report type;
  - desensitized health context.
- Data not intentionally sent:
  - email;
  - user ID;
  - payment IDs;
  - entitlement IDs;
  - Stripe session IDs;
  - IP address;
  - auth session data;
  - internal/admin notes.
- Processing purpose:
  - generating health management suggestions;
  - generating wellness reports;
  - supporting lifestyle guidance.
- User withdrawal of consent:
  - how users can stop future third-party AI processing;
  - what happens to previously generated reports;
  - whether historical consent records are retained for audit.
- Non-medical disclaimer:
  - AI output is not medical diagnosis;
  - AI output is not treatment;
  - AI output is not prescription;
  - users should contact licensed clinicians for medical decisions.
- Cross-border or regional processing risk where applicable.

## 8. Test Plan

Required tests:

| Test | Expected result |
| --- | --- |
| User without consent calls `/api/tcm` | Returns `403`; no AI provider call is made. |
| User accepts consent then calls `/api/tcm` | Request proceeds to existing auth/rate/provider flow. |
| User without consent calls Premium report generation | Returns `403` before provider call; entitlement logic remains intact. |
| Consent record stores provider | `AIProcessingConsent.provider` equals active `AI_PROVIDER`. |
| Consent record stores version | `AIProcessingConsent.consentVersion` equals current app consent version. |
| Consent version changes | Previously accepted user must re-consent. |
| Frontend tcm-check gate | User cannot start assessment until consent is accepted when required. |
| OpenAI consistency mode | If gate applies to OpenAI, OpenAI calls also require valid consent. |
| Stripe unaffected | Checkout and webhook tests continue to pass. |
| Entitlement unaffected | Premium entitlement checks continue to pass. |
| Email unaffected | Verification flow tests continue to pass. |
| Report permission unaffected | Report IDOR protections continue to pass. |

Suggested commands after implementation:

```bash
npx prisma generate
npx tsc --noEmit --incremental false
npm run test:ai-provider
npm run test:commercial
npm run test:email
npm run build
```

Add a focused test script if implemented:

```bash
npm run test:ai-consent
```

## 9. Implementation Boundary

This gate is a minimum production-readiness requirement before enabling DeepSeek or other third-party AI providers.

In scope:

- Consent data model.
- Consent status API.
- Consent accept API.
- Server-side AI provider gate.
- Minimal `/[lang]/tcm-check` consent UI.
- Premium report generation consent check.
- Tests and documentation.

Out of scope:

- Doctor-side features.
- Supply chain features.
- Marketplace changes.
- Full privacy center.
- Consent withdrawal UI beyond a documented future requirement.
- Provider auto-fallback.
- Changing Stripe, Entitlement, Email Provider, payment flow, or report permission logic.
- Sprint 2.

## 10. Recommended Rollout Sequence

1. Add `AIProcessingConsent` Prisma model and migration.
2. Add consent version constant, for example `AI_PROCESSING_CONSENT_VERSION = "ai-processing-v1"`.
3. Add `/api/ai-consent/status`.
4. Add `/api/ai-consent/accept`.
5. Add server-side helper `requireAIProcessingConsent()`.
6. Gate `/api/tcm`, `/api/reports/generate`, `/api/assistant`, and `/api/consult`.
7. Add `/[lang]/tcm-check` consent UI.
8. Add tests for missing consent, accepted consent, version changes, and provider recording.
9. Update privacy policy and launch docs.
10. Run staging with `AI_PROVIDER=deepseek`.
11. Only after legal/product approval, enable DeepSeek in production.

## 11. Acceptance Criteria

- No third-party AI provider call can happen without valid active consent.
- Consent is stored per user, provider, and consent version.
- Changing consent version requires re-consent.
- UI requires explicit user action.
- Server-side APIs enforce the gate even if frontend is bypassed.
- Existing Stripe, Entitlement, Email, and Report permission tests remain green.
- Production `AI_PROVIDER=deepseek` remains blocked until this gate and privacy policy updates are complete.

## 12. Review Findings & Acceptance Criteria (Required Before / During Codex Development)

Architect review verdict: **PASS WITH CONDITIONS.** The gate is server-side on
all four AI endpoints, consent is scoped per user × provider × version, the UI
requires an explicit action, the privacy-policy scope is complete, and the
boundary is correctly minimal. Two P1 items must be resolved before coding; the
P2 items should be folded in.

### P1-1 — OpenAI gating vs. breaking the live funnel

Production currently runs `AI_PROVIDER=openai` and serves real users. If the
consent gate is applied to `openai`, every existing active user is immediately
blocked with 403 until they consent, breaking the live funnel.

Required decision (write into §6):
- v1 gates only third-party providers (`deepseek`, `qwen`, `kimi`, `glm`,
  `doubao`); `openai` is exempt in v1 (US provider covered by existing terms).
- The gate is provider-scoped, so switching production to `deepseek` activates
  it for everyone at that point — which is the intended behavior.
- If a unified standard that also gates `openai` is later desired, it must ship
  with an existing-user rollout (consent backfill or grace period), never as a
  hard cutover.

### P1-2 — Consent withdrawal / `revokedAt`

The plan treats consent as the processing basis and the privacy policy promises
"how users can stop", but the model has no `revokedAt` and withdrawal is fully
out of scope — i.e. "consent that cannot be withdrawn", which is not a lawful
consent basis under GDPR/PIPL.

Required:
- Add `revokedAt DateTime?` to `AIProcessingConsent` now (additive, cheap).
- `requireAIProcessingConsent()` must treat a row with `revokedAt` set as
  `requiresConsent` (i.e. not valid), so a revoked user is re-gated.
- A withdrawal *UI* may be deferred, but at least one real revoke path must
  exist (an API or a support-driven action), and the privacy-policy "how to
  stop" text must map to that real mechanism.

### P2 — Fold in

- State that `consentVersion` is the single lever tied to privacy-policy /
  terms / provider-scope changes: any material change MUST bump
  `consentVersion` (this is why separate `privacyVersion` / `termsVersion`
  fields are not required for the minimum gate).
- State that `providerScope` is unnecessary because per-provider consent rows
  (`@@unique([userId, provider, consentVersion])`) already scope consent per
  provider; switching provider requires fresh consent.
- Add a real integration test for the gate (unconsented → 403; consent row →
  proceeds), not only source-guard assertions.
- Clarify that reading already-generated reports is not gated; only new AI
  provider calls are gated.

### Already correct — preserve
- Server-side gate on `/api/tcm`, `/api/reports/generate`, `/api/assistant`,
  `/api/consult`; explicit (non-prechecked) UI action; consent keyed per
  user × provider × version; provider resolved server-side (not client-spoofable);
  privacy-policy scope listing data sent and not sent; minimal boundary with
  Stripe / Entitlement / Email / report permission untouched.
