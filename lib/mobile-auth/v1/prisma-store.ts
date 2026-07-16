import {
  hasValidSessionInvariants,
  isSessionTimeExpired,
  isSafeTimestamp,
  isSafeCounter,
  isRevokeReason,
  DB_MAX_ROTATION_COUNTER,
  type DeviceSession,
  type DeviceSessionStatus,
  type RevokeReason
} from "./device-session";
import {
  DeviceSessionInvariantError,
  type DeviceSessionStore,
  type CreateSessionInput,
  type RotateInput,
  type RotateResult
} from "./store";
import type { MobileAuthAuditEvent } from "./audit";
import {
  completeMobileAuthIdempotency,
  insertMobileAuthAudit
} from "./prisma-security-controls";

/**
 * Transactional PostgreSQL-backed DeviceSession store (Batch 2.2B).
 *
 * The Prisma client is INJECTED (constructor) — this module reads no env, opens no
 * hidden global connection, and never logs DATABASE_URL / tokens / hashes / pepper
 * / health data. Timestamps cross the DB boundary through ONE epoch<->DateTime
 * mapping that fails closed on non-whole-second / non-finite values, and every
 * loaded row is re-validated by hasValidSessionInvariants before any success path.
 * rotateRefreshTokenAtomically uses a real transaction with SELECT ... FOR UPDATE
 * (single-winner CAS) and writes the consumed old hash + the session update in the
 * SAME transaction.
 */

const HEX64 = /^[0-9a-f]{64}$/;

/** epoch seconds -> Date. Callers only pass validated safe integers. */
function fromEpochSeconds(seconds: number): Date {
  return new Date(seconds * 1000);
}

/** Date -> epoch seconds; null if not a whole-second, finite value (no implicit floor). */
function toEpochSeconds(value: unknown): number | null {
  if (!(value instanceof Date)) return null;
  const ms = value.getTime();
  if (!Number.isFinite(ms)) return null;
  if (ms % 1000 !== 0) return null;
  const seconds = ms / 1000;
  return isSafeTimestamp(seconds) ? seconds : null;
}

type DeviceSessionRow = {
  id: string;
  userId: string;
  tokenFamilyId: string;
  status: string;
  rotationCounter: number;
  refreshTokenHash: string;
  createdAt: Date;
  lastUsedAt: Date;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
  revokedAt: Date | null;
  revokeReason: string | null;
};

type ConsumedOwnerBindingRow = {
  deviceSessionId: string;
  tokenFamilyId: string;
  ownerTokenFamilyId: string | null;
};

type TransactionalAuditEvent = MobileAuthAuditEvent & {
  outcome: NonNullable<MobileAuthAuditEvent["outcome"]>;
};

/**
 * Map a DB row to the domain type. Any unmappable field becomes NaN / raw value so
 * hasValidSessionInvariants rejects the record (fail closed) rather than silently
 * coercing corrupt data.
 */
function mapRow(row: DeviceSessionRow): DeviceSession {
  return {
    id: String(row.id),
    userId: String(row.userId),
    tokenFamilyId: String(row.tokenFamilyId),
    status: row.status as DeviceSessionStatus,
    rotationCounter: typeof row.rotationCounter === "number" ? row.rotationCounter : NaN,
    refreshTokenHash: String(row.refreshTokenHash),
    createdAt: toEpochSeconds(row.createdAt) ?? NaN,
    lastUsedAt: toEpochSeconds(row.lastUsedAt) ?? NaN,
    idleExpiresAt: toEpochSeconds(row.idleExpiresAt) ?? NaN,
    absoluteExpiresAt: toEpochSeconds(row.absoluteExpiresAt) ?? NaN,
    revokedAt: row.revokedAt == null ? null : (toEpochSeconds(row.revokedAt) ?? NaN),
    revokeReason: (row.revokeReason as RevokeReason | null) ?? null
  };
}

function assertConsumedOwnerBinding(row: ConsumedOwnerBindingRow): { deviceSessionId: string; tokenFamilyId: string } {
  const ownerTokenFamilyId = row.ownerTokenFamilyId == null ? null : String(row.ownerTokenFamilyId);
  const consumedTokenFamilyId = String(row.tokenFamilyId);
  if (!ownerTokenFamilyId || ownerTokenFamilyId !== consumedTokenFamilyId) {
    throw new DeviceSessionInvariantError();
  }
  return {
    deviceSessionId: String(row.deviceSessionId),
    tokenFamilyId: ownerTokenFamilyId
  };
}

// ---- Injected Prisma surface (structural; a real PrismaClient satisfies it) ----
type Tx = {
  $queryRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;
  deviceSession: {
    create: (args: { data: Record<string, unknown> }) => Promise<DeviceSessionRow>;
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<DeviceSessionRow>;
  };
  consumedRefreshToken: { create: (args: { data: Record<string, unknown> }) => Promise<unknown> };
};
export type MobileAuthPrisma = {
  $queryRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;
  $transaction: <T>(fn: (tx: Tx) => Promise<T>, options?: { maxWait?: number; timeout?: number }) => Promise<T>;
  deviceSession: {
    findUnique: (args: { where: Record<string, unknown> }) => Promise<DeviceSessionRow | null>;
    create: (args: { data: Record<string, unknown> }) => Promise<DeviceSessionRow>;
    updateMany: (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => Promise<{ count: number }>;
  };
  consumedRefreshToken: {
    findUnique: (args: { where: Record<string, unknown> }) => Promise<{ tokenFamilyId: string; deviceSessionId: string } | null>;
    deleteMany: (args: { where: Record<string, unknown> }) => Promise<{ count: number }>;
  };
};

const ROTATION_TRANSACTION_OPTIONS = {
  // The supported contract explicitly exercises 50 concurrent refresh attempts.
  // NOWAIT row locking below still converts real CAS races to immediate conflict;
  // this bounded window only prevents Prisma pool acquisition from failing before
  // workers can reach that fixed conflict path during full-suite DB contention.
  maxWait: 10_000,
  timeout: 10_000
};

export type RefreshTokenClassification =
  | { kind: "current"; session: DeviceSession }
  | { kind: "consumed"; tokenFamilyId: string; deviceSessionId: string }
  | { kind: "unknown" };

export type ReplayRevocationResult =
  | { replay: true; tokenFamilyId: string; revokedCount: number; audit: "mobile_refresh_replay_detected" }
  | { replay: false; revokedCount: 0; audit: null };

/** True for a Prisma unique-constraint violation (safe to normalize to conflict). */
function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { code?: unknown }).code === "P2002");
}

/** True when PostgreSQL refuses NOWAIT row acquisition; safe to normalize to conflict. */
function isLockUnavailable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; meta?: { code?: unknown; message?: unknown }; message?: unknown };
  return (
    candidate.code === "55P03" ||
    candidate.meta?.code === "55P03" ||
    (typeof candidate.meta?.message === "string" && candidate.meta.message.includes("55P03")) ||
    (typeof candidate.message === "string" && candidate.message.includes("55P03")) ||
    (typeof candidate.message === "string" && candidate.message.includes("could not obtain lock"))
  );
}

/**
 * A loaded row is only trusted after full validation: 64-hex hash + all structural
 * invariants (times, counter, status, relations, revokeReason allowlist,
 * active-implies-no-revocation). A corrupt row fails closed (fixed error, no leak).
 */
function assertValidRow(session: DeviceSession): DeviceSession {
  if (!HEX64.test(session.refreshTokenHash) || !hasValidSessionInvariants(session)) {
    throw new DeviceSessionInvariantError();
  }
  return session;
}

/** Batch 2.2E — server-computed inputs for an email-verification -> session exchange. */
export type IssueSessionInput = {
  verificationToken: string;
  sessionId: string;
  tokenFamilyId: string;
  refreshTokenHash: string;
  now: number;
  idleExpiresAt: number;
  absoluteExpiresAt: number;
};

export type IssueSessionResult =
  | { status: "issued"; session: DeviceSession; userId: string; sessionVersion: number }
  /** Missing / expired / already-consumed verification token — a coarse auth failure. */
  | { status: "invalid_token" };

export class PrismaDeviceSessionStore implements DeviceSessionStore {
  constructor(private readonly prisma: MobileAuthPrisma) {}

  async findById(id: string): Promise<DeviceSession | null> {
    const row = await this.prisma.deviceSession.findUnique({ where: { id } });
    return row ? assertValidRow(mapRow(row)) : null;
  }

  async findByRefreshTokenHash(refreshTokenHash: string): Promise<DeviceSession | null> {
    const row = await this.prisma.deviceSession.findUnique({ where: { refreshTokenHash } });
    return row ? assertValidRow(mapRow(row)) : null;
  }

  async createSession(input: CreateSessionInput): Promise<DeviceSession> {
    const startCounter = input.rotationCounter ?? 0;
    // Validate everything BEFORE any DB write (the DB CHECKs are a backstop, not
    // the first line of defense). Invalid input -> fixed, value-free error.
    if (
      !HEX64.test(input.refreshTokenHash) ||
      !isSafeTimestamp(input.createdAt) ||
      !isSafeTimestamp(input.idleExpiresAt) ||
      !isSafeTimestamp(input.absoluteExpiresAt) ||
      !isSafeCounter(startCounter) ||
      startCounter > DB_MAX_ROTATION_COUNTER ||
      input.idleExpiresAt <= input.createdAt ||
      input.absoluteExpiresAt <= input.createdAt ||
      input.idleExpiresAt > input.absoluteExpiresAt
    ) {
      throw new DeviceSessionInvariantError();
    }
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        // Serialize on the hash so a create can never race a rotation onto the
        // same hash; then confirm the hash is unused in BOTH tables before insert.
        await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${input.refreshTokenHash}, 0::bigint))) _l`;
        const inCurrent = (await tx.$queryRaw`SELECT 1 FROM "DeviceSession" WHERE "refreshTokenHash" = ${input.refreshTokenHash} LIMIT 1`) as unknown[];
        const inConsumed = (await tx.$queryRaw`SELECT 1 FROM "ConsumedRefreshToken" WHERE "refreshTokenHash" = ${input.refreshTokenHash} LIMIT 1`) as unknown[];
        if (inCurrent.length > 0 || inConsumed.length > 0) throw new DeviceSessionInvariantError();
        return tx.deviceSession.create({
          data: {
            id: input.id,
            userId: input.userId,
            tokenFamilyId: input.tokenFamilyId,
            status: "active",
            rotationCounter: startCounter,
            refreshTokenHash: input.refreshTokenHash,
            createdAt: fromEpochSeconds(input.createdAt),
            lastUsedAt: fromEpochSeconds(input.createdAt),
            idleExpiresAt: fromEpochSeconds(input.idleExpiresAt),
            absoluteExpiresAt: fromEpochSeconds(input.absoluteExpiresAt)
          }
        });
      });
      return mapRow(row);
    } catch {
      // Duplicate id / hash / family, FK miss, or a CHECK backstop — never leak DB detail.
      throw new DeviceSessionInvariantError();
    }
  }

  async rotateRefreshTokenAtomically(input: RotateInput): Promise<RotateResult> {
    // 1. Request-input validation (fail closed, before touching the DB).
    if (!isSafeTimestamp(input.now)) return { status: "invalid_input" };
    if (!Number.isSafeInteger(input.newIdleExpiresAt)) return { status: "invalid_input" };
    if (!isSafeCounter(input.expectedRotationCounter)) return { status: "invalid_input" };
    if (!HEX64.test(input.newRefreshTokenHash)) return { status: "invalid_input" };

    try {
      return await this.prisma.$transaction(async (tx) => {
        // 2. Lock the row (single-winner: a concurrent rotation blocks here until
        //    this tx commits, then re-reads the updated row -> CAS mismatch).
        const rows = (await tx.$queryRaw`
          SELECT "id", "userId", "tokenFamilyId", "status", "rotationCounter",
                 "refreshTokenHash", "createdAt", "lastUsedAt", "idleExpiresAt",
                 "absoluteExpiresAt", "revokedAt", "revokeReason"
          FROM "DeviceSession" WHERE "id" = ${input.sessionId} FOR UPDATE NOWAIT
        `) as DeviceSessionRow[];
        const row = rows[0];
        if (!row) return { status: "not_found" };

        const s = mapRow(row);
        // 3. Re-validate persisted state; corrupt data fails closed.
        if (!hasValidSessionInvariants(s)) return { status: "invalid_input" };
        if (s.status !== "active") return { status: "not_active" };
        if (input.now < s.lastUsedAt) return { status: "invalid_input" };
        if (isSessionTimeExpired(s, input.now)) return { status: "expired" };
        // 4. CAS on counter + current hash.
        if (
          s.rotationCounter !== input.expectedRotationCounter ||
          s.refreshTokenHash !== input.expectedCurrentRefreshTokenHash
        ) {
          return { status: "conflict" };
        }
        if (s.rotationCounter >= DB_MAX_ROTATION_COUNTER) return { status: "invalid_input" };
        if (input.newIdleExpiresAt <= input.now) return { status: "invalid_input" };
        // 5. New idle deadline can never pass the absolute ceiling.
        const newIdle = Math.min(input.newIdleExpiresAt, s.absoluteExpiresAt);
        if (newIdle <= input.now) return { status: "invalid_input" };

        // 5b. Serialize on the NEW hash and reject if it already exists as a
        //     current or consumed hash anywhere (global exclusivity; a consumed
        //     hash can never become current again).
        await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${input.newRefreshTokenHash}, 0::bigint))) _l`;
        const newInCurrent = (await tx.$queryRaw`SELECT 1 FROM "DeviceSession" WHERE "refreshTokenHash" = ${input.newRefreshTokenHash} LIMIT 1`) as unknown[];
        const newInConsumed = (await tx.$queryRaw`SELECT 1 FROM "ConsumedRefreshToken" WHERE "refreshTokenHash" = ${input.newRefreshTokenHash} LIMIT 1`) as unknown[];
        if (newInCurrent.length > 0 || newInConsumed.length > 0) return { status: "conflict" };

        // 6. Same transaction: persist the old hash to consumed history, then
        //    update the session. Consumed expiresAt is the session's absolute
        //    expiry (never later), keeping replay detection valid until then.
        await tx.consumedRefreshToken.create({
          data: {
            deviceSessionId: s.id,
            tokenFamilyId: s.tokenFamilyId,
            refreshTokenHash: s.refreshTokenHash,
            consumedAt: fromEpochSeconds(input.now),
            expiresAt: fromEpochSeconds(s.absoluteExpiresAt)
          }
        });
        const updated = await tx.deviceSession.update({
          where: { id: s.id },
          data: {
            rotationCounter: s.rotationCounter + 1,
            refreshTokenHash: input.newRefreshTokenHash,
            idleExpiresAt: fromEpochSeconds(newIdle),
            lastUsedAt: fromEpochSeconds(input.now)
          }
        });
        return { status: "rotated", session: mapRow(updated) };
      }, ROTATION_TRANSACTION_OPTIONS);
    } catch (error) {
      // Unique-constraint and busy-row races -> conflict; any other DB error -> invalid_input.
      // Never surface Prisma/SQL text upward.
      return { status: isUniqueViolation(error) || isLockUnavailable(error) ? "conflict" : "invalid_input" };
    }
  }

  async rotateRefreshTokenAtomicallyWithAudit(
    input: RotateInput,
    audit: TransactionalAuditEvent,
    idempotencyRecordId?: string
  ): Promise<RotateResult> {
    if (!isSafeTimestamp(input.now)) return { status: "invalid_input" };
    if (!Number.isSafeInteger(input.newIdleExpiresAt)) return { status: "invalid_input" };
    if (!isSafeCounter(input.expectedRotationCounter)) return { status: "invalid_input" };
    if (!HEX64.test(input.newRefreshTokenHash)) return { status: "invalid_input" };

    try {
      return await this.prisma.$transaction(async (tx) => {
        const rows = (await tx.$queryRaw`
          SELECT "id", "userId", "tokenFamilyId", "status", "rotationCounter",
                 "refreshTokenHash", "createdAt", "lastUsedAt", "idleExpiresAt",
                 "absoluteExpiresAt", "revokedAt", "revokeReason"
          FROM "DeviceSession" WHERE "id" = ${input.sessionId} FOR UPDATE NOWAIT
        `) as DeviceSessionRow[];
        const row = rows[0];
        if (!row) return { status: "not_found" };

        const s = mapRow(row);
        if (!hasValidSessionInvariants(s)) return { status: "invalid_input" };
        if (s.status !== "active") return { status: "not_active" };
        if (input.now < s.lastUsedAt) return { status: "invalid_input" };
        if (isSessionTimeExpired(s, input.now)) return { status: "expired" };
        if (
          s.rotationCounter !== input.expectedRotationCounter ||
          s.refreshTokenHash !== input.expectedCurrentRefreshTokenHash
        ) {
          return { status: "conflict" };
        }
        if (s.rotationCounter >= DB_MAX_ROTATION_COUNTER) return { status: "invalid_input" };
        if (input.newIdleExpiresAt <= input.now) return { status: "invalid_input" };
        const newIdle = Math.min(input.newIdleExpiresAt, s.absoluteExpiresAt);
        if (newIdle <= input.now) return { status: "invalid_input" };

        await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${input.newRefreshTokenHash}, 0::bigint))) _l`;
        const newInCurrent = (await tx.$queryRaw`SELECT 1 FROM "DeviceSession" WHERE "refreshTokenHash" = ${input.newRefreshTokenHash} LIMIT 1`) as unknown[];
        const newInConsumed = (await tx.$queryRaw`SELECT 1 FROM "ConsumedRefreshToken" WHERE "refreshTokenHash" = ${input.newRefreshTokenHash} LIMIT 1`) as unknown[];
        if (newInCurrent.length > 0 || newInConsumed.length > 0) return { status: "conflict" };

        await tx.consumedRefreshToken.create({
          data: {
            deviceSessionId: s.id,
            tokenFamilyId: s.tokenFamilyId,
            refreshTokenHash: s.refreshTokenHash,
            consumedAt: fromEpochSeconds(input.now),
            expiresAt: fromEpochSeconds(s.absoluteExpiresAt)
          }
        });
        const updated = await tx.deviceSession.update({
          where: { id: s.id },
          data: {
            rotationCounter: s.rotationCounter + 1,
            refreshTokenHash: input.newRefreshTokenHash,
            idleExpiresAt: fromEpochSeconds(newIdle),
            lastUsedAt: fromEpochSeconds(input.now)
          }
        });
        await insertMobileAuthAudit(tx, audit);
        if (idempotencyRecordId) await completeMobileAuthIdempotency(tx, idempotencyRecordId, input.now);
        return { status: "rotated", session: mapRow(updated) };
      }, ROTATION_TRANSACTION_OPTIONS);
    } catch (error) {
      return { status: isUniqueViolation(error) || isLockUnavailable(error) ? "conflict" : "invalid_input" };
    }
  }

  async revokeSession(id: string, reason: RevokeReason, now: number): Promise<void> {
    if (!isRevokeReason(reason) || !isSafeTimestamp(now)) throw new DeviceSessionInvariantError();
    await this.prisma.deviceSession.updateMany({
      where: { id, status: { notIn: ["revoked", "compromised"] } },
      data: { status: "revoked", revokedAt: fromEpochSeconds(now), revokeReason: reason }
    });
  }

  async revokeSessionWithAudit(
    id: string,
    reason: RevokeReason,
    now: number,
    audit: TransactionalAuditEvent,
    idempotencyRecordId?: string
  ): Promise<void> {
    if (!isRevokeReason(reason) || !isSafeTimestamp(now)) throw new DeviceSessionInvariantError();
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        UPDATE "DeviceSession"
        SET "status" = 'revoked', "revokedAt" = ${fromEpochSeconds(now)}, "revokeReason" = ${reason}
        WHERE "id" = ${id} AND "status" NOT IN ('revoked', 'compromised')
        RETURNING "id"
      `;
      await insertMobileAuthAudit(tx, audit);
      if (idempotencyRecordId) await completeMobileAuthIdempotency(tx, idempotencyRecordId, now);
    });
  }

  async revokeTokenFamily(tokenFamilyId: string, reason: RevokeReason, now: number): Promise<number> {
    if (!isRevokeReason(reason) || !isSafeTimestamp(now)) throw new DeviceSessionInvariantError();
    const { count } = await this.prisma.deviceSession.updateMany({
      where: { tokenFamilyId, status: "active" },
      data: { status: "revoked", revokedAt: fromEpochSeconds(now), revokeReason: reason }
    });
    return count;
  }

  async revokeAllUserSessions(userId: string, reason: RevokeReason, now: number): Promise<number> {
    if (!isRevokeReason(reason) || !isSafeTimestamp(now)) throw new DeviceSessionInvariantError();
    const { count } = await this.prisma.deviceSession.updateMany({
      where: { userId, status: "active" },
      data: { status: "revoked", revokedAt: fromEpochSeconds(now), revokeReason: reason }
    });
    return count;
  }

  async revokeAllUserSessionsWithAudit(
    userId: string,
    reason: RevokeReason,
    now: number,
    audit: TransactionalAuditEvent,
    idempotencyRecordId?: string
  ): Promise<number> {
    if (!isRevokeReason(reason) || !isSafeTimestamp(now)) throw new DeviceSessionInvariantError();
    return this.prisma.$transaction(async (tx) => {
      const updated = (await tx.$queryRaw`
        UPDATE "DeviceSession"
        SET "status" = 'revoked', "revokedAt" = ${fromEpochSeconds(now)}, "revokeReason" = ${reason}
        WHERE "userId" = ${userId} AND "status" = 'active'
        RETURNING "id"
      `) as Array<{ id: string }>;
      await insertMobileAuthAudit(tx, audit);
      if (idempotencyRecordId) await completeMobileAuthIdempotency(tx, idempotencyRecordId, now);
      return updated.length;
    });
  }

  async markCompromised(id: string, now: number): Promise<void> {
    if (!isSafeTimestamp(now)) throw new DeviceSessionInvariantError();
    await this.prisma.deviceSession.updateMany({
      where: { id },
      data: { status: "compromised", revokedAt: fromEpochSeconds(now), revokeReason: "compromised" }
    });
  }

  /**
   * Classify a presented refresh-token hash as current / consumed / unknown. A
   * "consumed" result carries only ids (never a hash) for the replay path/audit.
   */
  async classifyRefreshTokenHash(refreshTokenHash: string): Promise<RefreshTokenClassification> {
    const [current, consumedRows] = await Promise.all([
      this.prisma.deviceSession.findUnique({ where: { refreshTokenHash } }),
      this.prisma.$queryRaw`
        SELECT c."deviceSessionId", c."tokenFamilyId", s."tokenFamilyId" AS "ownerTokenFamilyId"
        FROM "ConsumedRefreshToken" c
        LEFT JOIN "DeviceSession" s ON s."id" = c."deviceSessionId"
        WHERE c."refreshTokenHash" = ${refreshTokenHash}
        LIMIT 1
      `
    ]);
    const consumedRow = (consumedRows as ConsumedOwnerBindingRow[])[0];
    // Cross-table duplication is corruption — fail closed, never let a "current"
    // hit mask a replay.
    if (current && consumedRow) throw new DeviceSessionInvariantError();
    // Consumed takes priority (replay signal). Only ids are returned, never a hash.
    if (consumedRow) {
      const consumed = assertConsumedOwnerBinding(consumedRow);
      return { kind: "consumed", tokenFamilyId: consumed.tokenFamilyId, deviceSessionId: consumed.deviceSessionId };
    }
    if (current) return { kind: "current", session: assertValidRow(mapRow(current)) };
    return { kind: "unknown" };
  }

  /**
   * TOCTOU-free replay handling: in ONE transaction, confirm the hash is a
   * consumed token and, if so, revoke every active session in its family. Returns
   * a minimal, audit-ready result (no token/hash echoed). A hash that is NOT a
   * consumed token is a no-op (benign conflicts are never mistaken for replay).
   */
  async revokeFamilyOnReplay(refreshTokenHash: string, now: number): Promise<ReplayRevocationResult> {
    if (!isSafeTimestamp(now)) throw new DeviceSessionInvariantError();
    return this.prisma.$transaction(async (tx) => {
      const rows = (await tx.$queryRaw`
        SELECT "deviceSessionId", "tokenFamilyId" FROM "ConsumedRefreshToken"
        WHERE "refreshTokenHash" = ${refreshTokenHash} LIMIT 1
        FOR UPDATE
      `) as Array<{ deviceSessionId: string; tokenFamilyId: string }>;
      const consumedRow = rows[0];
      if (!consumedRow) return { replay: false, revokedCount: 0, audit: null };
      const ownerRows = (await tx.$queryRaw`
        SELECT "tokenFamilyId" AS "ownerTokenFamilyId" FROM "DeviceSession"
        WHERE "id" = ${consumedRow.deviceSessionId} LIMIT 1
        FOR UPDATE
      `) as Array<{ ownerTokenFamilyId: string }>;
      const consumed = assertConsumedOwnerBinding({
        deviceSessionId: consumedRow.deviceSessionId,
        tokenFamilyId: consumedRow.tokenFamilyId,
        ownerTokenFamilyId: ownerRows[0]?.ownerTokenFamilyId ?? null
      });
      const updated = (await tx.$queryRaw`
        UPDATE "DeviceSession"
        SET "status" = 'revoked', "revokedAt" = ${fromEpochSeconds(now)}, "revokeReason" = 'refresh_replay'
        WHERE "tokenFamilyId" = ${consumed.tokenFamilyId} AND "status" = 'active'
        RETURNING "id"
      `) as Array<{ id: string }>;
      return {
        replay: true,
        tokenFamilyId: consumed.tokenFamilyId,
        revokedCount: updated.length,
        audit: "mobile_refresh_replay_detected"
      };
    });
  }

  async revokeFamilyOnReplayWithAudit(
    refreshTokenHash: string,
    now: number,
    audit: TransactionalAuditEvent,
    idempotencyRecordId?: string
  ): Promise<ReplayRevocationResult> {
    if (!isSafeTimestamp(now)) throw new DeviceSessionInvariantError();
    return this.prisma.$transaction(async (tx) => {
      const rows = (await tx.$queryRaw`
        SELECT "deviceSessionId", "tokenFamilyId" FROM "ConsumedRefreshToken"
        WHERE "refreshTokenHash" = ${refreshTokenHash} LIMIT 1
        FOR UPDATE
      `) as Array<{ deviceSessionId: string; tokenFamilyId: string }>;
      const consumedRow = rows[0];
      if (!consumedRow) return { replay: false, revokedCount: 0, audit: null };
      const ownerRows = (await tx.$queryRaw`
        SELECT "tokenFamilyId" AS "ownerTokenFamilyId" FROM "DeviceSession"
        WHERE "id" = ${consumedRow.deviceSessionId} LIMIT 1
        FOR UPDATE
      `) as Array<{ ownerTokenFamilyId: string }>;
      const consumed = assertConsumedOwnerBinding({
        deviceSessionId: consumedRow.deviceSessionId,
        tokenFamilyId: consumedRow.tokenFamilyId,
        ownerTokenFamilyId: ownerRows[0]?.ownerTokenFamilyId ?? null
      });
      const updated = (await tx.$queryRaw`
        UPDATE "DeviceSession"
        SET "status" = 'revoked', "revokedAt" = ${fromEpochSeconds(now)}, "revokeReason" = 'refresh_replay'
        WHERE "tokenFamilyId" = ${consumed.tokenFamilyId} AND "status" = 'active'
        RETURNING "id"
      `) as Array<{ id: string }>;
      await insertMobileAuthAudit(tx, audit);
      if (idempotencyRecordId) await completeMobileAuthIdempotency(tx, idempotencyRecordId, now);
      return {
        replay: true,
        tokenFamilyId: consumed.tokenFamilyId,
        revokedCount: updated.length,
        audit: "mobile_refresh_replay_detected"
      };
    });
  }

  /** Delete consumed-token records that are past their retention (expiresAt <= now). */
  async purgeExpiredConsumedTokens(now: number): Promise<number> {
    if (!isSafeTimestamp(now)) throw new DeviceSessionInvariantError();
    const { count } = await this.prisma.consumedRefreshToken.deleteMany({
      where: { expiresAt: { lte: fromEpochSeconds(now) } }
    });
    return count;
  }

  /**
   * Batch 2.2E — atomically exchange a single-use EmailVerification token for a new
   * active DeviceSession. In ONE transaction: consume the token (row-locked,
   * single-use), activate the User (same semantics as web email verification; does
   * NOT bump sessionVersion), create exactly one DeviceSession, and — in the SAME
   * transaction — write the issuance audit and complete idempotency. Any failure
   * rolls the whole thing back (no verifiedAt transition, no activation, no session,
   * no audit, no idempotency completion). The verification token is never copied into
   * any new table, audit, or log; only the refresh-token HASH is persisted.
   */
  async issueSessionFromVerificationWithAudit(
    input: IssueSessionInput,
    buildAudit: (
      userId: string,
      deviceSessionId: string
    ) => {
      event: "mobile_session_created";
      endpoint: "issue";
      occurredAt: number;
      userId: string;
      deviceSessionId: string;
      reason: "created";
      outcome: "success";
    },
    idempotencyRecordId?: string
  ): Promise<IssueSessionResult> {
    // Server-computed values must be structurally valid; a corrupt window is a bug,
    // not an auth failure, so it fails closed to a rolled-back internal error.
    if (
      !HEX64.test(input.refreshTokenHash) ||
      !isSafeTimestamp(input.now) ||
      !isSafeTimestamp(input.idleExpiresAt) ||
      !isSafeTimestamp(input.absoluteExpiresAt) ||
      input.idleExpiresAt <= input.now ||
      input.absoluteExpiresAt <= input.now ||
      input.idleExpiresAt > input.absoluteExpiresAt
    ) {
      throw new DeviceSessionInvariantError();
    }
    const nowTs = fromEpochSeconds(input.now);
    return this.prisma.$transaction(async (tx) => {
      // 1. Consume the verification token — single-use + not expired. The conditional
      //    UPDATE row-locks the token, so concurrent issuance serializes and only the
      //    first request sees a row (0 rows => missing / already-used / expired).
      const consumed = (await tx.$queryRaw`
        UPDATE "EmailVerification"
        SET "verifiedAt" = to_timestamp(${input.now}) AT TIME ZONE 'UTC'
        WHERE "token" = ${input.verificationToken}
          AND "verifiedAt" IS NULL
          AND EXTRACT(EPOCH FROM "expiresAt") > ${input.now}
        RETURNING "userId"
      `) as Array<{ userId: string }>;
      if (consumed.length === 0) return { status: "invalid_token" as const };
      const userId = consumed[0].userId;

      // 2. Activate the user — identical to web verify-email semantics (status=active,
      //    emailVerifiedAt set); sessionVersion is NOT bumped. A missing user rolls back.
      const activated = (await tx.$queryRaw`
        UPDATE "User"
        SET "status" = 'active', "emailVerifiedAt" = to_timestamp(${input.now}) AT TIME ZONE 'UTC'
        WHERE "id" = ${userId}
        RETURNING "sessionVersion"
      `) as Array<{ sessionVersion: number }>;
      if (activated.length === 0) throw new DeviceSessionInvariantError();
      const sessionVersion = activated[0].sessionVersion;

      // 3. Global refresh-hash exclusivity, then create exactly one active session.
      await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${input.refreshTokenHash}, 0::bigint))) _l`;
      const inCurrent = (await tx.$queryRaw`SELECT 1 FROM "DeviceSession" WHERE "refreshTokenHash" = ${input.refreshTokenHash} LIMIT 1`) as unknown[];
      const inConsumed = (await tx.$queryRaw`SELECT 1 FROM "ConsumedRefreshToken" WHERE "refreshTokenHash" = ${input.refreshTokenHash} LIMIT 1`) as unknown[];
      if (inCurrent.length > 0 || inConsumed.length > 0) throw new DeviceSessionInvariantError();
      const row = await tx.deviceSession.create({
        data: {
          id: input.sessionId,
          userId,
          tokenFamilyId: input.tokenFamilyId,
          status: "active",
          rotationCounter: 0,
          refreshTokenHash: input.refreshTokenHash,
          createdAt: nowTs,
          lastUsedAt: nowTs,
          idleExpiresAt: fromEpochSeconds(input.idleExpiresAt),
          absoluteExpiresAt: fromEpochSeconds(input.absoluteExpiresAt)
        }
      });

      // 4. Audit + idempotency completion in the SAME transaction (all-or-nothing).
      await insertMobileAuthAudit(tx, buildAudit(userId, input.sessionId));
      if (idempotencyRecordId) await completeMobileAuthIdempotency(tx, idempotencyRecordId, input.now);

      return { status: "issued" as const, session: mapRow(row), userId, sessionVersion };
    });
  }
}
