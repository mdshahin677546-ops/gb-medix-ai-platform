import { toNextResponse } from "@/lib/api-v1/http";
import { runMobileRefresh } from "@/lib/api-v1/mobile-session";

/**
 * POST /api/v1/mobile/auth/refresh — rotate a device session's refresh token and
 * issue a new access token. Thin adapter: parse JSON body → tested handler →
 * NextResponse (private, no-store; fixed safe error contracts). No login/OAuth.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => undefined);
  return toNextResponse(await runMobileRefresh({ body }));
}
