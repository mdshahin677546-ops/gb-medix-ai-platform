-- Add IP attribution to AIUsage so AI rate limiting can be enforced from the
-- database (persistent across serverless cold starts and multiple instances),
-- and so per-IP budgets cap abuse even when an attacker creates many accounts.

ALTER TABLE "AIUsage" ADD COLUMN "ip" TEXT NOT NULL DEFAULT 'unknown';

CREATE INDEX "AIUsage_ip_idx" ON "AIUsage"("ip");
