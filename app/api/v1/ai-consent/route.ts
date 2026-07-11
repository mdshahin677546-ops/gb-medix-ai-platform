import { getConfiguredAIProviderName } from "@/lib/ai/provider-factory";
import { getAIConsentStatus } from "@/lib/ai-consent/consent-service";
import {
  newRequestId,
  internalFailure,
  success,
  toAiConsentStatusDTO
} from "@/lib/api-v1";
import { requireApiUser } from "@/lib/api-v1/session";
import { respond } from "@/lib/api-v1/http";

/**
 * GET /api/v1/ai-consent — current user's AI processing consent status for the
 * server-configured provider. The provider is resolved server-side; the client
 * cannot specify provider / consentVersion / userId. Read-only (no accept/revoke).
 */
export async function GET() {
  const requestId = newRequestId();
  try {
    const auth = await requireApiUser(requestId);
    if (!auth.ok) return respond(requestId, auth.failure);

    const provider = getConfiguredAIProviderName();
    const status = await getAIConsentStatus(auth.user.id, provider);
    return respond(requestId, success(toAiConsentStatusDTO(status), requestId));
  } catch {
    return respond(requestId, internalFailure(requestId));
  }
}
