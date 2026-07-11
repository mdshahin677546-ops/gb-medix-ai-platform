import { AIProviderConfigError, AIProviderOutputError } from "@/lib/ai/providers/types";

export type AIFailureStage =
  | "provider_init"
  | "upstream_request"
  | "json_parse"
  | "schema_validation"
  | "database_write";

/**
 * Allowlisted diagnostic shape. NOTHING outside these keys is ever logged:
 * no raw error text, prompt, health content, request/response payloads, email,
 * user identifiers, cookies, tokens, or secrets. undefined fields are dropped
 * on serialization.
 */
export type AIDiagnostic = {
  provider?: string;
  model?: string;
  endpoint: string;
  httpStatus?: number;
  errorType?: string;
  errorCode?: string;
  requestId?: string;
  stage: AIFailureStage;
  retryable: boolean;
};

function readString(obj: unknown, key: string): string | undefined {
  if (obj && typeof obj === "object" && key in obj) {
    const value = (obj as Record<string, unknown>)[key];
    if (typeof value === "string" && value) return value;
    if (typeof value === "number") return String(value);
  }
  return undefined;
}

function readNumber(obj: unknown, key: string): number | undefined {
  if (obj && typeof obj === "object" && key in obj) {
    const value = (obj as Record<string, unknown>)[key];
    if (typeof value === "number") return value;
  }
  return undefined;
}

/**
 * Derive allowlisted diagnostic fields from an error. Reads only structured,
 * non-sensitive properties (status/type/code/request id) — never the raw error
 * text.
 */
export function describeAIError(error: unknown): {
  httpStatus?: number;
  errorType?: string;
  errorCode?: string;
  requestId?: string;
  stage: AIFailureStage;
  retryable: boolean;
} {
  if (error instanceof AIProviderConfigError) {
    return { errorType: "AIProviderConfigError", stage: "provider_init", retryable: false };
  }
  if (error instanceof AIProviderOutputError) {
    // Bad model output is deterministic — retrying the same call will not help.
    return { errorType: "AIProviderOutputError", stage: error.stage, retryable: false };
  }

  // Otherwise treat as an upstream/provider (SDK/relay) request error and read
  // only its structured fields.
  const httpStatus = readNumber(error, "status");
  const errorType =
    readString(error, "type") ?? (error instanceof Error ? error.name : undefined) ?? "UnknownError";
  const errorCode = readString(error, "code");
  const requestId = readString(error, "request_id") ?? readString(error, "requestID");
  const retryable =
    typeof httpStatus === "number"
      ? httpStatus === 408 || httpStatus === 409 || httpStatus === 429 || httpStatus >= 500
      : false;
  return { httpStatus, errorType, errorCode, requestId, stage: "upstream_request", retryable };
}

/**
 * Emit a single structured, allowlist-only diagnostic line for an AI failure.
 * Only the AIDiagnostic keys are serialized, so no free-form error text,
 * prompt, health content, request/response body, or identifier can leak.
 */
export function logAIDiagnostic(input: {
  provider?: string;
  model?: string;
  endpoint: string;
  stage?: AIFailureStage;
  error: unknown;
}): void {
  const described = describeAIError(input.error);
  const diagnostic: AIDiagnostic = {
    provider: input.provider,
    model: input.model,
    endpoint: input.endpoint,
    httpStatus: described.httpStatus,
    errorType: described.errorType,
    errorCode: described.errorCode,
    requestId: described.requestId,
    stage: input.stage ?? described.stage,
    retryable: described.retryable
  };
  console.error("ai_provider_diagnostic", JSON.stringify(diagnostic));
}
