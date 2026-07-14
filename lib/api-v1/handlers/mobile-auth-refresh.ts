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
  revokeFamilyOnReplayWithAudit?: (
    refreshTokenHash: string,
    now: number,
    audit: { event: "mobile_refresh_replay_detected"; occurredAt: number; reason: "replay_detected"; outcome: "denied" },
    idempotencyRecordId?: string
  ) => Promise<{ replay: boolean; revokedCount: number }>;
  findCurrentByHash: (refreshTokenHash: string) => Promise<DeviceSession | null>;
  rotate: (input: RotateInput) => Promise<RotateResult>;
  rotateWithAudit?: (
    input: RotateInput,
    audit: {
      event: "mobile_refresh_rotated";
      occurredAt: number;
      userId: string;
      deviceSessionId: string;
      reason: "rotated";
      outcome: "success";
    },
    idempotencyRecordId?: string
  ) => Promise<RotateResult>;
  getUserFacts: (userId: string) => Promise<MobileUserFacts | null>;
  newTokenId: () => string;
  audit?: (event: unknown) => void;
  security?: {
    credentialDigest: (value: string) => string;
    requestDigest: (endpoint: "refresh", body: Record<string, unknown>) => string;
    checkRateLimit: (input: { endpoint: "refresh"; subjectDigest: string; now: number }) => Promise<
      { ok: true } | { ok: false; retryAfterSeconds: number }
    >;
    claimIdempotency: (input: {
      endpoint: "refresh";
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

export function createMobileRefreshHandler(deps: MobileRefreshDeps) {
  return async function POST(input: { body: unknown; idempotencyKey?: string }): Promise<HandlerResult> {
    const requestId = newRequestId();
    let idempotencyRecordId: string | undefined;
    let nowForFailure: number | null = null;
    try {
      const parsed = mobileRefreshRequestSchema.safeParse(input.body);
      if (!parsed.success) return finalize(requestId, failure("VALIDATION_ERROR", requestId));

      const now = deps.now();
      nowForFailure = now;
      const presentedHash = hashRefreshToken(parsed.data.refreshToken, deps.pepper);

      if (deps.security && input.idempotencyKey) {
        const subjectDigest = deps.security.credentialDigest(presentedHash);
        const limited = await deps.security.checkRateLimit({ endpoint: "refresh", subjectDigest, now });
        if (!limited.ok) {
          return finalize(requestId, failure("RATE_LIMITED", requestId), { retryAfterSeconds: limited.retryAfterSeconds });
        }
        const claim = await deps.security.claimIdempotency({
          endpoint: "refresh",
          rawKey: input.idempotencyKey,
          actorDigest: subjectDigest,
          credentialDigest: subjectDigest,
          requestDigest: deps.security.requestDigest("refresh", parsed.data),
          now
        });
        if (claim.status === "conflict" || claim.status === "completed") {
          return finalize(requestId, failure("CONFLICT", requestId));
        }
        idempotencyRecordId = claim.id;
      }

      // Replay first: a previously-rotated (consumed) token revokes the family.
      const replayAudit = {
        event: "mobile_refresh_replay_detected" as const,
        occurredAt: now,
        reason: "replay_detected" as const,
        outcome: "denied" as const
      };
      const replay = deps.revokeFamilyOnReplayWithAudit
        ? await deps.revokeFamilyOnReplayWithAudit(presentedHash, now, replayAudit, idempotencyRecordId)
        : await deps.revokeFamilyOnReplay(presentedHash, now);
      if (replay.replay) {
        if (!deps.revokeFamilyOnReplayWithAudit) {
          emitAudit(deps.audit, replayAudit);
          if (idempotencyRecordId && deps.security) await deps.security.completeIdempotency(idempotencyRecordId, now);
        }
        return finalize(requestId, failure("AUTH_REQUIRED", requestId));
      }

      const current: DeviceSession | null = await deps.findCurrentByHash(presentedHash);
      const decision = evaluateRefreshAttempt(classifyRefreshLookup(current, null), now);
      if (decision.action !== "rotate" || !current) {
        if (idempotencyRecordId && deps.security) await deps.security.completeIdempotency(idempotencyRecordId, now);
        return finalize(requestId, failure("AUTH_REQUIRED", requestId));
      }

      // Server-side eligibility only (active + verified); a client cannot override.
      const facts = await deps.getUserFacts(current.userId);
      if (!facts) {
        if (idempotencyRecordId && deps.security) await deps.security.completeIdempotency(idempotencyRecordId, now);
        return finalize(requestId, failure("AUTH_REQUIRED", requestId));
      }
      const eligible = evaluateMobileUserEligibility(facts, facts.sessionVersion);
      if (!eligible.ok) {
        if (idempotencyRecordId && deps.security) await deps.security.completeIdempotency(idempotencyRecordId, now);
        return finalize(requestId, failure("AUTH_REQUIRED", requestId));
      }

      const newRefreshToken = generateRefreshToken();
      const newRefreshTokenHash = hashRefreshToken(newRefreshToken, deps.pepper);
      const rotateInput = {
        sessionId: decision.sessionId,
        expectedRotationCounter: decision.expectedRotationCounter,
        expectedCurrentRefreshTokenHash: decision.expectedCurrentRefreshTokenHash,
        newRefreshTokenHash,
        newIdleExpiresAt: now + deps.refreshIdleTtlSeconds,
        now
      };
      const rotateAudit = {
        event: "mobile_refresh_rotated" as const,
        occurredAt: now,
        userId: current.userId,
        deviceSessionId: decision.sessionId,
        reason: "rotated" as const,
        outcome: "success" as const
      };
      const rotateResult = deps.rotateWithAudit
        ? await deps.rotateWithAudit(rotateInput, rotateAudit, idempotencyRecordId)
        : await deps.rotate(rotateInput);
      if (rotateResult.status === "conflict") {
        if (idempotencyRecordId && deps.security) await deps.security.completeIdempotency(idempotencyRecordId, now);
        return finalize(requestId, failure("CONFLICT", requestId));
      }
      if (rotateResult.status !== "rotated") {
        if (idempotencyRecordId && deps.security) await deps.security.completeIdempotency(idempotencyRecordId, now);
        return finalize(requestId, failure("AUTH_REQUIRED", requestId));
      }

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
      if (!deps.rotateWithAudit) {
        emitAudit(deps.audit, rotateAudit);
        if (idempotencyRecordId && deps.security) await deps.security.completeIdempotency(idempotencyRecordId, now);
      }
      return finalize(requestId, success(result, requestId));
    } catch {
      if (idempotencyRecordId && deps.security && nowForFailure != null) {
        await deps.security.failIdempotency(idempotencyRecordId, nowForFailure).catch(() => undefined);
      }
      return finalize(requestId, internalFailure(requestId));
    }
  };
}
