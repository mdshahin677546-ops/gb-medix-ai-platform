# Mobile Auth API Routes — Pure Layer (Batch 2.2C)

Wires the Batch 2.2A/2.2B mobile-auth foundation into real `/api/v1` routes for
**refresh / logout / logout-all**, plus an HMAC access-token signer/verifier, an
env/config boundary, and a mobile Bearer guard. This batch adds **no** password
login, OAuth, SecureStore client, production key/pepper, Prisma schema change,
payment/provider, or deploy.

## Endpoints

| Method + path | Auth | Body | Success |
|---|---|---|---|
| `POST /api/v1/mobile/auth/refresh` | refresh token (in body) | `{ refreshToken }` | new access + refresh token (rotated) |
| `POST /api/v1/mobile/auth/logout` | refresh token (in body) | `{ refreshToken }` | idempotent ack |
| `POST /api/v1/mobile/auth/logout-all` | **Bearer access token** | `{}` (strict) | ack |

All responses carry `Cache-Control: private, no-store`, `X-API-Version: 1`, and a
de-identified `X-Request-Id`; failures use the fixed shared error contract
(`AUTH_REQUIRED` / `TOKEN_EXPIRED` / `VALIDATION_ERROR` / `CONFLICT` /
`INTERNAL_ERROR`) — never a raw exception, SQL, or provider error.

## Access-token signer (`lib/mobile-auth/v1/access-token-sign.ts`)
- HMAC-SHA-256 over `base64url(claimsJSON)`; token = `<payload>.<sig>`.
- Signing key is **injected** (never hardcoded / never read from `.env` here).
- Payload is exactly the 9-field `accessTokenClaimsSchema` — the strict schema
  rejects email/phone/health/payment/report/provider fields before signing.
- Verify checks the signature **first** (constant-time `timingSafeEqual`), then
  delegates the claim set to the existing pure `verifyAccessTokenClaims`
  (`typ`/`iss`/`aud`/`iat`/`exp`/TTL fail closed). No token/sig/key/claim value is
  echoed in any error.

## Config boundary (`lib/mobile-auth/v1/config.ts`)
- Reads signing key, refresh pepper, issuer, audience, TTLs, clock skew from the
  injected env map (default `process.env`).
- Missing / too-short / out-of-range values **fail closed** with a value-free
  `MobileAuthConfigError` (names the setting, never its value).
- Loaded **lazily per request** in `lib/api-v1/mobile-session.ts`, so `next build`
  never needs the secrets and a mis-set secret is a safe `INTERNAL_ERROR`.

## Handlers (`lib/api-v1/handlers/mobile-auth-*.ts`)
Pure, dependency-injected factories (mirrors the existing `/api/v1` handler
pattern); the store operations are injected so they run under `node:test` with a
fake / the real `InMemoryDeviceSessionStore` and NO database.
- **refresh**: hash the presented token → replay check (consumed → revoke family,
  reject) → classify current → server-side eligibility → `rotateRefreshTokenAtomically`
  (single-winner CAS) → issue a fresh access token + **new** refresh token. The new
  refresh plaintext is returned **exactly once** and never stored/logged/audited.
- **logout**: revoke the owning session by refresh-token hash; idempotent and
  non-revealing (identical response whether or not a session existed).
- **logout-all**: **Bearer-authenticated**; the actor is the verified token's
  `sub` (server-side sessionVersion re-validated); the strict-empty body rejects a
  client-supplied `userId` — cross-user logout is impossible.

## Bearer boundary
`verifyBearerAccessToken` reuses the strict `parseBearerAuthorization`
(rejects cookie/query/basic/multiple/comma/CRLF/control) then verifies the
signature + claims. This is **entirely separate** from the Web cookie session; no
handler here reads `getCurrentUser` or a cookie, and the cookie guards never parse
a Bearer token.

## Audit
`buildMobileAuthAuditEvent` (strict allowlist) is the only audit path; token /
hash / Authorization / email / pepper / health / payment fields can never be
attached (the strict schema throws). Reasons are a fixed enum.

## Validation & database
Pure layer is fully covered by `tests/mobile-auth-routes.test.mjs` (real signer /
config / handlers / store, no DB). Prisma-backed route **integration** (real
rotation/replay/logout on a database) requires an **isolated non-admin
LOCAL_EPHEMERAL PostgreSQL**; when that environment is unavailable this batch does
not fabricate a pass — the DB-gated suites are reported as blocked, not green.

## Out of scope (not in this batch)
Password login, OAuth, SecureStore mobile client, production signing key / refresh
pepper / secrets, Prisma schema or migration changes, payment / Stripe /
entitlement, real AI provider calls, and any deploy / Vercel / env change.
