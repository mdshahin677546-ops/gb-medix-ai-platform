-- Batch 2.2B — DeviceSession persistence + consumed refresh-token history.
-- Additive only: creates two new tables with indexes, foreign keys, unique
-- constraints, and CHECK constraints. No existing table/column is dropped,
-- renamed, or rewritten.

-- CreateTable
CREATE TABLE "DeviceSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenFamilyId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "rotationCounter" INTEGER NOT NULL DEFAULT 0,
    "refreshTokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL,
    "idleExpiresAt" TIMESTAMP(3) NOT NULL,
    "absoluteExpiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,

    CONSTRAINT "DeviceSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsumedRefreshToken" (
    "id" TEXT NOT NULL,
    "deviceSessionId" TEXT NOT NULL,
    "tokenFamilyId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "consumedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsumedRefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeviceSession_refreshTokenHash_key" ON "DeviceSession"("refreshTokenHash");
-- tokenFamilyId is GLOBALLY unique: a token family belongs to exactly one session.
CREATE UNIQUE INDEX "DeviceSession_tokenFamilyId_key" ON "DeviceSession"("tokenFamilyId");
CREATE UNIQUE INDEX "DeviceSession_id_tokenFamilyId_key" ON "DeviceSession"("id", "tokenFamilyId");
CREATE INDEX "DeviceSession_userId_idx" ON "DeviceSession"("userId");
CREATE INDEX "DeviceSession_status_idx" ON "DeviceSession"("status");
CREATE INDEX "DeviceSession_idleExpiresAt_idx" ON "DeviceSession"("idleExpiresAt");
CREATE INDEX "DeviceSession_absoluteExpiresAt_idx" ON "DeviceSession"("absoluteExpiresAt");
CREATE INDEX "DeviceSession_userId_status_idx" ON "DeviceSession"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumedRefreshToken_refreshTokenHash_key" ON "ConsumedRefreshToken"("refreshTokenHash");
CREATE INDEX "ConsumedRefreshToken_deviceSessionId_idx" ON "ConsumedRefreshToken"("deviceSessionId");
CREATE INDEX "ConsumedRefreshToken_tokenFamilyId_idx" ON "ConsumedRefreshToken"("tokenFamilyId");
CREATE INDEX "ConsumedRefreshToken_expiresAt_idx" ON "ConsumedRefreshToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "DeviceSession" ADD CONSTRAINT "DeviceSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConsumedRefreshToken" ADD CONSTRAINT "ConsumedRefreshToken_deviceSessionId_tokenFamilyId_fkey" FOREIGN KEY ("deviceSessionId", "tokenFamilyId") REFERENCES "DeviceSession"("id", "tokenFamilyId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddCheckConstraint: the database itself restricts status, counter range, hash
-- format, and the time-boundary invariants (mirroring the pure-function foundation).
ALTER TABLE "DeviceSession" ADD CONSTRAINT "DeviceSession_status_check" CHECK ("status" IN ('active', 'revoked', 'expired', 'compromised'));
ALTER TABLE "DeviceSession" ADD CONSTRAINT "DeviceSession_rotationCounter_range_check" CHECK ("rotationCounter" >= 0 AND "rotationCounter" <= 2147483646);
ALTER TABLE "DeviceSession" ADD CONSTRAINT "DeviceSession_refreshTokenHash_format_check" CHECK ("refreshTokenHash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "DeviceSession" ADD CONSTRAINT "DeviceSession_created_le_lastUsed_check" CHECK ("createdAt" <= "lastUsedAt");
ALTER TABLE "DeviceSession" ADD CONSTRAINT "DeviceSession_idle_gt_created_check" CHECK ("idleExpiresAt" > "createdAt");
ALTER TABLE "DeviceSession" ADD CONSTRAINT "DeviceSession_absolute_gt_created_check" CHECK ("absoluteExpiresAt" > "createdAt");
ALTER TABLE "DeviceSession" ADD CONSTRAINT "DeviceSession_idle_le_absolute_check" CHECK ("idleExpiresAt" <= "absoluteExpiresAt");
ALTER TABLE "DeviceSession" ADD CONSTRAINT "DeviceSession_revokeReason_check" CHECK ("revokeReason" IS NULL OR "revokeReason" IN ('user_logout', 'user_logout_all', 'refresh_replay', 'token_family_revoked', 'session_version_bump', 'compromised', 'admin', 'expired'));
ALTER TABLE "DeviceSession" ADD CONSTRAINT "DeviceSession_active_no_revocation_check" CHECK ("status" <> 'active' OR ("revokedAt" IS NULL AND "revokeReason" IS NULL));

-- AddCheckConstraint: consumed hash format + consumedAt not after its own expiry.
-- The cross-table rule (consumed.expiresAt <= owning session absoluteExpiresAt)
-- cannot be a plain CHECK (no subqueries); it is enforced by the transactional
-- store, which derives expiresAt from the session's absoluteExpiresAt.
ALTER TABLE "ConsumedRefreshToken" ADD CONSTRAINT "ConsumedRefreshToken_hash_format_check" CHECK ("refreshTokenHash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "ConsumedRefreshToken" ADD CONSTRAINT "ConsumedRefreshToken_consumed_le_expires_check" CHECK ("consumedAt" <= "expiresAt");
