# GB MEDIX AI — DeviceSession Persistence + Transactional Store (Batch 2.2B)

Persists the Batch 2.2A DeviceSession security foundation to PostgreSQL and adds a
real transactional Prisma store. **This batch does NOT implement production
login/refresh/logout APIs, token signing, mobile SecureStore, or login UI.** The
existing Web cookie session and its `sessionVersion` semantics are unchanged.

## Schema (additive)

Two new models; no existing table/column is changed.

- **DeviceSession** — `id, userId, tokenFamilyId, status, rotationCounter,
  refreshTokenHash (unique), createdAt, lastUsedAt, idleExpiresAt,
  absoluteExpiresAt, revokedAt?, revokeReason?`, `user` relation
  (`onDelete: Cascade`), `consumedRefreshTokens` relation.
- **ConsumedRefreshToken** — `id, deviceSessionId, tokenFamilyId,
  refreshTokenHash (unique), consumedAt, expiresAt`, `deviceSession` relation
  (`onDelete: Cascade`). Only the HASH is stored — never a token, email, phone,
  Authorization header, cookie, pepper, device fingerprint, or health data.
- **User** gains only a `deviceSessions` relation field.

### Database constraints (the DB truly restricts values)

- `status IN ('active','revoked','expired','compromised')`
- `rotationCounter >= 0 AND rotationCounter <= 2147483646` (int4-safe; next
  increment still fits)
- `refreshTokenHash ~ '^[0-9a-f]{64}$'` (64-char lowercase HMAC-SHA-256 hex) — on
  both tables
- `createdAt <= lastUsedAt`, `idleExpiresAt > createdAt`,
  `absoluteExpiresAt > createdAt`, `idleExpiresAt <= absoluteExpiresAt`
- `ConsumedRefreshToken.consumedAt <= expiresAt`
- Unique on each table's `refreshTokenHash`; FKs with `ON DELETE CASCADE`.
- `DeviceSession` has a composite `UNIQUE(id, tokenFamilyId)`, and
  `ConsumedRefreshToken(deviceSessionId, tokenFamilyId)` has a composite FK to
  that pair. A consumed row can only point at the family owned by its
  `deviceSessionId`.
- The cross-table rule (`consumed.expiresAt <= owning session absoluteExpiresAt`)
  cannot be a plain CHECK; the transactional store derives `expiresAt` from the
  session's `absoluteExpiresAt`, so it is never later.

Indexes: DeviceSession(`userId`, `tokenFamilyId`, `status`, `idleExpiresAt`,
`absoluteExpiresAt`, `userId+status`); ConsumedRefreshToken(`deviceSessionId`,
`tokenFamilyId`, `expiresAt`).

## Migration

`prisma/migrations/20260712210000_add_device_session_store/migration.sql` is
additive only and applies with `prisma migrate deploy` to a fresh database
(never `prisma db push`, never a production DB). No secret or real data is in it.

## Transactional store (`PrismaDeviceSessionStore`)

- Prisma client is **injected**; the module reads no env, opens no hidden global
  connection, and logs no DATABASE_URL/token/hash/pepper/health data.
- Implements the full `DeviceSessionStore` interface plus
  `classifyRefreshTokenHash`, `revokeFamilyOnReplay`, and
  `purgeExpiredConsumedTokens`.
- **`rotateRefreshTokenAtomically`** runs a real transaction: `SELECT … FOR UPDATE`
  locks the row (single-winner), re-validates persisted state, checks
  active/idle/absolute/CAS(counter+hash), clamps the new idle deadline to the
  absolute ceiling, then — in the SAME transaction — inserts the old hash into
  `ConsumedRefreshToken` and updates the session (counter+1, new hash, idle,
  lastUsedAt). Any failure rolls the whole transaction back. Unique-constraint
  races normalize to `conflict`; any other DB error to `invalid_input`; Prisma/SQL
  text is never surfaced.
- Concurrency: two rotations on the same counter/hash yield exactly one `rotated`
  and one `conflict` (benign conflict — NOT mistaken for replay). Only a
  previously-consumed token replayed later drives the replay path.

## Replay / family revocation

`classifyRefreshTokenHash` returns `current | consumed | unknown` (a `consumed`
result carries only ids, never a hash) only after joining the consumed row to its
owning `DeviceSession` and confirming the two family ids match. A mismatched or
orphaned consumed row fails closed. `revokeFamilyOnReplay` confirms the hash is
consumed, locks the consumed row and owning session in ONE transaction, validates
the same family binding, and revokes by the owning session's family id
(TOCTOU-free), returning a minimal audit-ready result
(`mobile_refresh_replay_detected`). Consumed history is retained until at least
the owning session's absolute expiry so a replayed old token never degrades to
`unknown`; `purgeExpiredConsumedTokens` removes only rows past that retention.

## DateTime / epoch mapping & counter bound

A single mapping converts epoch SECONDS ↔ Prisma `DateTime`. It fails closed on
non-whole-second or non-finite values (no implicit floor), and every loaded row is
re-validated by `hasValidSessionInvariants`. Because the DB column is int4,
`DB_MAX_ROTATION_COUNTER = 2147483646` keeps the JS bound and the DB capacity
explicitly in sync; the store rejects rotation before overflow.

## Review hardening (Codex findings)

- **Token family is globally unique.** `DeviceSession.tokenFamilyId` has a unique
  index — one token family belongs to exactly ONE device session (the family holds
  that session's successive rotated tokens). Device groups are NOT modeled by
  sharing a family across sessions. `revokeTokenFamily` / replay revocation
  therefore affect only the one owning session, never another user's.
- **`revokeReason` is validated at runtime and in the DB.** A single authoritative
  `isRevokeReason` guard gates every write (both stores); the DB adds a CHECK, and
  an active session must carry no `revokedAt` / `revokeReason`. Invalid input fails
  closed with a fixed, value-free error.
- **Cross-table hash exclusivity.** A refresh-token hash may exist in AT MOST one
  of {current sessions, consumed history}. createSession and rotate take a
  PostgreSQL transaction advisory lock derived from the hash and check both tables
  before writing, so a consumed hash can never become current again. `classify`
  checks consumed first and fails closed on any cross-table duplicate — a "current"
  hit can never mask a replay.
- **Consumed family binding.** Runtime replay handling never trusts
  `ConsumedRefreshToken.tokenFamilyId` by itself. It validates the consumed row
  against the owning `DeviceSession` and uses the owner's family as the
  revocation authority. The composite FK rejects mismatched inserts at the
  database layer.
- **Persisted rows are validated on read.** `findById`, `findByRefreshTokenHash`,
  and `classifyRefreshTokenHash` re-validate every loaded row (hash format +
  structural invariants + reason allowlist); a corrupt row (e.g. a non-whole-second
  timestamp) fails closed rather than being returned as a valid current session.

### Integration test credentials

The integration suite requires EXPLICIT isolated test credentials
(`TEST_PG_PASSWORD` / `TEST_PG_*`, or `TEST_DATABASE_ADMIN_URL`). There is NO
hardcoded password/URL fallback; missing config fails the suite (never a silent
skip, never a shared/dev/staging/production database). DATABASE_URL and passwords
are never logged.

## Gates for later batches

Login/Refresh/Logout API routes, token signing keys, SecureStore, and mobile UI
remain BLOCKED and require separate, Codex-approved batches. Consumed-history
retention tuning and a scheduled `purgeExpiredConsumedTokens` job are future work.
