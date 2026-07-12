import { getCurrentUser } from "@/lib/auth";
import {
  makeRequireAuthenticatedUser,
  makeRequireActiveVerifiedUser,
  type GuardUser
} from "./guards";

/**
 * Real guard wiring for /api/v1 (imports @/lib/auth, so kept OUT of the pure
 * barrel and out of node:test). Both guards reuse the single trusted
 * `getCurrentUser` (secure Web cookie + sessionVersion revocation); neither
 * parses Authorization / Bearer tokens or trusts a client-supplied userId.
 */
const getUser = async (): Promise<GuardUser | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  return { id: user.id, status: user.status, emailVerifiedAt: user.emailVerifiedAt };
};

/** Auth-only — for GET /api/v1/me (a pending user may read their own status). */
export const requireAuthenticatedUser = makeRequireAuthenticatedUser(getUser);

/** Active + email-verified — required by the sensitive read endpoints. */
export const requireActiveVerifiedUser = makeRequireActiveVerifiedUser(getUser);
