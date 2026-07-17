// BETA-0A — Server-side RBAC.
//
// Role authority comes ONLY from the database user resolved by the existing
// authoritative session layer (cookie signature + sessionVersion verified, then
// the user row — including `role` — is read from the database). Role is NEVER
// inferred from email, ADMIN_EMAILS, request headers, query, body, or any
// client-cached value. Every failure path is fail-closed and leaks no role,
// admin list, or internal detail.

export const ROLES = ["USER", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

// The minimal shape RBAC needs from a resolved user: an id plus a role that is
// read from the database (typed `unknown` so a legacy/illegal role fails closed
// rather than being trusted). The real resolver returns the full Prisma User.
export type RbacUser = { id: string; role: unknown };

export type GuardOk = { ok: true; user: { id: string; role: Role } };
export type GuardDenied = { ok: false; status: 401 | 403; body: { error: string } };
export type GuardResult = GuardOk | GuardDenied;

const UNAUTHENTICATED: GuardDenied = {
  ok: false,
  status: 401,
  body: { error: "Authentication required." }
};
const FORBIDDEN: GuardDenied = {
  ok: false,
  status: 403,
  body: { error: "Forbidden." }
};

// Pure authorization decision. Fail-closed: a missing user, a non-string/illegal
// role, or a role outside the allow-list is denied. The response body never
// contains the role or the allow-list.
export function authorizeUserRole(
  user: RbacUser | null | undefined,
  allowedRoles: readonly Role[]
): GuardResult {
  if (!user) return UNAUTHENTICATED;
  if (!isRole(user.role)) return FORBIDDEN; // legacy/illegal role → fail closed
  if (!allowedRoles.includes(user.role)) return FORBIDDEN;
  return { ok: true, user: { id: user.id, role: user.role } };
}

// Resolve the current user via the injected authoritative resolver (the route
// passes `getCurrentUser`), then authorize. A resolver/database error fails
// closed as 401 with a fixed safe body — no internal detail is surfaced.
export async function requireRole(
  allowedRoles: readonly Role[],
  resolveUser: () => Promise<RbacUser | null>
): Promise<GuardResult> {
  let user: RbacUser | null;
  try {
    user = await resolveUser();
  } catch {
    return UNAUTHENTICATED;
  }
  return authorizeUserRole(user, allowedRoles);
}

// The guard interface accepts multiple allowed roles for future callers; BETA-0A
// only uses ADMIN.
export function requireAdmin(
  resolveUser: () => Promise<RbacUser | null>
): Promise<GuardResult> {
  return requireRole(["ADMIN"], resolveUser);
}
