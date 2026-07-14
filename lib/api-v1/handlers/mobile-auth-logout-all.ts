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
  revokeAllUserSessionsWithAudit?: (
    userId: string,
    reason: RevokeReason,
    now: number,
    audit: {
      event: "mobile_all_sessions_revoked";
      occurredAt: number;
      userId: string;
      reason: "user_logout_all";
      outcome: "success";
    },
    idempotencyRecordId?: string
  ) => Promise<number>;
  audit?: (event: unknown) => void;
  security?: {
    actorDigest: (value: string) => string;
    credentialDigest: (value: string) => string;
    requestDigest: (endpoint: "logout-all", body: Record<string, unknown>) => string;
    checkRateLimit: (input: { endpoint: "logout-all"; subjectDigest: string; now: number; userId?: string }) => Promise<
      { ok: true } | { ok: false; retryAfterSeconds: number }
    >;
    claimIdempotency: (input: {
      endpoint: "logout-all";
      rawKey: string;
      actorDigest: string;
      credentialDigest: string;
      requestDigest: string;
      now: number;
    }) => Promise<{ status: "claimed"; id: string } | { status: "completed"; id: string } | { status: "conflict" }>;
    completeIdempotency: (id: string, now: number) => Promise<void>;
    failIdempotency: (id: string, now: number) => Promise<void>;
  };
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
  return async function POST(input: { body: unknown; authorization: unknown; idempotencyKey?: string }): Promise<HandlerResult> {
    const requestId = newRequestId();
    let idempotencyRecordId: string | undefined;
    let nowForFailure: number | null = null;
    try {
      const now = deps.now();
      nowForFailure = now;

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

      if (deps.security && input.idempotencyKey) {
        const actor = deps.security.actorDigest(bearer.claims.sub);
        const credential = deps.security.credentialDigest(`${bearer.claims.sub}:${bearer.claims.sid}:${bearer.claims.sv}`);
        const claim = await deps.security.claimIdempotency({
          endpoint: "logout-all",
          rawKey: input.idempotencyKey,
          actorDigest: actor,
          credentialDigest: credential,
          requestDigest: deps.security.requestDigest("logout-all", parsedBody.data),
          now
        });
        if (claim.status === "conflict") return finalize(requestId, failure("CONFLICT", requestId));
        if (claim.status === "completed") return finalize(requestId, success({ acknowledged: true }, requestId));
        idempotencyRecordId = claim.id;
        const limited = await deps.security.checkRateLimit({
          endpoint: "logout-all",
          subjectDigest: actor,
          now,
          userId: bearer.claims.sub
        });
        if (!limited.ok) {
          await deps.security.completeIdempotency(idempotencyRecordId, now);
          return finalize(requestId, failure("RATE_LIMITED", requestId), {
            "Retry-After": String(limited.retryAfterSeconds)
          });
        }
      }

      // 4. Revoke every session owned by the verified actor only.
      const audit = {
        event: "mobile_all_sessions_revoked" as const,
        occurredAt: now,
        userId: bearer.claims.sub,
        reason: "user_logout_all" as const,
        outcome: "success" as const
      };
      if (deps.revokeAllUserSessionsWithAudit) {
        await deps.revokeAllUserSessionsWithAudit(
          bearer.claims.sub,
          "user_logout_all",
          now,
          audit,
          idempotencyRecordId
        );
      } else {
        await deps.revokeAllUserSessions(bearer.claims.sub, "user_logout_all", now);
        emitAudit(deps.audit, audit);
        if (idempotencyRecordId && deps.security) await deps.security.completeIdempotency(idempotencyRecordId, now);
      }
      return finalize(requestId, success({ acknowledged: true }, requestId));
    } catch {
      if (idempotencyRecordId && deps.security && nowForFailure != null) {
        await deps.security.failIdempotency(idempotencyRecordId, nowForFailure).catch(() => undefined);
      }
      return finalize(requestId, internalFailure(requestId));
    }
  };
}
