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

export function createMobileLogoutHandler(deps: MobileLogoutDeps) {
  return async function POST(input: { body: unknown }): Promise<HandlerResult> {
    const requestId = newRequestId();
    try {
      const parsed = mobileLogoutRequestSchema.safeParse(input.body);
      if (!parsed.success) return finalize(requestId, failure("VALIDATION_ERROR", requestId));

      const now = deps.now();
      const presentedHash = hashRefreshToken(parsed.data.refreshToken, deps.pepper);
      const current = await deps.findCurrentByHash(presentedHash);

      if (current && current.status === "active") {
        await deps.revokeSession(current.id, "user_logout", now);
        emitAudit(deps.audit, {
          event: "mobile_session_revoked",
          occurredAt: now,
          userId: current.userId,
          deviceSessionId: current.id,
          reason: "user_logout"
        });
      }

      // Identical acknowledgement regardless of whether a session was found/revoked.
      return finalize(requestId, success({ acknowledged: true }, requestId));
    } catch {
      return finalize(requestId, internalFailure(requestId));
    }
  };
}
