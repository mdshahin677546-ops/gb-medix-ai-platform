import { newRequestId } from "../request-context";
import { success, failure, internalFailure } from "../failure";
import { finalize, type HandlerResult } from "../handler-result";
import { mobileIssueRequestSchema, mobileIssueResultSchema, type MobileIssueResult } from "../../api-contract/v1/mobile-auth";
import { generateRefreshToken, hashRefreshToken } from "../../mobile-auth/v1/refresh-token";
import { buildAccessTokenClaims, signAccessToken } from "../../mobile-auth/v1/access-token-sign";
import type { IssueSessionInput, IssueSessionResult } from "../../mobile-auth/v1/prisma-store";

/**
 * POST /api/v1/mobile/auth/issue handler factory (Batch 2.2E).
 *
 * Exchanges an existing single-use EmailVerification token for a new mobile
 * DeviceSession. The atomic exchange (consume token + activate user + create one
 * session + audit + complete idempotency, all-or-nothing) is INJECTED so the
 * handler is store-agnostic and testable. Authority comes ONLY from the locked
 * EmailVerification + its User — never a cookie, Bearer, or client-supplied
 * userId/email/status/sessionVersion. The new refresh + access tokens are returned
 * EXACTLY once and never persisted; a same-key replay returns a fixed CONFLICT
 * (never re-issues) because token plaintext / the success response are never stored.
 */
type IssueAuditBuilder = (
  userId: string,
  deviceSessionId: string
) => {
  event: "mobile_session_created";
  endpoint: "issue";
  occurredAt: number;
  userId: string;
  deviceSessionId: string;
  reason: "created";
  outcome: "success";
};

export type MobileIssueDeps = {
  now: () => number;
  pepper: string;
  signingKey: string;
  issuer: string;
  audience: string;
  accessTtlSeconds: number;
  refreshIdleTtlSeconds: number;
  refreshAbsoluteTtlSeconds: number;
  exchange: (
    input: IssueSessionInput,
    buildAudit: IssueAuditBuilder,
    idempotencyRecordId?: string
  ) => Promise<IssueSessionResult>;
  newSessionId: () => string;
  newTokenFamilyId: () => string;
  newTokenId: () => string;
  security?: {
    credentialDigest: (value: string) => string;
    requestDigest: (endpoint: "issue", body: Record<string, unknown>) => string;
    checkRateLimit: (input: { endpoint: "issue"; subjectDigest: string; now: number }) => Promise<
      { ok: true } | { ok: false; retryAfterSeconds: number }
    >;
    claimIdempotency: (input: {
      endpoint: "issue";
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

export function createMobileIssueHandler(deps: MobileIssueDeps) {
  return async function POST(input: { body: unknown; idempotencyKey?: string }): Promise<HandlerResult> {
    const requestId = newRequestId();
    let idempotencyRecordId: string | undefined;
    let nowForFailure: number | null = null;
    try {
      const parsed = mobileIssueRequestSchema.safeParse(input.body);
      if (!parsed.success) return finalize(requestId, failure("VALIDATION_ERROR", requestId));

      const now = deps.now();
      nowForFailure = now;
      const verificationToken = parsed.data.verificationToken;

      if (deps.security && input.idempotencyKey) {
        // Subject digest is derived from the verification token (never stored raw).
        const subjectDigest = deps.security.credentialDigest(verificationToken);
        // Rate limit FIRST — a denied request never claims idempotency (see B22D-P1-001).
        const limited = await deps.security.checkRateLimit({ endpoint: "issue", subjectDigest, now });
        if (!limited.ok) {
          return finalize(requestId, failure("RATE_LIMITED", requestId), { retryAfterSeconds: limited.retryAfterSeconds });
        }
        const claim = await deps.security.claimIdempotency({
          endpoint: "issue",
          rawKey: input.idempotencyKey,
          actorDigest: subjectDigest,
          credentialDigest: subjectDigest,
          requestDigest: deps.security.requestDigest("issue", parsed.data),
          now
        });
        // Token plaintext / success JSON are never persisted, so a completed key
        // cannot replay the original tokens: return a fixed, non-sensitive CONFLICT.
        if (claim.status === "conflict" || claim.status === "completed") {
          return finalize(requestId, failure("CONFLICT", requestId));
        }
        idempotencyRecordId = claim.id;
      }

      const refreshToken = generateRefreshToken();
      const refreshTokenHash = hashRefreshToken(refreshToken, deps.pepper);
      const sessionId = deps.newSessionId();
      const buildAudit: IssueAuditBuilder = (userId, deviceSessionId) => ({
        event: "mobile_session_created",
        endpoint: "issue",
        occurredAt: now,
        userId,
        deviceSessionId,
        reason: "created",
        outcome: "success"
      });

      const result = await deps.exchange(
        {
          verificationToken,
          sessionId,
          tokenFamilyId: deps.newTokenFamilyId(),
          refreshTokenHash,
          now,
          idleExpiresAt: now + deps.refreshIdleTtlSeconds,
          absoluteExpiresAt: now + deps.refreshAbsoluteTtlSeconds
        },
        buildAudit,
        idempotencyRecordId
      );

      if (result.status !== "issued") {
        // Invalid / expired / already-consumed token: complete this key (fixed replay
        // contract) and return a coarse, non-oracle auth failure.
        if (idempotencyRecordId && deps.security) await deps.security.completeIdempotency(idempotencyRecordId, now);
        return finalize(requestId, failure("AUTH_REQUIRED", requestId));
      }

      const accessToken = signAccessToken(
        buildAccessTokenClaims({
          userId: result.userId,
          deviceSessionId: sessionId,
          sessionVersion: result.sessionVersion,
          tokenId: deps.newTokenId(),
          issuer: deps.issuer,
          audience: deps.audience,
          issuedAt: now,
          ttlSeconds: deps.accessTtlSeconds
        }),
        deps.signingKey
      );

      const out: MobileIssueResult = mobileIssueResultSchema.parse({
        accessToken,
        refreshToken, // returned exactly once; never stored/logged/audited
        accessTokenExpiresInSeconds: deps.accessTtlSeconds,
        deviceSessionId: sessionId
      });
      return finalize(requestId, success(out, requestId));
    } catch {
      if (idempotencyRecordId && deps.security && nowForFailure != null) {
        await deps.security.failIdempotency(idempotencyRecordId, nowForFailure).catch(() => undefined);
      }
      return finalize(requestId, internalFailure(requestId));
    }
  };
}
