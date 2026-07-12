import { randomBytes, createHmac, timingSafeEqual } from "crypto";
import {
  REFRESH_TOKEN_PREFIX,
  REFRESH_TOKEN_MIN_BODY_LENGTH,
  REFRESH_TOKEN_MAX_LENGTH,
  refreshTokenSchema
} from "../../api-contract/v1/mobile-auth";

/**
 * Refresh token security utilities (pure, no I/O, no env reads).
 *
 * Format: gbrt_v1_<base64url(>=32 random bytes)>. Only the HASH is ever persisted;
 * the plaintext is returned exactly once at creation/rotation and never enters a
 * store, log, audit event, or error. The pepper is injected (never hardcoded,
 * never read from .env here) and never appears in an error message.
 *
 * The token FORMAT rule lives in the public contract (refreshTokenSchema); this
 * module imports it so the wire contract and the crypto util share one rule and
 * can never drift. The contract does not depend on this module (no cycle).
 */

// Re-export the canonical contract constants for convenient single-import use.
export {
  REFRESH_TOKEN_PREFIX,
  REFRESH_TOKEN_MIN_BODY_LENGTH,
  REFRESH_TOKEN_MAX_LENGTH
} from "../../api-contract/v1/mobile-auth";

export const REFRESH_TOKEN_RANDOM_BYTES = 32;
export const MIN_PEPPER_LENGTH = 32;

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

/** Strict format check — delegates to the single canonical contract schema. */
export function isValidRefreshTokenFormat(token: unknown): token is string {
  return refreshTokenSchema.safeParse(token).success;
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
