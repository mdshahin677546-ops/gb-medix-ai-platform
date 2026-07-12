import { randomUUID } from "crypto";

/**
 * API v1 request context helpers (pure — no Next / Prisma / auth imports so the
 * real implementation can be compiled and executed in node:test).
 *
 * Every /api/v1 response carries a de-identified request id and a fixed API
 * version, and every user-private response is marked non-cacheable so a CDN or
 * shared cache never stores it.
 */

export const API_VERSION = "1" as const;

/**
 * De-identified request id for log/response correlation. It is random and
 * carries NO userId / email / ip / token / resource id — safe to expose.
 */
export function newRequestId(): string {
  return randomUUID();
}

/**
 * Headers attached to every /api/v1 response. Private + no-store keeps user
 * data out of shared caches; no CORS headers are added (same-origin only).
 */
export function buildApiHeaders(requestId: string): Record<string, string> {
  return {
    "X-Request-Id": requestId,
    "X-API-Version": API_VERSION,
    "Cache-Control": "private, no-store",
    "Content-Type": "application/json"
  };
}
