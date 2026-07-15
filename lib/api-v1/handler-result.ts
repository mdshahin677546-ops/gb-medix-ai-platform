import { buildApiHeaders } from "./request-context";
import type { ApiFailure, ApiOk } from "./failure";

/**
 * Framework-agnostic handler result (pure). Handlers return this; the thin Next
 * route adapter turns it into a NextResponse. Keeping it framework-free lets the
 * real handlers execute under node:test and lets tests assert status, headers,
 * and JSON body without a Next runtime.
 */
export type HandlerResult = {
  status: number;
  headers: Record<string, string>;
  body: unknown;
};

export type FinalizeOptions = {
  retryAfterSeconds?: unknown;
};

export const MAX_RETRY_AFTER_SECONDS = 3600;

function retryAfterHeader(value: unknown): string {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > MAX_RETRY_AFTER_SECONDS
  ) {
    throw new Error("Invalid Retry-After value.");
  }
  return String(value);
}

export function finalize(
  requestId: string,
  result: ApiOk<unknown> | ApiFailure,
  options: FinalizeOptions = {}
): HandlerResult {
  const headers = buildApiHeaders(requestId);
  if (options.retryAfterSeconds !== undefined) {
    headers["Retry-After"] = retryAfterHeader(options.retryAfterSeconds);
  }
  return { status: result.status, headers, body: result.body };
}
