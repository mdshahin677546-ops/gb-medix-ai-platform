import { API_ERROR_HTTP_STATUS, isApiErrorCode, type ApiErrorCode } from "./error-codes";
import { fail, type ApiErrorResponse, type ApiResult } from "./result";

/**
 * API client contract skeleton — interfaces and safe error mapping only.
 * This batch implements NO real network call, NO token storage, NO refresh flow,
 * and NO default production URL. Concrete clients are provided per surface.
 * Planning: SHARED_WEB_MOBILE_API_CONTRACT.md §Shared Packages.
 */

/** Pluggable auth header provider. A real implementation lives outside this contract. */
export interface AuthHeaderProvider {
  /** Returns headers to attach (e.g. Authorization). Never logged by the client. */
  getAuthHeaders(): Promise<Record<string, string>> | Record<string, string>;
}

export interface ApiClientConfig {
  /** Required — no production URL is baked in. */
  baseUrl: string;
  /** De-identified request id generator for correlation. */
  requestId?: () => string;
  timeoutMs?: number;
  auth?: AuthHeaderProvider;
}

export interface TypedApiClient {
  request<TData>(input: {
    method: "GET" | "POST" | "PATCH" | "DELETE";
    path: string;
    body?: unknown;
    requestId?: string;
  }): Promise<ApiResult<TData>>;
}

/**
 * Map an HTTP status to a shared error code (advisory reverse of
 * API_ERROR_HTTP_STATUS). Unknown statuses fall back to INTERNAL_ERROR.
 */
export function errorCodeForStatus(status: number): ApiErrorCode {
  for (const [code, mapped] of Object.entries(API_ERROR_HTTP_STATUS)) {
    if (mapped === status && isApiErrorCode(code)) return code;
  }
  return "INTERNAL_ERROR";
}

/**
 * Convert any thrown value / bad response into a safe ApiErrorResponse.
 * NEVER surfaces raw exception text, stack, provider error, or response body —
 * only a fixed, safe message plus the mapped code.
 */
export function toSafeApiError(input: {
  code?: unknown;
  status?: number;
  requestId?: string;
}): ApiErrorResponse {
  const code: ApiErrorCode = isApiErrorCode(input.code)
    ? input.code
    : typeof input.status === "number"
      ? errorCodeForStatus(input.status)
      : "INTERNAL_ERROR";
  return fail(code, SAFE_ERROR_MESSAGE[code], input.requestId);
}

const SAFE_ERROR_MESSAGE: Record<ApiErrorCode, string> = {
  AUTH_REQUIRED: "Please sign in to continue.",
  TOKEN_EXPIRED: "Your session expired. Please sign in again.",
  EMAIL_VERIFICATION_REQUIRED: "Please verify your email to continue.",
  AI_CONSENT_REQUIRED: "Please accept the third-party AI processing notice first.",
  ENTITLEMENT_REQUIRED: "This feature requires an active purchase.",
  RATE_LIMITED: "Too many requests. Please try again shortly.",
  AI_PROVIDER_ERROR: "The AI service is temporarily unavailable. Please try again later.",
  AI_OUTPUT_INVALID: "The AI response could not be processed. Please try again.",
  SAFETY_ESCALATION_REQUIRED: "Please seek help from a qualified professional.",
  RESOURCE_NOT_FOUND: "Not found.",
  ACCESS_DENIED: "You do not have access to this resource.",
  VALIDATION_ERROR: "The request was invalid.",
  CONFLICT: "The request conflicts with the current state.",
  INTERNAL_ERROR: "Something went wrong. Please try again later."
};
