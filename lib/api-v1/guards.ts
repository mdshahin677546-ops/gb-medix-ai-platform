import { failure, type ApiFailure } from "./failure";

/**
 * Two-tier session guards (pure factories — a `getUser` dependency is injected so
 * the real guards run under node:test with a mock and the routes bind the real
 * `getCurrentUser`). Neither guard trusts a client-supplied status / verified
 * flag / userId, and neither parses an Authorization header.
 */

export type GuardUser = { id: string; status: string; emailVerifiedAt: Date | string | null };
export type GetUser = () => Promise<GuardUser | null>;
export type GuardResult = { ok: true; user: GuardUser } | { ok: false; failure: ApiFailure };
export type Guard = (requestId: string) => Promise<GuardResult>;

/**
 * Signed-in only. Used by GET /api/v1/me so a pending user can still read their
 * own safe status to drive the email-verification UI.
 */
export function makeRequireAuthenticatedUser(getUser: GetUser): Guard {
  return async (requestId) => {
    const user = await getUser();
    if (!user) return { ok: false, failure: failure("AUTH_REQUIRED", requestId) };
    return { ok: true, user };
  };
}

/**
 * Signed-in AND email-verified (status === "active" && emailVerifiedAt != null).
 * Used by the sensitive read endpoints; an unverified user gets 403
 * EMAIL_VERIFICATION_REQUIRED (never treated as active).
 */
export function makeRequireActiveVerifiedUser(getUser: GetUser): Guard {
  const base = makeRequireAuthenticatedUser(getUser);
  return async (requestId) => {
    const res = await base(requestId);
    if (!res.ok) return res;
    const { user } = res;
    if (user.status !== "active" || user.emailVerifiedAt == null) {
      return { ok: false, failure: failure("EMAIL_VERIFICATION_REQUIRED", requestId) };
    }
    return { ok: true, user };
  };
}
