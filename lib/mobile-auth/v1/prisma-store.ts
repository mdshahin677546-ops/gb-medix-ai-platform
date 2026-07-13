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
  $transaction: <T>(fn: (tx: Tx) => Promise<T>) => Promise<T>;
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
          FROM "DeviceSession" WHERE "id" = ${input.sessionId} FOR UPDATE
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
      });
    } catch (error) {
      // Unique-constraint race -> conflict; any other DB error -> invalid_input.
      // Never surface Prisma/SQL text upward.
      return { status: isUniqueViolation(error) ? "conflict" : "invalid_input" };
    }
  }

  async revokeSession(id: string, reason: RevokeReason, now: number): Promise<void> {
    if (!isRevokeReason(reason) || !isSafeTimestamp(now)) throw new DeviceSessionInvariantError();
    await this.prisma.deviceSession.updateMany({
      where: { id, status: { notIn: ["revoked", "compromised"] } },
      data: { status: "revoked", revokedAt: fromEpochSeconds(now), revokeReason: reason }
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
    const [current, consumed] = await Promise.all([
      this.prisma.deviceSession.findUnique({ where: { refreshTokenHash } }),
      this.prisma.consumedRefreshToken.findUnique({ where: { refreshTokenHash } })
    ]);
    // Cross-table duplication is corruption — fail closed, never let a "current"
    // hit mask a replay.
    if (current && consumed) throw new DeviceSessionInvariantError();
    // Consumed takes priority (replay signal). Only ids are returned, never a hash.
    if (consumed) {
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
        SELECT "tokenFamilyId" FROM "ConsumedRefreshToken"
        WHERE "refreshTokenHash" = ${refreshTokenHash} LIMIT 1
      `) as Array<{ tokenFamilyId: string }>;
      const consumed = rows[0];
      if (!consumed) return { replay: false, revokedCount: 0, audit: null };
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

  /** Delete consumed-token records that are past their retention (expiresAt <= now). */
  async purgeExpiredConsumedTokens(now: number): Promise<number> {
    if (!isSafeTimestamp(now)) throw new DeviceSessionInvariantError();
    const { count } = await this.prisma.consumedRefreshToken.deleteMany({
      where: { expiresAt: { lte: fromEpochSeconds(now) } }
    });
    return count;
  }
}
