import { toNextResponse } from "@/lib/api-v1/http";
import { runMobileLogout } from "@/lib/api-v1/mobile-session";

/**
 * POST /api/v1/mobile/auth/logout — revoke the device session owning the
 * presented refresh token. Idempotent, non-revealing. Thin adapter.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => undefined);
  return toNextResponse(await runMobileLogout({ body }));
}
