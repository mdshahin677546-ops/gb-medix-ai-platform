-- BETA-0A — Minimal RBAC + immutable admin audit foundation.
-- Additive only: adds the Role enum, User.role (default USER, backfills existing
-- rows), and the append-only AdminAuditLog table. No existing column or table is
-- dropped, renamed, or altered. (prisma migrate dev also surfaced pre-existing
-- baseline drift on AIReport.followUpPlan / MobileAuthRateLimitBucket.updatedAt /
-- an AIProcessingConsent index; those are unrelated to BETA-0A and out of the
-- authorized scope, so they are intentionally NOT included here.)

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- AlterTable: add non-null role with a safe least-privilege default. Existing
-- users are backfilled to USER by the DEFAULT.
ALTER TABLE "User" ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'USER';

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "requestId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminAuditLog_actorUserId_idx" ON "AdminAuditLog"("actorUserId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_action_idx" ON "AdminAuditLog"("action");

-- CreateIndex
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");

-- AddForeignKey: actor is a real DB user; RESTRICT prevents silently erasing
-- audit evidence when a user row is deleted (user deletion is out of scope for
-- BETA-0A; a later batch must explicitly reconcile audit retention).
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- BETA-0A — Database-level append-only immutability for AdminAuditLog.
-- INSERT stays allowed; every row-level UPDATE and DELETE is rejected so audit
-- evidence cannot be tampered with or erased by application code or a compromised
-- session. A full `prisma migrate reset` / DROP recreates the table cleanly (DROP
-- is not a row mutation and is unaffected).
CREATE OR REPLACE FUNCTION "gbmedix_adminauditlog_block_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AdminAuditLog is append-only: % is not permitted', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "adminauditlog_block_update"
  BEFORE UPDATE ON "AdminAuditLog"
  FOR EACH ROW EXECUTE FUNCTION "gbmedix_adminauditlog_block_mutation"();

CREATE TRIGGER "adminauditlog_block_delete"
  BEFORE DELETE ON "AdminAuditLog"
  FOR EACH ROW EXECUTE FUNCTION "gbmedix_adminauditlog_block_mutation"();
