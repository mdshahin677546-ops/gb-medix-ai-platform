-- Batch 2.2D - Mobile auth API security controls.
-- Additive only: creates rate-limit, idempotency, and audit tables with
-- indexes and CHECK constraints. No existing table/column is dropped, renamed,
-- or rewritten. These tables store only de-identified digests and controlled
-- enum state; never raw tokens, Authorization headers, Idempotency-Key values,
-- request JSON, cookies, email, phone, patient, health, payment, provider,
-- pepper, signing keys, or SQL/error text.

CREATE TABLE "MobileAuthRateLimitBucket" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "subjectDigest" TEXT NOT NULL,
    "bucketKey" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowSeconds" INTEGER NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "MobileAuthRateLimitBucket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MobileAuthIdempotencyRecord" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "keyDigest" TEXT NOT NULL,
    "actorDigest" TEXT NOT NULL,
    "credentialDigest" TEXT NOT NULL,
    "requestDigest" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "MobileAuthIdempotencyRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MobileAuthAuditLog" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "reason" TEXT,
    "outcome" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,
    "deviceSessionId" TEXT,
    "tokenFamilyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MobileAuthAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MobileAuthRateLimitBucket_bucketKey_key" ON "MobileAuthRateLimitBucket"("bucketKey");
CREATE INDEX "MobileAuthRateLimitBucket_endpoint_subjectDigest_idx" ON "MobileAuthRateLimitBucket"("endpoint", "subjectDigest");
CREATE INDEX "MobileAuthRateLimitBucket_expiresAt_idx" ON "MobileAuthRateLimitBucket"("expiresAt");
CREATE INDEX "MobileAuthRateLimitBucket_userId_idx" ON "MobileAuthRateLimitBucket"("userId");

CREATE UNIQUE INDEX "MobileAuthIdempotencyRecord_keyDigest_key" ON "MobileAuthIdempotencyRecord"("keyDigest");
CREATE INDEX "MobileAuthIdempotencyRecord_endpoint_idx" ON "MobileAuthIdempotencyRecord"("endpoint");
CREATE INDEX "MobileAuthIdempotencyRecord_actorDigest_idx" ON "MobileAuthIdempotencyRecord"("actorDigest");
CREATE INDEX "MobileAuthIdempotencyRecord_credentialDigest_idx" ON "MobileAuthIdempotencyRecord"("credentialDigest");
CREATE INDEX "MobileAuthIdempotencyRecord_expiresAt_idx" ON "MobileAuthIdempotencyRecord"("expiresAt");
CREATE INDEX "MobileAuthIdempotencyRecord_status_idx" ON "MobileAuthIdempotencyRecord"("status");

CREATE INDEX "MobileAuthAuditLog_event_idx" ON "MobileAuthAuditLog"("event");
CREATE INDEX "MobileAuthAuditLog_outcome_idx" ON "MobileAuthAuditLog"("outcome");
CREATE INDEX "MobileAuthAuditLog_occurredAt_idx" ON "MobileAuthAuditLog"("occurredAt");
CREATE INDEX "MobileAuthAuditLog_userId_idx" ON "MobileAuthAuditLog"("userId");
CREATE INDEX "MobileAuthAuditLog_deviceSessionId_idx" ON "MobileAuthAuditLog"("deviceSessionId");
CREATE INDEX "MobileAuthAuditLog_tokenFamilyId_idx" ON "MobileAuthAuditLog"("tokenFamilyId");

ALTER TABLE "MobileAuthRateLimitBucket" ADD CONSTRAINT "MobileAuthRateLimitBucket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MobileAuthRateLimitBucket" ADD CONSTRAINT "MobileAuthRateLimitBucket_endpoint_check" CHECK ("endpoint" IN ('refresh', 'logout', 'logout-all'));
ALTER TABLE "MobileAuthRateLimitBucket" ADD CONSTRAINT "MobileAuthRateLimitBucket_digest_check" CHECK ("subjectDigest" ~ '^[0-9a-f]{64}$' AND "bucketKey" ~ '^[0-9a-f]{64}$');
ALTER TABLE "MobileAuthRateLimitBucket" ADD CONSTRAINT "MobileAuthRateLimitBucket_window_check" CHECK ("windowSeconds" >= 1 AND "windowSeconds" <= 3600);
ALTER TABLE "MobileAuthRateLimitBucket" ADD CONSTRAINT "MobileAuthRateLimitBucket_count_check" CHECK ("count" >= 0 AND "count" <= 1000000);
ALTER TABLE "MobileAuthRateLimitBucket" ADD CONSTRAINT "MobileAuthRateLimitBucket_expiry_check" CHECK ("expiresAt" > "windowStart");

ALTER TABLE "MobileAuthIdempotencyRecord" ADD CONSTRAINT "MobileAuthIdempotencyRecord_endpoint_check" CHECK ("endpoint" IN ('refresh', 'logout', 'logout-all'));
ALTER TABLE "MobileAuthIdempotencyRecord" ADD CONSTRAINT "MobileAuthIdempotencyRecord_digest_check" CHECK (
  "keyDigest" ~ '^[0-9a-f]{64}$' AND
  "actorDigest" ~ '^[0-9a-f]{64}$' AND
  "credentialDigest" ~ '^[0-9a-f]{64}$' AND
  "requestDigest" ~ '^[0-9a-f]{64}$'
);
ALTER TABLE "MobileAuthIdempotencyRecord" ADD CONSTRAINT "MobileAuthIdempotencyRecord_status_check" CHECK ("status" IN ('in_progress', 'completed', 'failed'));
ALTER TABLE "MobileAuthIdempotencyRecord" ADD CONSTRAINT "MobileAuthIdempotencyRecord_expiry_check" CHECK ("expiresAt" > "createdAt");
ALTER TABLE "MobileAuthIdempotencyRecord" ADD CONSTRAINT "MobileAuthIdempotencyRecord_completed_check" CHECK (
  ("status" = 'completed' AND "completedAt" IS NOT NULL) OR
  ("status" <> 'completed')
);

ALTER TABLE "MobileAuthAuditLog" ADD CONSTRAINT "MobileAuthAuditLog_event_check" CHECK ("event" IN (
  'mobile_auth_rate_limited',
  'mobile_auth_idempotency_conflict',
  'mobile_refresh_rotated',
  'mobile_refresh_replay_detected',
  'mobile_session_revoked',
  'mobile_all_sessions_revoked',
  'mobile_auth_boundary_rejected'
));
ALTER TABLE "MobileAuthAuditLog" ADD CONSTRAINT "MobileAuthAuditLog_reason_check" CHECK ("reason" IS NULL OR "reason" IN (
  'rate_limited',
  'idempotency_conflict',
  'rotated',
  'replay_detected',
  'user_logout',
  'user_logout_all',
  'boundary_rejected',
  'validation_failed',
  'internal_error'
));
ALTER TABLE "MobileAuthAuditLog" ADD CONSTRAINT "MobileAuthAuditLog_outcome_check" CHECK ("outcome" IN ('success', 'denied', 'conflict', 'rate_limited', 'internal_error'));
