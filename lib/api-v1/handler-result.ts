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

export function finalize(
  requestId: string,
  result: ApiOk<unknown> | ApiFailure,
  extraHeaders: Record<string, string> = {}
): HandlerResult {
  return { status: result.status, headers: { ...buildApiHeaders(requestId), ...extraHeaders }, body: result.body };
}
