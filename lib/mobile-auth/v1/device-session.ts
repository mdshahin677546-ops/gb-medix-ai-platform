/**
 * DeviceSession security model (pure types + time-boundary helpers).
 *
 * All timestamps are epoch SECONDS. A session is usable only while `active` and
 * within BOTH its idle and absolute windows. The absolute window can never be
 * extended by a refresh; `revoked`/`compromised` sessions can never rotate.
 */

export const DEVICE_SESSION_STATUSES = ["active", "revoked", "expired", "compromised"] as const;
export type DeviceSessionStatus = (typeof DEVICE_SESSION_STATUSES)[number];

const DEVICE_SESSION_STATUS_SET: ReadonlySet<string> = new Set(DEVICE_SESSION_STATUSES);

/** rotationCounter must stay below this so the NEXT increment is still an exact integer. */
export const MAX_ROTATION_COUNTER = Number.MAX_SAFE_INTEGER - 1;

export const REVOKE_REASONS = [
  "user_logout",
  "user_logout_all",
  "refresh_replay",
  "token_family_revoked",
  "session_version_bump",
  "compromised",
  "admin",
  "expired"
] as const;
export type RevokeReason = (typeof REVOKE_REASONS)[number];

export type DeviceSession = {
  id: string;
  userId: string;
  tokenFamilyId: string;
  status: DeviceSessionStatus;
  /** Monotonically increasing; bumped on every successful rotation. */
  rotationCounter: number;
  /** HMAC hash of the CURRENT refresh token — plaintext is never stored. */
  refreshTokenHash: string;
  createdAt: number;
  lastUsedAt: number;
  idleExpiresAt: number;
  absoluteExpiresAt: number;
  revokedAt: number | null;
  revokeReason: RevokeReason | null;
};

/** A finite, safe, non-negative integer (persisted data may be corrupt — validate at runtime). */
export function isSafeTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/** A finite, safe, non-negative integer rotation counter. */
export function isSafeCounter(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/**
 * Authoritative structural validator — the SINGLE source of the session
 * numeric/relational invariants. Used by createSession (input), the atomic
 * rotation (re-validating persisted state), and as the gate behind the time
 * helpers, so the rules can never drift across call sites. A `number` in the type
 * system is NOT trusted at runtime; a corrupt/loaded record fails closed here.
 */
export function hasValidSessionInvariants(session: DeviceSession): boolean {
  if (!session || typeof session !== "object") return false;
  if (!DEVICE_SESSION_STATUS_SET.has(session.status)) return false;
  if (!isSafeTimestamp(session.createdAt)) return false;
  if (!isSafeTimestamp(session.lastUsedAt)) return false;
  if (!isSafeTimestamp(session.idleExpiresAt)) return false;
  if (!isSafeTimestamp(session.absoluteExpiresAt)) return false;
  if (!isSafeCounter(session.rotationCounter)) return false;
  if (session.createdAt > session.lastUsedAt) return false;
  if (session.idleExpiresAt <= session.createdAt) return false;
  if (session.absoluteExpiresAt <= session.createdAt) return false;
  if (session.idleExpiresAt > session.absoluteExpiresAt) return false;
  return true;
}

/**
 * Expired once EITHER the idle or the absolute deadline is reached. Fails CLOSED:
 * a non-finite `now` or corrupt session time is treated as expired (unusable).
 */
export function isSessionTimeExpired(session: DeviceSession, now: number): boolean {
  if (!isSafeTimestamp(now)) return true;
  if (!isSafeTimestamp(session.idleExpiresAt) || !isSafeTimestamp(session.absoluteExpiresAt)) {
    return true;
  }
  return now >= session.idleExpiresAt || now >= session.absoluteExpiresAt;
}

/** Usable = active status, valid structural invariants, valid `now`, and not expired. */
export function isSessionUsable(session: DeviceSession, now: number): boolean {
  if (session.status !== "active") return false;
  if (!hasValidSessionInvariants(session)) return false;
  if (!isSafeTimestamp(now)) return false;
  return !isSessionTimeExpired(session, now);
}

/**
 * A refreshed idle deadline, clamped so it can NEVER exceed the absolute
 * deadline. Returns null (NOT a usable deadline) for any invalid input — it never
 * yields NaN/Infinity as a "valid" deadline.
 */
export function nextIdleExpiry(
  session: DeviceSession,
  now: number,
  idleTtlSeconds: number
): number | null {
  if (!isSafeTimestamp(now)) return null;
  if (!isSafeCounter(idleTtlSeconds)) return null;
  if (!isSafeTimestamp(session.absoluteExpiresAt)) return null;
  const proposed = now + idleTtlSeconds;
  if (!Number.isSafeInteger(proposed)) return null;
  return Math.min(proposed, session.absoluteExpiresAt);
}
