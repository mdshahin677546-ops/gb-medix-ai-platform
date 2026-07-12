# GB MEDIX AI — Mobile Auth / DeviceSession Security Foundation (Batch 2.2A)

Security contracts, pure policy functions, a Store interface, and a reference
in-memory store for the future mobile authentication system. **This batch builds
only the safety foundation — it does not implement a production auth system.**

## In this batch

- Public contract (`lib/api-contract/v1/mobile-auth.ts`): device/token id types,
  strict access-token claims schema, refresh/logout request & result schemas.
- Refresh token utilities: `generateRefreshToken`, `hashRefreshToken`,
  `verifyRefreshTokenHash` (HMAC-SHA-256, injected pepper, timing-safe compare).
- Strict `parseBearerAuthorization`.
- `DeviceSession` model, statuses, and time-boundary helpers.
- `evaluateMobileUserEligibility` (server-fact + sessionVersion check).
- `evaluateRefreshAttempt` + `classifyRefreshLookup` (rotation / replay policy).
- `DeviceSessionStore` interface + `InMemoryDeviceSessionStore` (CAS reference).
- Device-metadata privacy allowlist (`sanitizeDeviceMetadata`).
- Strict security audit event schema (`buildMobileAuthAuditEvent`).
- Real-implementation tests (`tests/mobile-auth-v1.test.mjs`).

## NOT in this batch (BLOCKED — later, Codex-approved batches only)

Prisma `DeviceSession` model & migration; real login / refresh / logout API
routes; production access-token signing key; mobile SecureStore; app login UI;
email-verification deep link; production rate limiting; device-management page;
real DB transactions / row locks.

## Authentication model

- **Web cookie session is unchanged.** Mobile does **not** reuse the Web cookie;
  it will use a Bearer access token + a rotating refresh token.
- **Access token** — short-lived, carries only the strict claim allowlist
  (`sub, sid, sv, jti, typ, iss, aud, iat, exp`). It never carries email/phone/
  health/payment/consent/entitlement/fingerprint/refresh-token. `sv` is a
  sessionVersion **snapshot**; the server always revalidates it against the DB.
- **Refresh token** — `gbrt_v1_<base64url(≥32 random bytes)>`. Only its HMAC hash
  is ever persisted; the plaintext is returned exactly once at creation/rotation.

## Rotation, replay, and global logout

- **Single-use refresh + rotation**: every successful refresh rotates the token;
  the old hash becomes "consumed".
- **Replay detection**: presenting a consumed token classifies as `consumed`
  and triggers **token-family revocation** (`revoke_family` / `replay_detected`),
  which must be recorded as a security audit event.
- **sessionVersion global logout**: bumping the DB `sessionVersion` invalidates
  all mobile access tokens for the user (eligibility `session_version_mismatch`).
- **Concurrent rotation safety**: at most one concurrent rotation may win; two
  new simultaneously-valid refresh tokens must never exist.

## Fail-closed session state (persisted data may be corrupt)

Type-system `number` is NOT trusted at runtime — a loaded/stored session may be
corrupt. A single authoritative validator (`hasValidSessionInvariants`) enforces
the numeric/relational invariants (all of createdAt/lastUsedAt/idle/absolute are
safe non-negative integers; rotationCounter is a safe non-negative integer;
createdAt ≤ lastUsedAt; idle > createdAt; absolute > createdAt; idle ≤ absolute)
and is used at every boundary:

- `createSession` validates ALL inputs before any write; invalid input throws a
  fixed, value-free `DeviceSessionInvariantError` (no partial session is stored).
- `rotateRefreshTokenAtomically` re-validates the persisted session and request
  inputs; a corrupt/invalid state (NaN/Infinity/non-integer/out-of-range time or
  counter, idle > absolute, unknown status, `now` running backwards) returns
  `invalid_input` and mutates nothing. A legitimately-reached deadline returns
  `expired`; the two are never conflated.
- The time helpers fail closed: `isSessionTimeExpired`/`isSessionUsable` treat
  invalid input as unusable, and `nextIdleExpiry` returns `null` (never NaN/Infinity)
  for invalid input. A refreshed idle deadline is always clamped to the absolute
  ceiling, which a refresh can never extend.

The optional `rotationCounter` on `createSession` models rehydrating a stored
session. In production it may ONLY come from a trusted database record, it is
re-validated here regardless, and a corrupt / non-finite value fails closed.

## Store production requirement (gate)

`rotateRefreshTokenAtomically` MUST be a genuine atomic operation in production:
a DB transaction with a conditional/CAS update
(`WHERE rotationCounter = expected AND refreshTokenHash = expected`), a row lock,
or a unique-constraint / fencing mechanism. A plain read-then-write is forbidden.
The in-memory reference store models this CAS; **no Prisma store ships here.**

## Device metadata privacy boundary

Only `platform`, `appVersion`, `deviceLabel`, `locale` are allowed. Advertising
ids, IMEI, Android ID, IDFA, MAC, serials, contacts, precise location, full
User-Agent, persistent fingerprints, patient data, email, and phone are rejected
by the strict schema — there is no arbitrary-object escape hatch.

## Audit data prohibitions

Audit events are a strict allowlist. Access tokens, refresh tokens, refresh-token
hashes, Authorization headers, cookies, the pepper, health data, email, phone,
and payment info can never be attached — the schema rejects them structurally and
`buildMobileAuthAuditEvent` throws rather than emit an unsafe record.

## Gates for later batches

Wiring Prisma / API routes / SecureStore requires a separate, Codex-approved
batch that: adds the `DeviceSession` model + migration under review; implements
`rotateRefreshTokenAtomically` with real transactional CAS; injects the pepper and
signing key from secure configuration (never `.env` in code, never hardcoded);
keeps the Web cookie session untouched; and preserves every invariant above.
