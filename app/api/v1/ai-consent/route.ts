import { getConfiguredAIProviderName } from "@/lib/ai/provider-factory";
import { getAIConsentStatus } from "@/lib/ai-consent/consent-service";
import { createAiConsentHandler } from "@/lib/api-v1";
import { requireActiveVerifiedUser } from "@/lib/api-v1/session";
import { toNextResponse } from "@/lib/api-v1/http";

/**
 * GET /api/v1/ai-consent — AI consent status for the server-configured provider.
 * Requires an active, email-verified user. Provider is resolved server-side;
 * the client cannot specify provider / consentVersion / userId. Read-only.
 */
const handler = createAiConsentHandler({
  requireUser: requireActiveVerifiedUser,
  getProviderName: getConfiguredAIProviderName,
  getConsentStatus: getAIConsentStatus
});

export async function GET() {
  return toNextResponse(await handler());
}
