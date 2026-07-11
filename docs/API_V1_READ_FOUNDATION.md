# GB MEDIX AI — API v1 Read Foundation (Batch 2.1)

Versioned, read-only `/api/v1` endpoints shared by the Web app and, later, the
Mobile API client and Agent service layer. This batch is **read-only** and adds
**no** write endpoints, tokens, or schema changes.

## Endpoints

| Method | Path | Returns |
|---|---|---|
| GET | `/api/v1/me` | Safe profile of the current user (`id`, `status`, `emailVerified`) |
| GET | `/api/v1/ai-consent` | AI processing consent status for the server-configured provider |
| GET | `/api/v1/reports` | Summary list of the current user's reports (keyset paginated) |
| GET | `/api/v1/reports/:id` | A single owned report (Free / Premium / processing summary) |
| GET | `/api/v1/entitlements` | Safe entitlement summary for the current user |

## Authentication & origin

- **Web cookie session only.** Every endpoint authenticates via the existing
  `getCurrentUser()` (signed `gbmedix_session` cookie + `sessionVersion`
  revocation). No changes to the cookie format or `sessionVersion` behavior.
- **Mobile Bearer Token is BLOCKED here.** These routes do not parse
  `Authorization` headers and never trust a client-supplied `userId`. Real mobile
  auth (DeviceSession + refresh token) is a separate, later, Codex-reviewed task.
- **Same-origin only.** No CORS headers are added; cross-site credentialed access
  is not enabled in this batch.

### Two-tier authorization

- `GET /api/v1/me` uses an **auth-only** guard: a signed-in but not-yet-verified
  (`pending`) user may read their own safe status to drive the verification UI.
- `GET /api/v1/ai-consent`, `/reports`, `/reports/:id`, `/entitlements` require an
  **active, email-verified** user (`status === "active"` and `emailVerifiedAt != null`).
  A pending/unverified user receives `403 EMAIL_VERIFICATION_REQUIRED`, and no
  database / consent / entitlement dependency is touched before that gate passes.
- Guards never trust a client-supplied `status`, `emailVerified`, or `userId`, and
  never parse an `Authorization` header.

## Response shape

Success and failure use the shared envelope from `lib/api-contract/v1`:

```json
{ "ok": true, "data": { }, "requestId": "…" }
{ "ok": false, "error": { "code": "AUTH_REQUIRED", "message": "…", "requestId": "…", "retryable": false } }
```

Every response carries `X-Request-Id` (de-identified random id), `X-API-Version: 1`,
and `Cache-Control: private, no-store`. Errors never expose stack traces, provider
errors, SQL, request/response bodies, cookies, tokens, email, or health data — only
a fixed safe message per code.

## Premium & safety boundaries

- **Premium** report content is gated by the existing resource-scoped
  **Entitlement** service (`checkEntitlement`); no entitlement → `402
  ENTITLEMENT_REQUIRED`. Consent is **not** entitlement, and a client cannot
  self-declare "unlocked". Refunded/revoked entitlements are non-`active` and never
  unlock.
- **IDOR-safe**: single reports are queried by `{ id, userId }`; another user's id
  and a non-existent id return the **same** `404 RESOURCE_NOT_FOUND` (no existence
  enumeration). The route id is strictly validated (safe charset, ≤128 chars)
  **before** any query; malformed ids get `400 VALIDATION_ERROR` and never reach the DB.
- **Two-stage premium read**: a metadata-only, owner-scoped query drives the
  ownership + entitlement decision; the full premium JSON is read **only after** the
  entitlement check passes. A locked premium report never reads its content columns.
- **Bounded lists**: `/reports` and `/entitlements` are keyset-paginated (limit
  default 20 / max 50, opaque length-capped cursor); no endpoint returns unbounded
  history.
- **AI provider** for consent status is resolved server-side; the client cannot
  specify provider / consentVersion / userId.
- Production configuration and secrets are never read into DTOs or validated by
  this document.

## Compatibility

`/api/v1` is additive. Existing routes (`/api/session`, `/api/reports/**`,
`/api/ai-consent/**`) are unchanged and continue to serve the current Web pages.
