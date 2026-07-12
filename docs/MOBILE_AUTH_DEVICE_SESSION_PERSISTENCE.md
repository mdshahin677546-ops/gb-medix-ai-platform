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
result carries only ids, never a hash). `revokeFamilyOnReplay` confirms the hash
is consumed and revokes every active session in its family in ONE transaction
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

## Gates for later batches

Login/Refresh/Logout API routes, token signing keys, SecureStore, and mobile UI
remain BLOCKED and require separate, Codex-approved batches. Consumed-history
retention tuning and a scheduled `purgeExpiredConsumedTokens` job are future work.
