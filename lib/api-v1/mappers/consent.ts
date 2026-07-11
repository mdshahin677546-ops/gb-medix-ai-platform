import {
  aiConsentStatusSchema,
  aiProviderScopeSchema,
  type AiConsentStatus
} from "../../api-contract/v1/consent";

/**
 * Map the existing consent service status to the read-only AI consent DTO.
 *
 * The server resolves the provider (never the client). `providerScope` exposes
 * only third-party providers that are in the shared enum; the raw configured
 * provider value, DB ids, API keys, and env values are never emitted. Output is
 * validated by the real shared `aiConsentStatusSchema` (.strict()).
 */
export type ConsentServiceStatus = {
  provider: string;
  required: boolean;
  accepted: boolean;
  consentVersion: string;
  acceptedAt: string | null;
  revokedAt: string | null;
};

export function toAiConsentStatusDTO(status: ConsentServiceStatus): AiConsentStatus {
  const scopeParse = aiProviderScopeSchema.safeParse(status.provider);
  const providerScope =
    status.required && scopeParse.success ? [scopeParse.data] : [];

  return aiConsentStatusSchema.parse({
    required: status.required,
    accepted: status.accepted,
    consentVersion: status.consentVersion,
    providerScope,
    acceptedAt: status.acceptedAt,
    revokedAt: status.revokedAt
  });
}
