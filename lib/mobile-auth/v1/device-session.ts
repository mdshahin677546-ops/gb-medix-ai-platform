/**
 * DeviceSession security model (pure types + time-boundary helpers).
 *
 * All timestamps are epoch SECONDS. A session is usable only while `active` and
 * within BOTH its idle and absolute windows. The absolute window can never be
 * extended by a refresh; `revoked`/`compromised` sessions can never rotate.
 */

export const DEVICE_SESSION_STATUSES = ["active", "revoked", "expired", "compromised"] as const;
export type DeviceSessionStatus = (typeof DEVICE_SESSION_STATUSES)[number];

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

/** Expired once EITHER the idle or the absolute deadline is reached. */
export function isSessionTimeExpired(session: DeviceSession, now: number): boolean {
  return now >= session.idleExpiresAt || now >= session.absoluteExpiresAt;
}

/** Usable = active status AND not past either time boundary. */
export function isSessionUsable(session: DeviceSession, now: number): boolean {
  return session.status === "active" && !isSessionTimeExpired(session, now);
}

/**
 * A refreshed idle deadline, clamped so it can NEVER exceed the absolute
 * deadline — absolute expiry is a hard ceiling that refresh cannot extend.
 */
export function nextIdleExpiry(
  session: DeviceSession,
  now: number,
  idleTtlSeconds: number
): number {
  const proposed = now + idleTtlSeconds;
  return Math.min(proposed, session.absoluteExpiresAt);
}
