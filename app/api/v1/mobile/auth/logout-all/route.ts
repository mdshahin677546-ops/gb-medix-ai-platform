import { toNextResponse } from "@/lib/api-v1/http";
import { prepareMobileAuthRequest } from "@/lib/api-v1/mobile-auth-boundary";
import { finalizeMobileAuthBoundaryRejection, runMobileLogoutAll } from "@/lib/api-v1/mobile-session";

/**
 * POST /api/v1/mobile/auth/logout-all — revoke ALL device sessions for the acting
 * user. Bearer-authenticated: the actor is resolved from the verified access token
 * only; a client-supplied userId is rejected (strict-empty body). Thin adapter.
 */
export async function POST(req: Request) {
  const prepared = await prepareMobileAuthRequest(req, "logout-all");
  if (!prepared.ok) return toNextResponse(await finalizeMobileAuthBoundaryRejection(prepared.rejection));
  return toNextResponse(
    await runMobileLogoutAll({
      body: prepared.input.body,
      authorization: prepared.input.authorization,
      idempotencyKey: prepared.input.idempotencyKey
    })
  );
}
