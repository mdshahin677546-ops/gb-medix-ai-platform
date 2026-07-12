/**
 * Mobile user eligibility (pure). Decided ONLY by server-side facts + the token's
 * sessionVersion snapshot vs the DB sessionVersion. A client can never supply or
 * override status / emailVerified / sessionVersion / entitlement / provider state.
 */

/** Server-resolved facts about the user (never client-provided). */
export type MobileUserFacts = {
  exists: boolean;
  status: string;
  emailVerifiedAt: number | string | null;
  sessionVersion: number;
};

export type MobileEligibilityResult =
  | { ok: true }
  | {
      ok: false;
      reason: "user_not_found" | "not_active" | "email_not_verified" | "session_version_mismatch";
    };

/**
 * @param facts server facts (or null if the user row was not found)
 * @param tokenSessionVersion the `sv` claim from the presented access token
 */
export function evaluateMobileUserEligibility(
  facts: MobileUserFacts | null,
  tokenSessionVersion: number
): MobileEligibilityResult {
  if (!facts || !facts.exists) return { ok: false, reason: "user_not_found" };
  if (facts.status !== "active") return { ok: false, reason: "not_active" };
  if (facts.emailVerifiedAt == null) return { ok: false, reason: "email_not_verified" };
  // Global logout / credential change bumps DB sessionVersion; stale tokens fail.
  if (facts.sessionVersion !== tokenSessionVersion) {
    return { ok: false, reason: "session_version_mismatch" };
  }
  return { ok: true };
}
