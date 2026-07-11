/**
 * GB MEDIX AI — Shared API v1 error codes.
 *
 * Single source of truth for cross-surface (Web / Mobile / Agent) error codes.
 * Other branches MUST consume these and MUST NOT define a second error-code set.
 * Planning: SHARED_WEB_MOBILE_API_CONTRACT.md §4.
 */
export const API_ERROR_CODES = [
  "AUTH_REQUIRED",
  "TOKEN_EXPIRED",
  "EMAIL_VERIFICATION_REQUIRED",
  "AI_CONSENT_REQUIRED",
  "ENTITLEMENT_REQUIRED",
  "RATE_LIMITED",
  "AI_PROVIDER_ERROR",
  "AI_OUTPUT_INVALID",
  "SAFETY_ESCALATION_REQUIRED",
  "RESOURCE_NOT_FOUND",
  "ACCESS_DENIED",
  "VALIDATION_ERROR",
  "CONFLICT",
  "INTERNAL_ERROR"
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

const API_ERROR_CODE_SET: ReadonlySet<string> = new Set(API_ERROR_CODES);

export function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return typeof value === "string" && API_ERROR_CODE_SET.has(value);
}

/**
 * Suggested HTTP status per code. Advisory only — the wire contract is the code,
 * not the status. Kept here so Web and Mobile map consistently.
 */
export const API_ERROR_HTTP_STATUS: Record<ApiErrorCode, number> = {
  AUTH_REQUIRED: 401,
  TOKEN_EXPIRED: 401,
  EMAIL_VERIFICATION_REQUIRED: 403,
  AI_CONSENT_REQUIRED: 403,
  ENTITLEMENT_REQUIRED: 402,
  RATE_LIMITED: 429,
  AI_PROVIDER_ERROR: 502,
  AI_OUTPUT_INVALID: 502,
  SAFETY_ESCALATION_REQUIRED: 409,
  RESOURCE_NOT_FOUND: 404,
  ACCESS_DENIED: 403,
  VALIDATION_ERROR: 400,
  CONFLICT: 409,
  INTERNAL_ERROR: 500
};

/** Codes a client may safely retry (identical request may later succeed). */
export const RETRYABLE_API_ERROR_CODES: ReadonlySet<ApiErrorCode> = new Set([
  "RATE_LIMITED",
  "AI_PROVIDER_ERROR",
  "INTERNAL_ERROR"
]);
