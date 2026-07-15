import { newRequestId } from "../request-context";
import { success, failure, internalFailure } from "../failure";
import { finalize, type HandlerResult } from "../handler-result";
import { mobileLogoutRequestSchema } from "../../api-contract/v1/mobile-auth";
import { hashRefreshToken } from "../../mobile-auth/v1/refresh-token";
import { buildMobileAuthAuditEvent } from "../../mobile-auth/v1/audit";
import type { DeviceSession, RevokeReason } from "../../mobile-auth/v1/device-session";

/**
 * POST /api/v1/mobile/auth/logout handler factory (Batch 2.2C).
 *
 * Revokes the single device session owning the presented refresh token. It is
 * IDEMPOTENT and NON-REVEALING: whether or not a matching (or active) session
 * exists, the response is identical, so it is never an oracle for token/session
 * existence. The refresh plaintext is used only to compute a hash, then discarded.
 */
export type MobileLogoutDeps = {
  now: () => number;
  pepper: string;
  findCurrentByHash: (refreshTokenHash: string) => Promise<DeviceSession | null>;
  revokeSession: (id: string, reason: RevokeReason, now: number) => Promise<void>;
  revokeSessionWithAudit?: (
    id: string,
    reason: RevokeReason,
    now: number,
    audit: {
      event: "mobile_session_revoked";
      occurredAt: number;
      userId: string;
      deviceSessionId: string;
      reason: "user_logout";
      outcome: "success";
    },
    idempotencyRecordId?: string
  ) => Promise<void>;
  audit?: (event: unknown) => void;
  security?: {
    credentialDigest: (value: string) => string;
    requestDigest: (endpoint: "logout", body: Record<string, unknown>) => string;
    checkRateLimit: (input: { endpoint: "logout"; subjectDigest: string; now: number }) => Promise<
      { ok: true } | { ok: false; retryAfterSeconds: number }
    >;
    claimIdempotency: (input: {
      endpoint: "logout";
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

export function createMobileLogoutHandler(deps: MobileLogoutDeps) {
  return async function POST(input: { body: unknown; idempotencyKey?: string }): Promise<HandlerResult> {
    const requestId = newRequestId();
    let idempotencyRecordId: string | undefined;
    let nowForFailure: number | null = null;
    try {
      const parsed = mobileLogoutRequestSchema.safeParse(input.body);
      if (!parsed.success) return finalize(requestId, failure("VALIDATION_ERROR", requestId));

      const now = deps.now();
      nowForFailure = now;
      const presentedHash = hashRefreshToken(parsed.data.refreshToken, deps.pepper);

      if (deps.security && input.idempotencyKey) {
        const subjectDigest = deps.security.credentialDigest(presentedHash);
        // Rate limit FIRST (B22D-P1-001): a denied request must NEVER claim or
        // complete an idempotency record, so a same-key retry can never replay as
        // a false success. checkRateLimit persists its own mobile_auth_rate_limited
        // audit on denial, and no revoke side effect runs on a 429.
        const limited = await deps.security.checkRateLimit({ endpoint: "logout", subjectDigest, now });
        if (!limited.ok) {
          return finalize(requestId, failure("RATE_LIMITED", requestId), { retryAfterSeconds: limited.retryAfterSeconds });
        }
        const claim = await deps.security.claimIdempotency({
          endpoint: "logout",
          rawKey: input.idempotencyKey,
          actorDigest: subjectDigest,
          credentialDigest: subjectDigest,
          requestDigest: deps.security.requestDigest("logout", parsed.data),
          now
        });
        if (claim.status === "conflict") return finalize(requestId, failure("CONFLICT", requestId));
        if (claim.status === "completed") return finalize(requestId, success({ acknowledged: true }, requestId));
        idempotencyRecordId = claim.id;
      }
      const current = await deps.findCurrentByHash(presentedHash);

      if (current && current.status === "active") {
        const audit = {
          event: "mobile_session_revoked" as const,
          occurredAt: now,
          userId: current.userId,
          deviceSessionId: current.id,
          reason: "user_logout" as const,
          outcome: "success" as const
        };
        if (deps.revokeSessionWithAudit) {
          await deps.revokeSessionWithAudit(current.id, "user_logout", now, audit, idempotencyRecordId);
        } else {
          await deps.revokeSession(current.id, "user_logout", now);
          emitAudit(deps.audit, audit);
          if (idempotencyRecordId && deps.security) await deps.security.completeIdempotency(idempotencyRecordId, now);
        }
      } else if (idempotencyRecordId && deps.security) {
        await deps.security.completeIdempotency(idempotencyRecordId, now);
      }

      // Identical acknowledgement regardless of whether a session was found/revoked.
      return finalize(requestId, success({ acknowledged: true }, requestId));
    } catch {
      if (idempotencyRecordId && deps.security && nowForFailure != null) {
        await deps.security.failIdempotency(idempotencyRecordId, nowForFailure).catch(() => undefined);
      }
      return finalize(requestId, internalFailure(requestId));
    }
  };
}
