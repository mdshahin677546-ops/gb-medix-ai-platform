import { buildMobileAuthAuditEvent, type MobileAuthAuditEvent } from "./audit";
import { randomUUID } from "crypto";
import {
  DEFAULT_MOBILE_AUTH_RATE_LIMITS,
  IDEMPOTENCY_TTL_SECONDS,
  actorDigest,
  canonicalRequestDigest,
  credentialDigest,
  idempotencyKeyDigest,
  rateLimitBucketKey,
  safeRetryAfterSeconds,
  type MobileAuthEndpoint,
  type MobileAuthRateLimitPolicy
} from "./security-controls";

type Queryable = {
  $queryRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;
};

export type SecurityTransactionClient = Queryable;

export type MobileAuthSecurityPrisma = Queryable & {
  $transaction: <T>(fn: (tx: SecurityTransactionClient) => Promise<T>) => Promise<T>;
};

type IdempotencyRow = {
  id: string;
  endpoint: MobileAuthEndpoint;
  keyDigest: string;
  actorDigest: string;
  credentialDigest: string;
  requestDigest: string;
  status: "in_progress" | "completed" | "failed";
  expiresAt: Date;
};

type RateLimitRow = {
  id: string;
  count: number;
  windowStart: Date;
  windowSeconds: number;
};

export type IdempotencyClaimResult =
  | { status: "claimed"; id: string }
  | { status: "completed"; id: string }
  | { status: "conflict" };

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSeconds: number };

function fromEpochSeconds(seconds: number): Date {
  return new Date(seconds * 1000);
}

function toEpochSeconds(value: Date): number {
  return Math.floor(value.getTime() / 1000);
}

export async function insertMobileAuthAudit(
  tx: SecurityTransactionClient,
  input: MobileAuthAuditEvent & { outcome: NonNullable<MobileAuthAuditEvent["outcome"]> }
): Promise<void> {
  const event = buildMobileAuthAuditEvent(input);
  if (!event.outcome) throw new Error("Invalid or forbidden mobile auth audit event.");
  await tx.$queryRaw`
    INSERT INTO "MobileAuthAuditLog"
      ("id", "event", "reason", "outcome", "occurredAt", "userId", "deviceSessionId", "tokenFamilyId")
    VALUES
      (${randomUUID()}, ${event.event}, ${event.reason ?? null}, ${event.outcome}, ${fromEpochSeconds(event.occurredAt)},
       ${event.userId ?? null}, ${event.deviceSessionId ?? null}, ${event.tokenFamilyId ?? null})
    RETURNING "id"
  `;
}

export async function completeMobileAuthIdempotency(
  tx: SecurityTransactionClient,
  id: string,
  now: number
): Promise<void> {
  await tx.$queryRaw`
    UPDATE "MobileAuthIdempotencyRecord"
    SET "status" = 'completed', "completedAt" = ${fromEpochSeconds(now)}
    WHERE "id" = ${id} AND "status" = 'in_progress'
    RETURNING "id"
  `;
}

export class PrismaMobileAuthSecurityControls {
  constructor(
    private readonly prisma: MobileAuthSecurityPrisma,
    private readonly controlKey: string,
    private readonly rateLimits: Record<MobileAuthEndpoint, MobileAuthRateLimitPolicy> =
      DEFAULT_MOBILE_AUTH_RATE_LIMITS
  ) {}

  keyDigest(rawKey: string): string {
    return idempotencyKeyDigest(this.controlKey, rawKey);
  }

  credentialDigest(value: string): string {
    return credentialDigest(this.controlKey, value);
  }

  actorDigest(value: string): string {
    return actorDigest(this.controlKey, value);
  }

  requestDigest(endpoint: MobileAuthEndpoint, body: Record<string, unknown>): string {
    return canonicalRequestDigest(this.controlKey, endpoint, body);
  }

  async claimIdempotency(input: {
    endpoint: MobileAuthEndpoint;
    rawKey: string;
    actorDigest: string;
    credentialDigest: string;
    requestDigest: string;
    now: number;
  }): Promise<IdempotencyClaimResult> {
    const keyDigest = this.keyDigest(input.rawKey);
    const expiresAt = fromEpochSeconds(input.now + IDEMPOTENCY_TTL_SECONDS);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${keyDigest}, 17::bigint))) _l`;
      const delegate = (tx as unknown as {
        mobileAuthIdempotencyRecord?: {
          findUnique: (args: { where: { keyDigest: string } }) => Promise<IdempotencyRow | null>;
          delete: (args: { where: { id: string } }) => Promise<unknown>;
          create: (args: {
            data: {
              endpoint: MobileAuthEndpoint;
              keyDigest: string;
              actorDigest: string;
              credentialDigest: string;
              requestDigest: string;
              status: "in_progress";
              expiresAt: Date;
            };
          }) => Promise<{ id: string }>;
        };
      }).mobileAuthIdempotencyRecord;
      if (delegate) {
        const existing = await delegate.findUnique({ where: { keyDigest } });
        if (existing) {
          if (toEpochSeconds(existing.expiresAt) <= input.now) {
            await delegate.delete({ where: { id: existing.id } });
          } else {
            const sameBinding =
              existing.endpoint === input.endpoint &&
              existing.actorDigest === input.actorDigest &&
              existing.credentialDigest === input.credentialDigest &&
              existing.requestDigest === input.requestDigest;
            if (!sameBinding || existing.status !== "completed") {
              await insertMobileAuthAudit(tx, {
                event: "mobile_auth_idempotency_conflict",
                occurredAt: input.now,
                reason: "idempotency_conflict",
                outcome: "conflict"
              });
              return { status: "conflict" };
            }
            return { status: "completed", id: existing.id };
          }
        }
        const created = await delegate.create({
          data: {
            endpoint: input.endpoint,
            keyDigest,
            actorDigest: input.actorDigest,
            credentialDigest: input.credentialDigest,
            requestDigest: input.requestDigest,
            status: "in_progress",
            expiresAt
          }
        });
        return { status: "claimed", id: created.id };
      }
      const rows = (await tx.$queryRaw`
        SELECT "id", "endpoint", "keyDigest", "actorDigest", "credentialDigest", "requestDigest", "status", "expiresAt"
        FROM "MobileAuthIdempotencyRecord"
        WHERE "keyDigest" = ${keyDigest}
        FOR UPDATE
      `) as IdempotencyRow[];
      const existing = rows[0];
      if (existing) {
        if (toEpochSeconds(existing.expiresAt) <= input.now) {
          await tx.$queryRaw`DELETE FROM "MobileAuthIdempotencyRecord" WHERE "id" = ${existing.id} RETURNING "id"`;
        } else {
          const sameBinding =
            existing.endpoint === input.endpoint &&
            existing.actorDigest === input.actorDigest &&
            existing.credentialDigest === input.credentialDigest &&
            existing.requestDigest === input.requestDigest;
          if (!sameBinding || existing.status !== "completed") {
            await insertMobileAuthAudit(tx, {
              event: "mobile_auth_idempotency_conflict",
              occurredAt: input.now,
              reason: "idempotency_conflict",
              outcome: "conflict"
            });
            return { status: "conflict" };
          }
          return { status: "completed", id: existing.id };
        }
      }
      const inserted = (await tx.$queryRaw`
        INSERT INTO "MobileAuthIdempotencyRecord"
          ("id", "endpoint", "keyDigest", "actorDigest", "credentialDigest", "requestDigest", "status", "expiresAt")
        VALUES
          (${randomUUID()}, ${input.endpoint}, ${keyDigest}, ${input.actorDigest}, ${input.credentialDigest},
           ${input.requestDigest}, 'in_progress', ${expiresAt})
        RETURNING "id"
      `) as Array<{ id: string }>;
      return { status: "claimed", id: inserted[0].id };
    });
  }

  async failIdempotency(id: string, now: number): Promise<void> {
    await this.prisma.$queryRaw`
      UPDATE "MobileAuthIdempotencyRecord"
      SET "status" = 'failed', "completedAt" = ${fromEpochSeconds(now)}
      WHERE "id" = ${id} AND "status" = 'in_progress'
      RETURNING "id"
    `;
  }

  async completeIdempotency(id: string, now: number): Promise<void> {
    const delegate = (this.prisma as unknown as {
      mobileAuthIdempotencyRecord?: {
        updateMany: (args: {
          where: { id: string; status: "in_progress" };
          data: { status: "completed"; completedAt: Date };
        }) => Promise<unknown>;
      };
    }).mobileAuthIdempotencyRecord;
    if (delegate) {
      await delegate.updateMany({
        where: { id, status: "in_progress" },
        data: { status: "completed", completedAt: fromEpochSeconds(now) }
      });
      return;
    }
    await completeMobileAuthIdempotency(this.prisma, id, now);
  }

  async checkRateLimit(input: {
    endpoint: MobileAuthEndpoint;
    subjectDigest: string;
    now: number;
    userId?: string;
  }): Promise<RateLimitResult> {
    const policy = this.rateLimits[input.endpoint];
    const windowStart = Math.floor(input.now / policy.windowSeconds) * policy.windowSeconds;
    const bucketKey = rateLimitBucketKey(this.controlKey, input.endpoint, `${input.subjectDigest}:${windowStart}`);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${bucketKey}, 29::bigint))) _l`;
      const rows = (await tx.$queryRaw`
        SELECT "id", "count", "windowStart", "windowSeconds"
        FROM "MobileAuthRateLimitBucket"
        WHERE "bucketKey" = ${bucketKey}
        FOR UPDATE
      `) as RateLimitRow[];
      const existing = rows[0];
      if (!existing) {
        await tx.$queryRaw`
          INSERT INTO "MobileAuthRateLimitBucket"
            ("id", "endpoint", "subjectDigest", "bucketKey", "windowStart", "windowSeconds", "count", "expiresAt", "userId")
          VALUES
            (${randomUUID()}, ${input.endpoint}, ${input.subjectDigest}, ${bucketKey}, ${fromEpochSeconds(windowStart)},
             ${policy.windowSeconds}, 1, ${fromEpochSeconds(windowStart + policy.windowSeconds * 2)}, ${input.userId ?? null})
          RETURNING "id"
        `;
        return { ok: true, remaining: policy.maxRequests - 1 };
      }
      if (existing.count >= policy.maxRequests) {
        await insertMobileAuthAudit(tx, {
          event: "mobile_auth_rate_limited",
          occurredAt: input.now,
          reason: "rate_limited",
          outcome: "rate_limited",
          ...(input.userId ? { userId: input.userId } : {})
        });
        return {
          ok: false,
          retryAfterSeconds: safeRetryAfterSeconds(input.now, windowStart, policy.windowSeconds)
        };
      }
      await tx.$queryRaw`
        UPDATE "MobileAuthRateLimitBucket"
        SET "count" = "count" + 1, "updatedAt" = ${fromEpochSeconds(input.now)}
        WHERE "id" = ${existing.id}
        RETURNING "id"
      `;
      return { ok: true, remaining: policy.maxRequests - existing.count - 1 };
    });
  }
}
