-- Batch 2.2E: allow the "issue" mobile-auth endpoint in the security-control tables.
-- Additive only: drops and re-adds each endpoint CHECK constraint with 'issue' added.
-- No columns/tables removed; no existing rows changed.

ALTER TABLE "MobileAuthRateLimitBucket" DROP CONSTRAINT "MobileAuthRateLimitBucket_endpoint_check";
ALTER TABLE "MobileAuthRateLimitBucket" ADD CONSTRAINT "MobileAuthRateLimitBucket_endpoint_check" CHECK ("endpoint" IN ('refresh', 'logout', 'logout-all', 'issue'));

ALTER TABLE "MobileAuthIdempotencyRecord" DROP CONSTRAINT "MobileAuthIdempotencyRecord_endpoint_check";
ALTER TABLE "MobileAuthIdempotencyRecord" ADD CONSTRAINT "MobileAuthIdempotencyRecord_endpoint_check" CHECK ("endpoint" IN ('refresh', 'logout', 'logout-all', 'issue'));

ALTER TABLE "MobileAuthAuditLog" DROP CONSTRAINT "MobileAuthAuditLog_endpoint_check";
ALTER TABLE "MobileAuthAuditLog" ADD CONSTRAINT "MobileAuthAuditLog_endpoint_check" CHECK ("endpoint" IS NULL OR "endpoint" IN ('refresh', 'logout', 'logout-all', 'issue'));
