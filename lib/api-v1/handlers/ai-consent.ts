import { newRequestId } from "../request-context";
import { success, internalFailure } from "../failure";
import { finalize, type HandlerResult } from "../handler-result";
import type { Guard } from "../guards";
import { toAiConsentStatusDTO, type ConsentServiceStatus } from "../mappers/consent";

/**
 * GET /api/v1/ai-consent handler factory. Requires an active, email-verified
 * user. The provider is resolved server-side (injected getProviderName); the
 * client cannot specify provider / consentVersion / userId.
 */
export type AiConsentHandlerDeps = {
  requireUser: Guard;
  getProviderName: () => string;
  getConsentStatus: (userId: string, provider: string) => Promise<ConsentServiceStatus>;
};

export function createAiConsentHandler(deps: AiConsentHandlerDeps) {
  return async function GET(): Promise<HandlerResult> {
    const requestId = newRequestId();
    try {
      const auth = await deps.requireUser(requestId);
      if (!auth.ok) return finalize(requestId, auth.failure);

      const provider = deps.getProviderName();
      const status = await deps.getConsentStatus(auth.user.id, provider);
      return finalize(requestId, success(toAiConsentStatusDTO(status), requestId));
    } catch {
      return finalize(requestId, internalFailure(requestId));
    }
  };
}
