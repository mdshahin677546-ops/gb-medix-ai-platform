import { createHmac } from "crypto";

export const MOBILE_AUTH_ENDPOINTS = ["refresh", "logout", "logout-all", "issue"] as const;
export type MobileAuthEndpoint = (typeof MOBILE_AUTH_ENDPOINTS)[number];

export const IDEMPOTENCY_KEY_MIN_LENGTH = 16;
export const IDEMPOTENCY_KEY_MAX_LENGTH = 128;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._~-]+$/;
const HEX64 = /^[0-9a-f]{64}$/;

export type IdempotencyKeyParseResult =
  | { ok: true; key: string }
  | { ok: false; reason: "missing" | "malformed" };

export function isHexDigest(value: unknown): value is string {
  return typeof value === "string" && HEX64.test(value);
}

function hasControlOrAmbiguousWhitespace(value: string): boolean {
  return /[\u0000-\u001f\u007f]/.test(value) || value.trim() !== value || value.includes(",");
}

export function parseIdempotencyKey(value: unknown): IdempotencyKeyParseResult {
  if (typeof value !== "string" || value.length === 0) return { ok: false, reason: "missing" };
  if (
    value.length < IDEMPOTENCY_KEY_MIN_LENGTH ||
    value.length > IDEMPOTENCY_KEY_MAX_LENGTH ||
    hasControlOrAmbiguousWhitespace(value) ||
    !IDEMPOTENCY_KEY_PATTERN.test(value)
  ) {
    return { ok: false, reason: "malformed" };
  }
  return { ok: true, key: value };
}

export function hmacHex(controlKey: string, domain: string, value: string): string {
  return createHmac("sha256", controlKey).update(`${domain}:${value}`, "utf8").digest("hex");
}

export function idempotencyKeyDigest(controlKey: string, rawKey: string): string {
  return hmacHex(controlKey, "mobile-auth-idempotency:v1", rawKey);
}

export function credentialDigest(controlKey: string, value: string): string {
  return hmacHex(controlKey, "mobile-auth-credential:v1", value);
}

export function actorDigest(controlKey: string, value: string): string {
  return hmacHex(controlKey, "mobile-auth-actor:v1", value);
}

export function rateLimitBucketKey(controlKey: string, endpoint: MobileAuthEndpoint, subjectDigest: string): string {
  return hmacHex(controlKey, "mobile-auth-rate-limit:v1", `${endpoint}:${subjectDigest}`);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const input = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(input).sort()) out[key] = canonicalize(input[key]);
    return out;
  }
  return value;
}

export function canonicalRequestDigest(
  controlKey: string,
  endpoint: MobileAuthEndpoint,
  body: Record<string, unknown>
): string {
  return hmacHex(
    controlKey,
    "mobile-auth-request:v1",
    `${endpoint}:${JSON.stringify(canonicalize(body))}`
  );
}

export type MobileAuthRateLimitPolicy = {
  windowSeconds: number;
  maxRequests: number;
};

export const DEFAULT_MOBILE_AUTH_RATE_LIMITS: Record<MobileAuthEndpoint, MobileAuthRateLimitPolicy> = {
  refresh: { windowSeconds: 60, maxRequests: 20 },
  logout: { windowSeconds: 60, maxRequests: 30 },
  "logout-all": { windowSeconds: 60, maxRequests: 10 },
  // Issuance is a one-time exchange per verification token; keep the per-credential
  // ceiling low. Concurrency safety is enforced by the atomic transaction + token
  // consumption, not by this coarse rate limit.
  issue: { windowSeconds: 60, maxRequests: 10 }
};

export const IDEMPOTENCY_TTL_SECONDS = 60 * 60;

export function safeRetryAfterSeconds(now: number, windowStart: number, windowSeconds: number): number {
  const retryAfter = Math.max(1, Math.ceil(windowStart + windowSeconds - now));
  return Number.isSafeInteger(retryAfter) ? retryAfter : windowSeconds;
}
