import { API_ERROR_HTTP_STATUS, type ApiErrorCode } from "../api-contract/v1/error-codes";
import { toSafeApiError } from "../api-contract/v1/client";
import { ok, type ApiErrorResponse, type ApiSuccess } from "../api-contract/v1/result";

/**
 * Safe response builders for /api/v1 (pure).
 *
 * Failures ALWAYS use the fixed, safe per-code message from the shared contract
 * (`toSafeApiError`) — never a raw exception, stack, provider error, SQL, request
 * body, or `error.message`. An unknown throw collapses to INTERNAL_ERROR.
 */

export { ok };

export type ApiFailure = { body: ApiErrorResponse; status: number };
export type ApiOk<TData> = { body: ApiSuccess<TData>; status: number };

export function failure(code: ApiErrorCode, requestId: string): ApiFailure {
  return {
    body: toSafeApiError({ code, requestId }),
    status: API_ERROR_HTTP_STATUS[code]
  };
}

/** Collapse any unexpected thrown value to a safe INTERNAL_ERROR (no leakage). */
export function internalFailure(requestId: string): ApiFailure {
  return failure("INTERNAL_ERROR", requestId);
}

export function success<TData>(data: TData, requestId: string): ApiOk<TData> {
  return { body: ok(data, requestId), status: 200 };
}
