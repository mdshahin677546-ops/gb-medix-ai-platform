# GB Medix AI 2.0 Sprint 1B Implementation Plan

Status: Final plan, pending Claude Code confirmation  
Scope: First commercial closed-loop stage  
Rule: Plan only; do not code before approval  
Primary blockers: P1-1 report paywall bypass, P1-2 trusted IP rate-limit weakness

## 1. Current User Flow Analysis

Current flow:

1. User signs in with email.
2. User opens TCM/body assessment.
3. User submits intake.
4. AI generates a report-like result.
5. Result page shows preview and upgrade CTA.
6. Checkout can create a Stripe session.
7. Success page checks entitlement and shows paid content.

Commercial weaknesses:

- Free assessment and Premium report generation are not clearly separated.
- A direct API call must not generate Premium content without entitlement.
- A paid query param, leaked session id, or unrelated paid record must not unlock reports.
- Current IP rate limiting must not trust spoofable headers such as `x-forwarded-for` by default.

Target Sprint 1B flow:

1. Consumer lands on `/`.
2. User starts free AI health assessment.
3. System generates free report only.
4. Free report shows limited value and Premium CTA.
5. User pays through Stripe for Premium report.
6. Stripe webhook grants scoped entitlement.
7. Premium report is generated or revealed only after entitlement.
8. AI recommendations are generated from the Premium report and stored.

## 2. Report Permission Commercial Design

Report types:

- `free_health_report`
- `premium_health_report`

Report statuses:

- `draft`
- `free_ready`
- `premium_locked`
- `premium_generating`
- `premium_ready`
- `failed`

Free report rules:

- Requires authenticated user.
- Requires report ownership.
- Does not require payment.
- Must only store and return free-safe fields.
- Must not persist Premium-only fields and rely only on read-side filtering.

Premium report rules:

- Requires authenticated user.
- Requires report ownership.
- Requires active scoped entitlement.
- Entitlement must match current user, product, and assessment/report resource.

P1-1 paywall fix:

- `POST /api/reports/generate` must accept `type`.
- `free_health_report` may be generated from the user's own assessment.
- `premium_health_report` requires `checkEntitlement()`.
- `GET /api/reports/[id]` must query by `{ id, userId }`.
- Premium report reads must also check entitlement.
- Success page must never infer entitlement from query params.

Premium entitlement scope:

- Product: `premium_report`
- Required resource binding:
  - `resourceType = "assessment"` or `"report"`
  - `resourceId = assessmentId` or report id
- This prevents one Premium payment from unlocking all reports.

## 3. Stripe Payment Flow

Checkout request for Premium report:

```json
{
  "product": "premium_report",
  "assessmentId": "assessment_id",
  "email": "user@example.com"
}
```

Checkout rules:

- User must be authenticated.
- User email must be verified, unless an explicit temporary grace policy is approved.
- Assessment must belong to current user.
- If active entitlement already exists for the same user/product/resource, do not create another checkout session.
- If an existing `created` payment/session exists for the same user/product/resource, reuse it or intentionally expire/replace it.

Stripe metadata:

- `userId`
- `product`
- `assessmentId`
- `paymentId`

Webhook success handling:

- Verify Stripe signature.
- Load `PaymentRecord` by `sessionId`.
- Confirm user/product/resource match.
- Mark payment `paid`.
- Grant scoped entitlement.
- Webhook processing must be idempotent.

Stripe refund/failure handling:

- Handle `checkout.session.expired`.
- Handle `payment_intent.payment_failed`.
- Handle `charge.refunded`.
- Handle `charge.dispute.created`.
- Future subscription events should be planned but not implemented unless approved.

Payment statuses:

- `created`
- `paid`
- `failed`
- `expired`
- `refunded`
- `disputed`

Entitlement statuses:

- `active`
- `revoked`
- `expired`

Refund and dispute events must revoke the exact scoped entitlement.

## 4. Database Changes

Entitlement extension:

- `resourceType String?`
- `resourceId String?`

Entitlement indexes:

- `userId`
- `productId`
- `status`
- `resourceType`
- `resourceId`
- compound `[userId, productId, resourceType, resourceId, status]`

PaymentRecord extension:

- `resourceType String?`
- `resourceId String?`
- optional future `metadata Json`

PaymentRecord indexes:

- `userId`
- `product`
- `status`
- `sessionId`
- `resourceId`

AIReport:

- Must distinguish free vs premium via `type` and/or `visibility`.
- Must index `userId`, `assessmentId`, `type`, `status`, `createdAt`.
- Free reports must not persist Premium-only fields.

ProductRecommendation:

- `id`
- `userId`
- `reportId`
- `productId String?`
- `category`
- `title`
- `reason`
- `score`
- `createdAt`

Rules:

- `productId` is optional for category-level advice.
- If `productId` is present, it must reference an active `Product`.
- AI must not invent purchasable products that do not exist in the catalog.

Subscription preparation:

- Product IDs should be future-compatible:
  - `premium_report`
  - future `membership_monthly`
  - future `membership_annual`
- Payment and entitlement design must support `expiresAt`.
- Do not implement subscription checkout in Sprint 1B unless separately approved.

## 5. API Design

### POST `/api/reports/generate`

Input:

```json
{
  "assessmentId": "string",
  "type": "free_health_report | premium_health_report"
}
```

Rules:

- User must be authenticated.
- Assessment must belong to user.
- Free report can be generated without entitlement.
- Premium report requires entitlement for the exact assessment/report resource.
- Premium generation must be idempotent.
- AI output must pass `ReportSchema`.
- Invalid AI JSON must not be inserted.

Idempotency:

- Key: `{ userId, assessmentId, reportType }`
- If Premium report already exists and is ready, return existing report.
- If Premium report is generating, return current status.
- Do not start duplicate paid AI generation.

### GET `/api/reports/[id]`

Rules:

- User must be authenticated.
- Query by `{ id, userId }`.
- If report is Premium, require scoped entitlement.
- User A requesting User B report returns 404.
- Missing Premium entitlement returns 402 or 403.
- Future report download/export (PDF or file) must reuse the same scoped
  entitlement check; no download path may return Premium content without it.

### POST `/api/checkout`

Rules:

- Add `premium_report`.
- Require `assessmentId`.
- Validate assessment ownership.
- Prevent duplicate payment for an already-entitled resource.
- Reuse or intentionally replace existing created checkout session.

### POST `/api/webhooks/stripe`

Rules:

- Grant entitlement only from verified Stripe webhook.
- Revoke entitlement on refund/dispute.
- Mark failed or expired sessions.
- Idempotent by `sessionId`, `paymentId`, and scoped entitlement unique key.

### IP Rate Limit Utility

Default:

- `TRUST_FORWARDED_HEADERS=false`
- Do not trust `x-forwarded-for` or `x-real-ip`.

Production trusted proxy plan:

- Identify actual deployment target, such as Vercel or Aliyun SLB.
- Configure trusted source using platform-supported client IP headers or `TRUSTED_PROXY_CIDRS`.
- Spoofed forwarded headers must not affect rate-limit identity.
- Legitimate distinct clients must not collapse into one global `"unknown"` bucket.

## 6. Route Information Architecture

`/`

- Consumer Landing.
- First commercial funnel entry.
- Explains AI health assessment, free report, Premium report, and wellness-only positioning.
- Primary CTA routes to `/{lang}/tcm-check`.
- Must not show clinical operations dashboard content to consumers.

`/[lang]/tcm-check`

- AI health assessment.
- Collects wellness signals such as sleep, diet, stress, fatigue, digestion, and body sensations.
- Submits assessment for free report generation.
- Must avoid diagnostic language.

`/[lang]/dashboard`

- User health center.
- Shows user's own assessments, reports, entitlement status, and account status.
- Not an admin, doctor, merchant, supply-chain, or first-visit landing page.

`/[lang]/report/[id]`

- Report page.
- Shows free report or Premium report based on ownership and entitlement.
- Enforces IDOR protection, Premium field isolation, and disclaimer rendering.

`/admin`

- Operations backend.
- Future internal monitoring for AI usage, report/payment support, and compliance review.
- Sprint 1B may define the route responsibility, but should not build a full admin product unless separately approved.

## 7. Existing Diagnostic Copy Remediation

Sprint 1B must remediate existing consumer-visible diagnostic-style copy before the commercial funnel is exposed.

Remove or replace consumer-visible content that implies:

- disease judgment
- diagnosis probability
- diagnostic confidence
- triage recommendation
- disease-specific routing
- treatment or prescription guidance

Known remediation area:

- Root `/` currently contains clinical command-center style content, mock patient case analysis, confidence, and triage-like recommendations. Consumer surfaces must replace this with health-management copy.

Allowed positioning:

- AI health assessment
- AI wellness report
- TCM-inspired body pattern insight
- health management suggestions
- lifestyle guidance

Disallowed positioning:

- diagnosis
- treatment
- prescription
- disease probability
- diagnostic confidence
- cure
- emergency instruction beyond "seek local emergency services"

## 8. Page Design

Landing page:

- Consumer-facing, not dashboard-like.
- Primary CTA: "Start Free Health Check".
- Explains free report and Premium report.
- Includes visible wellness disclaimer.

Free report page:

- Shows score preview, body pattern insight, and limited recommendations.
- Shows locked Premium sections:
  - detailed analysis
  - lifestyle plan
  - AI recommendations
  - follow-up plan
- CTA: "Unlock Premium Report".
- Includes visible wellness disclaimer.

Premium report page:

- Route: `/[lang]/report/[id]`.
- Requires ownership and entitlement.
- If entitlement missing, show locked state and checkout CTA.
- If report generating, show generating state.
- If ready, show full report and recommendations.
- Includes visible wellness disclaimer.

Checkout page:

- Includes visible wellness disclaimer before payment.

Success page:

- Payment confirmation and redirect only.
- It is not the authorization source.
- It should link to the Premium report after entitlement verification.

## 9. Risk Analysis

Report paywall bypass:

- Mitigate with report type gating, scoped entitlement, read-side entitlement checks, and no query-param unlocks.

Trusted IP weakness:

- Mitigate by ignoring forwarded headers by default and configuring the real production trusted IP source.

Stripe race conditions:

- User may return before webhook completes.
- Show verifying state and refresh server-side, but never bypass entitlement.

Refund/chargeback:

- Refund or dispute must revoke entitlement.
- Premium report becomes locked after entitlement revocation.

Duplicate payment:

- Checkout must detect existing active entitlement or created session for same resource.

AI cost abuse:

- Reuse existing free/Premium reports.
- Enforce token/user/IP budgets.
- Make Premium generation idempotent.

Compliance risk:

- Paid report raises regulatory exposure.
- Use wellness-only positioning and visible disclaimers everywhere.

## 10. Review Findings & Acceptance Criteria

Review status: PASS WITH CONDITIONS  
Source: Claude Code review and Hermes red-team report  
Rule: This is the single authoritative review findings section.

### P1-a: Stripe Refund / Failed Payment Closed Loop

Acceptance criteria:

- Failed payment does not grant entitlement.
- Expired checkout does not grant entitlement.
- Refunded payment revokes matching entitlement.
- Disputed charge revokes or suspends matching entitlement.
- Webhook replay is idempotent.
- Premium report access is denied after revocation.

### P1-b: Consumer Landing Entry Design

Acceptance criteria:

- `/` is defined as the consumer Landing route.
- A first-time user can understand free check to Premium report flow.
- Primary CTA starts free health assessment.
- Landing copy does not imply diagnosis, treatment, prescription, or cure.
- Existing dashboard remains available at `/[lang]/dashboard`.

### P1-c: Medical Health Management Positioning And Disclaimer

Acceptance criteria:

- Landing, assessment, free report, Premium report, checkout, and success surfaces include wellness-only framing.
- Visible disclaimer appears on free report, Premium report, and checkout.
- No Sprint 1B consumer copy claims diagnosis, treatment, prescription, cure, disease probability, or medical certainty.
- Premium recommendations are lifestyle/product-category guidance only.
- Product recommendations do not prescribe dosage or treatment.

### P1-d: Production Trusted IP Rate Limiting

Acceptance criteria:

- Spoofed `x-forwarded-for` does not bypass limits in default mode.
- Trusted forwarded headers work only when explicitly enabled.
- Target deployment client-IP source is documented before production release.
- Legitimate distinct production clients are counted separately, not all as `"unknown"`.
- Rate-limit tests cover fake forwarded headers and trusted-proxy modes.

### Premium Field Isolation

Acceptance criteria:

- Free reports do not persist Premium-only fields.
- Read-side filtering remains as defense in depth.
- Premium fields require scoped entitlement before read.

### Premium Generation Idempotency

Acceptance criteria:

- Calling Premium generation twice for same user and assessment does not create duplicate Premium reports.
- Existing `premium_ready` report is reused.
- Existing `premium_generating` status is returned instead of starting a second job.

### ProductRecommendation Product Link

Acceptance criteria:

- `ProductRecommendation` supports optional `productId`.
- If `productId` exists, it references an active `Product`.
- Category-level recommendations are allowed when no product exists.
- AI cannot invent purchasable products outside the catalog.

### Subscription Extension Preparation

Acceptance criteria:

- Entitlement/payment design leaves room for `membership_monthly` and `membership_annual`.
- `expiresAt` remains available for subscription-like access.
- Subscription webhook handling is noted but not implemented without approval.

### Duplicate Payment Protection

Acceptance criteria:

- Existing active entitlement blocks another checkout for same Premium report resource.
- Existing created checkout session is reused or deliberately replaced.
- Webhook processing is idempotent by `sessionId`, `paymentId`, and scoped entitlement key.

## 11. Proposed Implementation Order After Approval

1. Fix IP extraction and production trusted-IP policy.
2. Extend entitlement service for resource-scoped checks.
3. Add payment/entitlement/report recommendation binding fields.
4. Update report generation for free vs Premium type checks.
5. Update report read API for Premium entitlement checks and field isolation.
6. Update Stripe checkout and webhook for `premium_report`, refund, failed, expired, and dispute states.
7. Replace consumer root `/` with Landing entry.
8. Add `/[lang]/report/[id]` report page.
9. Remediate consumer-visible diagnostic-style copy.
10. Add AI recommendation persistence linked to reports and optional products.
11. Run acceptance tests.
12. Generate Sprint 1B implementation report.
