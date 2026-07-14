import { toNextResponse } from "@/lib/api-v1/http";
import { runMobileLogoutAll } from "@/lib/api-v1/mobile-session";

/**
 * POST /api/v1/mobile/auth/logout-all — revoke ALL device sessions for the acting
 * user. Bearer-authenticated: the actor is resolved from the verified access token
 * only; a client-supplied userId is rejected (strict-empty body). Thin adapter.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => undefined);
  const authorization = req.headers.get("authorization");
  return toNextResponse(await runMobileLogoutAll({ body, authorization }));
}
