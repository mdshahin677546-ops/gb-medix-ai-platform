import { NextResponse } from "next/server";
import { buildApiHeaders } from "./request-context";
import type { ApiFailure, ApiOk } from "./failure";

/**
 * Next.js response glue for /api/v1. Imports next/server, so it is kept OUT of
 * the pure barrel (lib/api-v1/index.ts). Applies the standard headers
 * (X-Request-Id, X-API-Version, Cache-Control: private, no-store) to every reply.
 */
export function respond<TData>(
  requestId: string,
  result: ApiOk<TData> | ApiFailure
): NextResponse {
  return NextResponse.json(result.body, {
    status: result.status,
    headers: buildApiHeaders(requestId)
  });
}
