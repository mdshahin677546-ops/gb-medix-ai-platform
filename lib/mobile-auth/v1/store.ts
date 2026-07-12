import {
  isSessionTimeExpired,
  hasValidSessionInvariants,
  isSafeTimestamp,
  isSafeCounter,
  MAX_ROTATION_COUNTER,
  type DeviceSession,
  type RevokeReason
} from "./device-session";
import { classifyRefreshLookup, type RefreshLookup } from "./rotation";

/** Thrown by createSession on invalid/corrupt input. Message is fixed and value-free. */
export class DeviceSessionInvariantError extends Error {
  constructor() {
    super("Invalid device session state.");
    this.name = "DeviceSessionInvariantError";
  }
}

/**
 * DeviceSession Store interface + an in-memory reference implementation used by
 * tests to model the required Compare-And-Set (CAS) rotation semantics.
 *
 * PRODUCTION REQUIREMENT: a real store MUST make rotateRefreshTokenAtomically a
 * genuine atomic operation — a DB transaction with a conditional/CAS update
 * (WHERE rotationCounter = expected AND refreshTokenHash = expected), a row lock,
 * or a unique constraint / fencing token. A plain read-then-write MUST NOT be
 * used; it cannot guarantee single-winner rotation under concurrency.
 * This batch ships NO Prisma store.
 */

export type CreateSessionInput = {
  id: string;
  userId: string;
  tokenFamilyId: string;
  refreshTokenHash: string;
  createdAt: number;
  idleExpiresAt: number;
  absoluteExpiresAt: number;
  /**
   * Optional starting counter for rehydrating a stored session. Defaults to 0.
   * In production this may ONLY come from a trusted database record, and even
   * then it is re-validated here (safe non-negative integer, <= MAX_ROTATION_COUNTER);
   * a corrupt / non-finite value fails closed (DeviceSessionInvariantError).
   */
  rotationCounter?: number;
};

export type RotateInput = {
  sessionId: string;
  expectedRotationCounter: number;
  expectedCurrentRefreshTokenHash: string;
  newRefreshTokenHash: string;
  newIdleExpiresAt: number;
  now: number;
};

export type RotateResult =
  | { status: "rotated"; session: DeviceSession }
  | { status: "conflict" }
  | { status: "not_found" }
  | { status: "not_active" }
  | { status: "expired" }
  /** Corrupt/invalid state or time input (non-finite/non-integer/out-of-range). Carries no echoed value. */
  | { status: "invalid_input" };

export interface DeviceSessionStore {
  findById(id: string): Promise<DeviceSession | null>;
  findByRefreshTokenHash(refreshTokenHash: string): Promise<DeviceSession | null>;
  createSession(input: CreateSessionInput): Promise<DeviceSession>;
  rotateRefreshTokenAtomically(input: RotateInput): Promise<RotateResult>;
  revokeSession(id: string, reason: RevokeReason, now: number): Promise<void>;
  revokeTokenFamily(tokenFamilyId: string, reason: RevokeReason, now: number): Promise<number>;
  revokeAllUserSessions(userId: string, reason: RevokeReason, now: number): Promise<number>;
  markCompromised(id: string, now: number): Promise<void>;
}

/**
 * In-memory reference store. Each method body is synchronous (no await between
 * the CAS check and the write), which — in single-threaded JS — makes
 * rotateRefreshTokenAtomically atomic: two concurrent rotations on the same
 * expected counter yield exactly one `rotated` and one `conflict`.
 */
export class InMemoryDeviceSessionStore implements DeviceSessionStore {
  private readonly byId = new Map<string, DeviceSession>();
  /** Consumed (previously-rotated) hash -> the session it belonged to (replay index). */
  private readonly consumed = new Map<string, string>();

  async findById(id: string): Promise<DeviceSession | null> {
    const s = this.byId.get(id);
    return s ? { ...s } : null;
  }

  async findByRefreshTokenHash(refreshTokenHash: string): Promise<DeviceSession | null> {
    for (const s of this.byId.values()) {
      if (s.refreshTokenHash === refreshTokenHash) return { ...s };
    }
    return null;
  }

  async createSession(input: CreateSessionInput): Promise<DeviceSession> {
    if (this.byId.has(input.id)) {
      throw new DeviceSessionInvariantError();
    }
    const startCounter = input.rotationCounter ?? 0;
    // Validate ALL numeric fields + time relations BEFORE any Map write (fail
    // closed; no partial session, no echoed input). Client input is NEVER treated
    // as trusted rehydration.
    if (
      !isSafeTimestamp(input.createdAt) ||
      !isSafeTimestamp(input.idleExpiresAt) ||
      !isSafeTimestamp(input.absoluteExpiresAt) ||
      !isSafeCounter(startCounter) ||
      startCounter > MAX_ROTATION_COUNTER ||
      input.idleExpiresAt <= input.createdAt ||
      input.absoluteExpiresAt <= input.createdAt ||
      input.idleExpiresAt > input.absoluteExpiresAt
    ) {
      throw new DeviceSessionInvariantError();
    }
    const session: DeviceSession = {
      id: input.id,
      userId: input.userId,
      tokenFamilyId: input.tokenFamilyId,
      status: "active",
      rotationCounter: startCounter,
      refreshTokenHash: input.refreshTokenHash,
      createdAt: input.createdAt,
      lastUsedAt: input.createdAt,
      idleExpiresAt: input.idleExpiresAt,
      absoluteExpiresAt: input.absoluteExpiresAt,
      revokedAt: null,
      revokeReason: null
    };
    this.byId.set(session.id, session);
    return { ...session };
  }

  async rotateRefreshTokenAtomically(input: RotateInput): Promise<RotateResult> {
    // 1. Validate REQUEST inputs (fail closed, no echoed value).
    if (!isSafeTimestamp(input.now)) return { status: "invalid_input" };
    if (!Number.isSafeInteger(input.newIdleExpiresAt)) return { status: "invalid_input" };
    if (!isSafeCounter(input.expectedRotationCounter)) return { status: "invalid_input" };

    const s = this.byId.get(input.sessionId);
    if (!s) return { status: "not_found" };

    // 2. Re-validate the PERSISTED session FIRST — loaded data may be corrupt. A
    //    corrupt numeric/relational state or unknown status fails closed as
    //    invalid_input (never rotated, and distinct from `expired`/`not_active`).
    if (!hasValidSessionInvariants(s)) return { status: "invalid_input" };
    // 3. A structurally-valid but non-active status is not_active.
    if (s.status !== "active") return { status: "not_active" };
    // 4. Time must not run backwards relative to the session's last use.
    if (input.now < s.lastUsedAt) return { status: "invalid_input" };
    // 5. A session at a legitimate deadline is expired.
    if (isSessionTimeExpired(s, input.now)) return { status: "expired" };

    // 6. CAS: both counter and current hash must match the expected values.
    if (
      s.rotationCounter !== input.expectedRotationCounter ||
      s.refreshTokenHash !== input.expectedCurrentRefreshTokenHash
    ) {
      return { status: "conflict" };
    }
    // 7. rotationCounter must be safely incrementable.
    if (s.rotationCounter >= MAX_ROTATION_COUNTER) return { status: "invalid_input" };
    // 8. The new idle deadline must be strictly in the future...
    if (input.newIdleExpiresAt <= input.now) return { status: "invalid_input" };
    // ...and can NEVER extend the session past its absolute ceiling: clamp down.
    const newIdle = Math.min(input.newIdleExpiresAt, s.absoluteExpiresAt);
    if (newIdle <= input.now) return { status: "invalid_input" };

    // 9. All checks passed — commit atomically (single-threaded, no await above).
    this.consumed.set(s.refreshTokenHash, s.id);
    s.rotationCounter += 1;
    s.refreshTokenHash = input.newRefreshTokenHash;
    s.idleExpiresAt = newIdle;
    s.lastUsedAt = input.now;
    return { status: "rotated", session: { ...s } };
  }

  async revokeSession(id: string, reason: RevokeReason, now: number): Promise<void> {
    const s = this.byId.get(id);
    if (!s || s.status === "revoked" || s.status === "compromised") return;
    s.status = "revoked";
    s.revokedAt = now;
    s.revokeReason = reason;
  }

  async revokeTokenFamily(tokenFamilyId: string, reason: RevokeReason, now: number): Promise<number> {
    let count = 0;
    for (const s of this.byId.values()) {
      if (s.tokenFamilyId === tokenFamilyId && s.status === "active") {
        s.status = "revoked";
        s.revokedAt = now;
        s.revokeReason = reason;
        count += 1;
      }
    }
    return count;
  }

  async revokeAllUserSessions(userId: string, reason: RevokeReason, now: number): Promise<number> {
    let count = 0;
    for (const s of this.byId.values()) {
      if (s.userId === userId && s.status === "active") {
        s.status = "revoked";
        s.revokedAt = now;
        s.revokeReason = reason;
        count += 1;
      }
    }
    return count;
  }

  async markCompromised(id: string, now: number): Promise<void> {
    const s = this.byId.get(id);
    if (!s) return;
    s.status = "compromised";
    s.revokedAt = now;
    s.revokeReason = "compromised";
  }

  /**
   * Convenience for the refresh policy: classify a presented hash as current /
   * consumed / unknown. A production store resolves the same two facts (current
   * hash match + consumed-history match) inside its atomic path.
   */
  classifyRefreshToken(refreshTokenHash: string): RefreshLookup {
    let current: DeviceSession | null = null;
    for (const s of this.byId.values()) {
      if (s.refreshTokenHash === refreshTokenHash) {
        current = { ...s };
        break;
      }
    }
    const consumedSessionId = this.consumed.get(refreshTokenHash);
    const consumedSession = consumedSessionId ? this.byId.get(consumedSessionId) ?? null : null;
    return classifyRefreshLookup(current, consumedSession ? { ...consumedSession } : null);
  }
}
