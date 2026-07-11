import { NextResponse } from "next/server";
import type { HandlerResult } from "./handler-result";

/**
 * Next.js adapter for /api/v1 (imports next/server, so it is kept OUT of the pure
 * barrel). Turns a framework-agnostic HandlerResult into a NextResponse, applying
 * the handler's status and headers (X-Request-Id, X-API-Version, Cache-Control,
 * Content-Type) verbatim.
 */
export function toNextResponse(result: HandlerResult): NextResponse {
  return NextResponse.json(result.body, {
    status: result.status,
    headers: result.headers
  });
}
