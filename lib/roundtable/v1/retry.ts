// Failure/retry policy for the daily run.
//
// Retries always reuse the SAME operationId (no second discussion is ever
// created), count against the retry budget, and never apply to
// non-retryable failures. A failed run must never be marked completed.

export const RETRYABLE_ERROR_TYPES = [
  "provider_timeout",
  "temporary_provider_error",
  "temporary_evidence_service_error",
] as const;

export const NON_RETRYABLE_ERROR_TYPES = [
  "privacy_blocked",
  "high_risk_blocked",
  "evidence_invalid",
  "medical_review_rejected",
  "budget_exceeded",
  "schema_invalid",
] as const;

export type RetryableErrorType = (typeof RETRYABLE_ERROR_TYPES)[number];
export type NonRetryableErrorType = (typeof NON_RETRYABLE_ERROR_TYPES)[number];

export function isRetryableError(errorType: string): boolean {
  return (RETRYABLE_ERROR_TYPES as readonly string[]).includes(errorType);
}

export interface RetryPlanInput {
  errorType: string;
  /** Retries already consumed for this operation. */
  retriesUsed: number;
  maximumRetries: number;
  operationId: string;
}

export interface RetryPlan {
  shouldRetry: boolean;
  reason: string;
  /** Always the SAME operationId — a retry never creates a new discussion. */
  operationId: string;
  /** Retry attempt number to record against the budget, or null if stopping. */
  nextRetryNumber: number | null;
}

export function planRetry(input: RetryPlanInput): RetryPlan {
  const { errorType, retriesUsed, maximumRetries, operationId } = input;
  if (
    typeof retriesUsed !== "number" || Number.isNaN(retriesUsed) || !Number.isFinite(retriesUsed) ||
    !Number.isInteger(retriesUsed) || retriesUsed < 0 ||
    typeof maximumRetries !== "number" || Number.isNaN(maximumRetries) || !Number.isFinite(maximumRetries) ||
    !Number.isInteger(maximumRetries) || maximumRetries < 0
  ) {
    throw new Error("Invalid retry accounting: counts must be non-negative finite integers");
  }
  if ((NON_RETRYABLE_ERROR_TYPES as readonly string[]).includes(errorType)) {
    return { shouldRetry: false, reason: `non_retryable_error:${errorType}`, operationId, nextRetryNumber: null };
  }
  if (!isRetryableError(errorType)) {
    // Unknown failure types are treated as non-retryable by default — safer
    // than retrying an unclassified medical-content failure.
    return { shouldRetry: false, reason: `unknown_error_type:${errorType}`, operationId, nextRetryNumber: null };
  }
  if (retriesUsed >= maximumRetries) {
    return { shouldRetry: false, reason: "retry_budget_exhausted", operationId, nextRetryNumber: null };
  }
  return { shouldRetry: true, reason: `retryable_error:${errorType}`, operationId, nextRetryNumber: retriesUsed + 1 };
}
