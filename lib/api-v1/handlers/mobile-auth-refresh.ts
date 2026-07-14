import { newRequestId } from "../request-context";
import { success, failure, internalFailure } from "../failure";
import { finalize, type HandlerResult } from "../handler-result";
import {
  mobileRefreshRequestSchema,
  mobileRefreshResultSchema,
  type MobileRefreshResult
} from "../../api-contract/v1/mobile-auth";
import { hashRefreshToken, generateRefreshToken } from "../../mobile-auth/v1/refresh-token";
import { evaluateRefreshAttempt, classifyRefreshLookup } from "../../mobile-auth/v1/rotation";
import { evaluateMobileUserEligibility, type MobileUserFacts } from "../../mobile-auth/v1/eligibility";
import { buildAccessTokenClaims, signAccessToken } from "../../mobile-auth/v1/access-token-sign";
import { buildMobileAuthAuditEvent } from "../../mobile-auth/v1/audit";
import type { DeviceSession } from "../../mobile-auth/v1/device-session";
import type { RotateInput, RotateResult } from "../../mobile-auth/v1/store";

/**
 * POST /api/v1/mobile/auth/refresh handler factory (Batch 2.2C).
 *
 * Rotates a device session's refresh token and issues a fresh access token. Store
 * operations are INJECTED (bound to the Prisma store in production, to a fake in
 * tests) so the handler is store-agnostic and runs under node:test with no DB.
 *
 * Security: the presented refresh plaintext is used ONLY to compute a hash and is
 * then discarded — never stored, logged, or audited. A replayed (consumed) token
 * revokes the whole token family. Eligibility is decided by server facts only.
 * The NEW refresh plaintext is returned to the caller EXACTLY once and never
 * enters a store, log, or audit event. All failure branches return coarse,
 * non-oracle error codes.
 */
export type MobileRefreshDeps = {
  now: () => number;
  pepper: string;
  signingKey: string;
  issuer: string;
  audience: string;
  accessTtlSeconds: number;
  refreshIdleTtlSeconds: number;
  /** Consumed-token replay detection + family revocation (atomic in the real store). */
  revokeFamilyOnReplay: (refreshTokenHash: string, now: number) => Promise<{ replay: boolean; revokedCount: number }>;
  findCurrentByHash: (refreshTokenHash: string) => Promise<DeviceSession | null>;
  rotate: (input: RotateInput) => Promise<RotateResult>;
  getUserFacts: (userId: string) => Promise<MobileUserFacts | null>;
  newTokenId: () => string;
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

export function createMobileRefreshHandler(deps: MobileRefreshDeps) {
  return async function POST(input: { body: unknown }): Promise<HandlerResult> {
    const requestId = newRequestId();
    try {
      const parsed = mobileRefreshRequestSchema.safeParse(input.body);
      if (!parsed.success) return finalize(requestId, failure("VALIDATION_ERROR", requestId));

      const now = deps.now();
      const presentedHash = hashRefreshToken(parsed.data.refreshToken, deps.pepper);

      // Replay first: a previously-rotated (consumed) token revokes the family.
      const replay = await deps.revokeFamilyOnReplay(presentedHash, now);
      if (replay.replay) {
        emitAudit(deps.audit, { event: "mobile_refresh_replay_detected", occurredAt: now, reason: "replay_detected" });
        return finalize(requestId, failure("AUTH_REQUIRED", requestId));
      }

      const current: DeviceSession | null = await deps.findCurrentByHash(presentedHash);
      const decision = evaluateRefreshAttempt(classifyRefreshLookup(current, null), now);
      if (decision.action !== "rotate" || !current) {
        return finalize(requestId, failure("AUTH_REQUIRED", requestId));
      }

      // Server-side eligibility only (active + verified); a client cannot override.
      const facts = await deps.getUserFacts(current.userId);
      if (!facts) return finalize(requestId, failure("AUTH_REQUIRED", requestId));
      const eligible = evaluateMobileUserEligibility(facts, facts.sessionVersion);
      if (!eligible.ok) return finalize(requestId, failure("AUTH_REQUIRED", requestId));

      const newRefreshToken = generateRefreshToken();
      const newRefreshTokenHash = hashRefreshToken(newRefreshToken, deps.pepper);
      const rotateResult = await deps.rotate({
        sessionId: decision.sessionId,
        expectedRotationCounter: decision.expectedRotationCounter,
        expectedCurrentRefreshTokenHash: decision.expectedCurrentRefreshTokenHash,
        newRefreshTokenHash,
        newIdleExpiresAt: now + deps.refreshIdleTtlSeconds,
        now
      });
      if (rotateResult.status === "conflict") return finalize(requestId, failure("CONFLICT", requestId));
      if (rotateResult.status !== "rotated") return finalize(requestId, failure("AUTH_REQUIRED", requestId));

      const accessToken = signAccessToken(
        buildAccessTokenClaims({
          userId: current.userId,
          deviceSessionId: decision.sessionId,
          sessionVersion: facts.sessionVersion,
          tokenId: deps.newTokenId(),
          issuer: deps.issuer,
          audience: deps.audience,
          issuedAt: now,
          ttlSeconds: deps.accessTtlSeconds
        }),
        deps.signingKey
      );

      const result: MobileRefreshResult = mobileRefreshResultSchema.parse({
        accessToken,
        refreshToken: newRefreshToken, // returned exactly once; never logged/audited
        accessTokenExpiresInSeconds: deps.accessTtlSeconds,
        deviceSessionId: decision.sessionId
      });
      emitAudit(deps.audit, {
        event: "mobile_refresh_rotated",
        occurredAt: now,
        userId: current.userId,
        deviceSessionId: decision.sessionId,
        reason: "rotated"
      });
      return finalize(requestId, success(result, requestId));
    } catch {
      return finalize(requestId, internalFailure(requestId));
    }
  };
}
