import { toNextResponse } from "@/lib/api-v1/http";
import { prepareMobileAuthRequest } from "@/lib/api-v1/mobile-auth-boundary";
import { runMobileRefresh } from "@/lib/api-v1/mobile-session";

/**
 * POST /api/v1/mobile/auth/refresh — rotate a device session's refresh token and
 * issue a new access token. Thin adapter: parse JSON body → tested handler →
 * NextResponse (private, no-store; fixed safe error contracts). No login/OAuth.
 */
export async function POST(req: Request) {
  const prepared = await prepareMobileAuthRequest(req, "refresh");
  if (!prepared.ok) return toNextResponse(prepared.result);
  return toNextResponse(await runMobileRefresh(prepared.input));
}
