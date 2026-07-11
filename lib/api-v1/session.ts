import { getCurrentUser } from "@/lib/auth";
import { failure, type ApiFailure } from "./failure";

/**
 * Session guard for /api/v1. Reuses the single trusted `getCurrentUser` (secure
 * Web cookie + sessionVersion revocation) — it does NOT parse Authorization /
 * Bearer tokens and never trusts a client-supplied userId. Mobile bearer auth is
 * a separate, later, Codex-reviewed task (BLOCKED here).
 *
 * These are read-only endpoints, so (matching the existing /api/session and
 * /api/reports/[id] read behavior) a signed-in but not-yet-email-verified user
 * may read their own state; email verification is enforced only on write flows
 * such as report generation.
 */
export type AuthedUser = { id: string; status: string; emailVerifiedAt: Date | null };

export async function requireApiUser(
  requestId: string
): Promise<{ ok: true; user: AuthedUser } | { ok: false; failure: ApiFailure }> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, failure: failure("AUTH_REQUIRED", requestId) };
  }
  return {
    ok: true,
    user: { id: user.id, status: user.status, emailVerifiedAt: user.emailVerifiedAt }
  };
}
