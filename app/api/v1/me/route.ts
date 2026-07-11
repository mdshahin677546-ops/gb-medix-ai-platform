import { getCurrentUser } from "@/lib/auth";
import {
  newRequestId,
  internalFailure,
  success,
  toMeDTO
} from "@/lib/api-v1";
import { failure } from "@/lib/api-v1/failure";
import { respond } from "@/lib/api-v1/http";

/**
 * GET /api/v1/me — safe profile for the current Web-authenticated user.
 * Read-only, same-origin, Web cookie session. No tokens, no mobile bearer auth.
 */
export async function GET() {
  const requestId = newRequestId();
  try {
    const user = await getCurrentUser();
    if (!user) return respond(requestId, failure("AUTH_REQUIRED", requestId));

    const me = toMeDTO({
      id: user.id,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt
    });
    return respond(requestId, success({ user: me }, requestId));
  } catch {
    return respond(requestId, internalFailure(requestId));
  }
}
