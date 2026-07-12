import { createMeHandler } from "@/lib/api-v1";
import { requireAuthenticatedUser } from "@/lib/api-v1/session";
import { toNextResponse } from "@/lib/api-v1/http";

/**
 * GET /api/v1/me — safe profile for the current Web-authenticated user.
 * Auth-only (a pending user may read their own status). Thin adapter over the
 * tested handler factory.
 */
const handler = createMeHandler({ requireUser: requireAuthenticatedUser });

export async function GET() {
  return toNextResponse(await handler());
}
