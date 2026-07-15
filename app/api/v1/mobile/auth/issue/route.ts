import { toNextResponse } from "@/lib/api-v1/http";
import { prepareMobileAuthRequest } from "@/lib/api-v1/mobile-auth-boundary";
import { finalizeMobileAuthBoundaryRejection, runMobileIssue } from "@/lib/api-v1/mobile-session";

/**
 * POST /api/v1/mobile/auth/issue — exchange a single-use EmailVerification token
 * for a new mobile DeviceSession. Thin adapter: strict boundary (JSON only, no
 * query, required Idempotency-Key, no cookie/Bearer) → tested handler →
 * NextResponse (private, no-store; fixed safe errors). No login/OAuth/SecureStore.
 */
export async function POST(req: Request) {
  const prepared = await prepareMobileAuthRequest(req, "issue");
  if (!prepared.ok) return toNextResponse(await finalizeMobileAuthBoundaryRejection(prepared.rejection));
  return toNextResponse(await runMobileIssue(prepared.input));
}
