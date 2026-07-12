import { isSessionTimeExpired, type DeviceSession } from "./device-session";

/**
 * Refresh rotation / replay policy (pure decision layer).
 *
 * The presented refresh token hash is first CLASSIFIED against the store:
 * - "current": it is the session's current hash        -> candidate to rotate
 * - "consumed": it is a prior (already-rotated) hash    -> REPLAY -> revoke family
 * - "unknown": it matches nothing                        -> not found
 *
 * This layer decides intent; single-winner enforcement (only one concurrent
 * rotation succeeds) is the atomic Store's job (see rotateRefreshTokenAtomically).
 */

export type RefreshLookup =
  | { kind: "current"; session: DeviceSession }
  | { kind: "consumed"; session: DeviceSession }
  | { kind: "unknown" };

export type RefreshDecision =
  | {
      action: "rotate";
      sessionId: string;
      tokenFamilyId: string;
      expectedRotationCounter: number;
      expectedCurrentRefreshTokenHash: string;
    }
  | { action: "revoke_family"; tokenFamilyId: string; reason: "replay_detected" }
  | {
      action: "reject";
      reason: "session_not_found" | "session_revoked" | "session_expired" | "session_compromised";
    };

/**
 * Classify a presented refresh-token hash from the two store lookups a
 * production store must provide: the session whose CURRENT hash matches, and the
 * session/family a CONSUMED (historical) hash belonged to. A consumed match wins
 * (it is a replay signal) so a leaked old token can never be mistaken for valid.
 */
export function classifyRefreshLookup(
  currentMatch: DeviceSession | null,
  consumedMatch: DeviceSession | null
): RefreshLookup {
  if (consumedMatch) return { kind: "consumed", session: consumedMatch };
  if (currentMatch) return { kind: "current", session: currentMatch };
  return { kind: "unknown" };
}

export function evaluateRefreshAttempt(lookup: RefreshLookup, now: number): RefreshDecision {
  if (lookup.kind === "unknown") {
    return { action: "reject", reason: "session_not_found" };
  }

  if (lookup.kind === "consumed") {
    // A previously-rotated token was replayed: revoke the entire token family.
    return {
      action: "revoke_family",
      tokenFamilyId: lookup.session.tokenFamilyId,
      reason: "replay_detected"
    };
  }

  const s = lookup.session;
  if (s.status === "compromised") return { action: "reject", reason: "session_compromised" };
  if (s.status === "revoked") return { action: "reject", reason: "session_revoked" };
  if (s.status === "expired" || isSessionTimeExpired(s, now)) {
    return { action: "reject", reason: "session_expired" };
  }

  return {
    action: "rotate",
    sessionId: s.id,
    tokenFamilyId: s.tokenFamilyId,
    expectedRotationCounter: s.rotationCounter,
    expectedCurrentRefreshTokenHash: s.refreshTokenHash
  };
}
