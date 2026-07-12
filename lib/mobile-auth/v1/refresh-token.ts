import { randomBytes, createHmac, timingSafeEqual } from "crypto";

/**
 * Refresh token security utilities (pure, no I/O, no env reads).
 *
 * Format: gbrt_v1_<base64url(>=32 random bytes)>. Only the HASH is ever persisted;
 * the plaintext is returned exactly once at creation/rotation and never enters a
 * store, log, audit event, or error. The pepper is injected (never hardcoded,
 * never read from .env here) and never appears in an error message.
 */

export const REFRESH_TOKEN_PREFIX = "gbrt_v1_";
export const REFRESH_TOKEN_RANDOM_BYTES = 32;
/** base64url of 32 bytes = 43 chars; require at least that much entropy. */
export const REFRESH_TOKEN_MIN_BODY_LENGTH = 43;
export const REFRESH_TOKEN_MAX_LENGTH = 256;
export const MIN_PEPPER_LENGTH = 32;

const BODY_RE = /^[A-Za-z0-9_-]+$/;
const HEX_RE = /^[0-9a-f]+$/;

/** Errors here are intentionally value-free (no token / hash / pepper echoed). */
export class RefreshTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RefreshTokenError";
  }
}

export function generateRefreshToken(): string {
  const body = randomBytes(REFRESH_TOKEN_RANDOM_BYTES).toString("base64url");
  return `${REFRESH_TOKEN_PREFIX}${body}`;
}

/** Strict format check: prefix, safe charset, entropy floor, and max length. */
export function isValidRefreshTokenFormat(token: unknown): token is string {
  if (typeof token !== "string") return false;
  if (token.length === 0 || token.length > REFRESH_TOKEN_MAX_LENGTH) return false;
  if (!token.startsWith(REFRESH_TOKEN_PREFIX)) return false;
  const body = token.slice(REFRESH_TOKEN_PREFIX.length);
  if (body.length < REFRESH_TOKEN_MIN_BODY_LENGTH) return false;
  if (!BODY_RE.test(body)) return false;
  return true;
}

function assertPepper(pepper: unknown): asserts pepper is string {
  if (typeof pepper !== "string" || pepper.length < MIN_PEPPER_LENGTH) {
    // No pepper value in the message.
    throw new RefreshTokenError("Refresh token pepper is missing or too short.");
  }
}

/** Keyed HMAC-SHA-256 of the token under the injected pepper, hex-encoded. */
export function hashRefreshToken(token: string, pepper: string): string {
  if (!isValidRefreshTokenFormat(token)) {
    throw new RefreshTokenError("Refresh token has an invalid format.");
  }
  assertPepper(pepper);
  return createHmac("sha256", pepper).update(token).digest("hex");
}

/**
 * Constant-time verification. Returns false (never throws with a value) for a
 * malformed token / malformed stored hash / length mismatch; the length check
 * happens BEFORE timingSafeEqual, which requires equal-length buffers.
 */
export function verifyRefreshTokenHash(
  token: string,
  expectedHash: string,
  pepper: string
): boolean {
  if (!isValidRefreshTokenFormat(token)) return false;
  assertPepper(pepper);
  if (typeof expectedHash !== "string" || !HEX_RE.test(expectedHash)) return false;

  const actual = createHmac("sha256", pepper).update(token).digest();
  const expected = Buffer.from(expectedHash, "hex");
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(actual, expected);
}
