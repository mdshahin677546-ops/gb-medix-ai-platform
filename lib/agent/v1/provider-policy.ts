/**
 * Agent provider safety policy (types/constants only — NO provider call in this
 * batch). Encodes the invariants the future agent runtime must uphold when it
 * eventually reuses the existing server-side AI Provider Adapter.
 * Planning: AI_AGENT_CONSULTATION_PLAN.md §6, §8, §10.
 */

/** Runtime invariants (documented as a checklist consumed by future impl + review). */
export const PROVIDER_SAFETY_INVARIANTS = [
  "json_parse_required",
  "zod_safeparse_required",
  "schema_invalid_returns_safe_error",
  "no_automatic_cross_provider_fallback",
  "invalid_output_not_persisted",
  "failed_placeholder_audit_allowed",
  "provider_payload_allowlist_enforced",
  "log_allowlist_enforced"
] as const;
export type ProviderSafetyInvariant = (typeof PROVIDER_SAFETY_INVARIANTS)[number];

/** Only these de-identified health dimensions may be sent to a provider. */
export const PROVIDER_PAYLOAD_ALLOWLIST = [
  "questionnaireAnswers",
  "sleep",
  "diet",
  "stress",
  "activity",
  "bodySensationStructured",
  "locale",
  "reportType"
] as const;

/** Fields that must never be sent to a provider. */
export const PROVIDER_PAYLOAD_DENYLIST = [
  "email",
  "userId",
  "paymentId",
  "entitlementId",
  "ip",
  "cookie",
  "session",
  "accessToken",
  "refreshToken",
  "apiKey",
  "fullRecord"
] as const;

/** Fields allowed in agent/provider diagnostic logs. */
export const LOG_ALLOWLIST = [
  "provider",
  "model",
  "endpoint",
  "httpStatus",
  "errorType",
  "errorCode",
  "requestId",
  "stage",
  "retryable",
  "timestamp"
] as const;

const PAYLOAD_DENYSET: ReadonlySet<string> = new Set(
  PROVIDER_PAYLOAD_DENYLIST.map((f) => f.toLowerCase())
);

/** True if a payload key must not be sent to a provider. */
export function isProviderPayloadDenied(field: string): boolean {
  return PAYLOAD_DENYSET.has(field.toLowerCase());
}
