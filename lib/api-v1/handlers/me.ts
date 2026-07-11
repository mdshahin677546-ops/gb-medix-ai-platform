import { newRequestId } from "../request-context";
import { success, internalFailure } from "../failure";
import { finalize, type HandlerResult } from "../handler-result";
import type { Guard } from "../guards";
import { toMeDTO } from "../mappers/user";

/**
 * GET /api/v1/me handler factory. Auth-only guard: a signed-in but not-yet
 * verified user may read their own safe status. Emits only the allowlisted `me`
 * DTO (validated by the shared meSchema).
 */
export type MeHandlerDeps = { requireUser: Guard };

export function createMeHandler(deps: MeHandlerDeps) {
  return async function GET(): Promise<HandlerResult> {
    const requestId = newRequestId();
    try {
      const auth = await deps.requireUser(requestId);
      if (!auth.ok) return finalize(requestId, auth.failure);

      const me = toMeDTO({
        id: auth.user.id,
        status: auth.user.status,
        emailVerifiedAt: auth.user.emailVerifiedAt
      });
      return finalize(requestId, success({ user: me }, requestId));
    } catch {
      return finalize(requestId, internalFailure(requestId));
    }
  };
}
