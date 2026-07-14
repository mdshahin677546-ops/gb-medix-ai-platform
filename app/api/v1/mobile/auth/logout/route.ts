import { toNextResponse } from "@/lib/api-v1/http";
import { prepareMobileAuthRequest } from "@/lib/api-v1/mobile-auth-boundary";
import { runMobileLogout } from "@/lib/api-v1/mobile-session";

/**
 * POST /api/v1/mobile/auth/logout — revoke the device session owning the
 * presented refresh token. Idempotent, non-revealing. Thin adapter.
 */
export async function POST(req: Request) {
  const prepared = await prepareMobileAuthRequest(req, "logout");
  if (!prepared.ok) return toNextResponse(prepared.result);
  return toNextResponse(await runMobileLogout(prepared.input));
}
