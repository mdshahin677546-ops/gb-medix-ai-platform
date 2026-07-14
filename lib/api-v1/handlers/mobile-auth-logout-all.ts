import { newRequestId } from "../request-context";
import { success, failure, internalFailure } from "../failure";
import { finalize, type HandlerResult } from "../handler-result";
import { mobileLogoutAllRequestSchema } from "../../api-contract/v1/mobile-auth";
import { verifyBearerAccessToken } from "../../mobile-auth/v1/access-token-sign";
import type { AccessTokenPolicy } from "../../mobile-auth/v1/access-token";
import { evaluateMobileUserEligibility, type MobileUserFacts } from "../../mobile-auth/v1/eligibility";
import { buildMobileAuthAuditEvent } from "../../mobile-auth/v1/audit";
import type { RevokeReason } from "../../mobile-auth/v1/device-session";

/**
 * POST /api/v1/mobile/auth/logout-all handler factory (Batch 2.2C).
 *
 * Revokes ALL device sessions for the acting user. The actor is resolved ONLY
 * from a verified Bearer access token (signature + claims + server-side
 * sessionVersion revalidation); the request body is strict-empty, so a
 * client-supplied `userId` (or any other field) is rejected — cross-user logout
 * is impossible. This boundary is entirely separate from the Web cookie session.
 */
export type MobileLogoutAllDeps = {
  now: () => number;
  signingKey: string;
  policy: AccessTokenPolicy;
  getUserFacts: (userId: string) => Promise<MobileUserFacts | null>;
  revokeAllUserSessions: (userId: string, reason: RevokeReason, now: number) => Promise<number>;
  audit?: (event: unknown) => void;
};

function emitAudit(audit: ((e: unknown) => void) | undefined, input: unknown): void {
  if (!audit) return;
  try {
    audit(buildMobileAuthAuditEvent(input));
  } catch {
    /* audit must never break or leak into the request path */
  }
}

export function createMobileLogoutAllHandler(deps: MobileLogoutAllDeps) {
  return async function POST(input: { body: unknown; authorization: unknown }): Promise<HandlerResult> {
    const requestId = newRequestId();
    try {
      const now = deps.now();

      // 1. Bearer authentication (server-verified; never trusts token-body facts).
      const bearer = verifyBearerAccessToken(input.authorization, deps.signingKey, deps.policy, now);
      if (!bearer.ok) {
        const code = bearer.reason === "expired" ? "TOKEN_EXPIRED" : "AUTH_REQUIRED";
        return finalize(requestId, failure(code, requestId));
      }

      // 2. Strict-empty body: a client-supplied userId / any field is rejected.
      const parsedBody = mobileLogoutAllRequestSchema.safeParse(input.body);
      if (!parsedBody.success) return finalize(requestId, failure("VALIDATION_ERROR", requestId));

      // 3. Re-validate the acting user server-side, incl. sessionVersion snapshot.
      const facts = await deps.getUserFacts(bearer.claims.sub);
      const eligible = evaluateMobileUserEligibility(facts, bearer.claims.sv);
      if (!eligible.ok) {
        const code = eligible.reason === "session_version_mismatch" ? "TOKEN_EXPIRED" : "AUTH_REQUIRED";
        return finalize(requestId, failure(code, requestId));
      }

      // 4. Revoke every session owned by the verified actor only.
      await deps.revokeAllUserSessions(bearer.claims.sub, "user_logout_all", now);
      emitAudit(deps.audit, {
        event: "mobile_all_sessions_revoked",
        occurredAt: now,
        userId: bearer.claims.sub,
        reason: "user_logout_all"
      });
      return finalize(requestId, success({ acknowledged: true }, requestId));
    } catch {
      return finalize(requestId, internalFailure(requestId));
    }
  };
}
