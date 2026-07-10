-- Add a per-user session version for bulk session revocation (logout-all,
-- email/credential change, security response). Existing rows default to 1,
-- matching the schema default, so already-issued sessions remain valid until
-- the version is bumped via invalidateUserSessions().
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 1;
