import {
  isSessionTimeExpired,
  type DeviceSession,
  type RevokeReason
} from "./device-session";
import { classifyRefreshLookup, type RefreshLookup } from "./rotation";

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
  /** Optional starting counter (e.g. rehydrating a stored session). Defaults to 0. */
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
  /** Programmer/time error (non-finite/non-integer/out-of-range input). Carries no echoed value. */
  | { status: "invalid_input" };

/** Guard against rotationCounter reaching an unsafe (non-exact) integer region. */
export const MAX_ROTATION_COUNTER = Number.MAX_SAFE_INTEGER - 1;

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
      throw new Error("Device session id already exists.");
    }
    const startCounter = input.rotationCounter ?? 0;
    if (!Number.isInteger(startCounter) || startCounter < 0) {
      throw new Error("Invalid rotationCounter.");
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
    // Validate time inputs BEFORE touching any session state (fail closed, no echo).
    if (!Number.isInteger(input.now) || input.now < 0) return { status: "invalid_input" };
    if (!Number.isInteger(input.newIdleExpiresAt)) return { status: "invalid_input" };

    const s = this.byId.get(input.sessionId);
    if (!s) return { status: "not_found" };
    if (s.status !== "active") return { status: "not_active" };
    if (isSessionTimeExpired(s, input.now)) return { status: "expired" };
    // CAS: both the counter and the current hash must match the expected values.
    if (
      s.rotationCounter !== input.expectedRotationCounter ||
      s.refreshTokenHash !== input.expectedCurrentRefreshTokenHash
    ) {
      return { status: "conflict" };
    }
    // rotationCounter must stay a safe, exact, monotonically increasing integer.
    if (!Number.isInteger(s.rotationCounter) || s.rotationCounter >= MAX_ROTATION_COUNTER) {
      return { status: "invalid_input" };
    }
    // The new idle deadline must be strictly in the future...
    if (input.newIdleExpiresAt <= input.now) return { status: "invalid_input" };
    // ...and can NEVER extend the session past its absolute ceiling: clamp down.
    const newIdle = Math.min(input.newIdleExpiresAt, s.absoluteExpiresAt);

    // All checks passed — commit atomically (single-threaded, no await above).
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
