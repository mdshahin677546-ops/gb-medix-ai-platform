import { createHmac, timingSafeEqual } from "crypto";
import {
  accessTokenClaimsSchema,
  MOBILE_ACCESS_TOKEN_TYP,
  type AccessTokenClaims
} from "../../api-contract/v1/mobile-auth";
import {
  verifyAccessTokenClaims,
  type AccessTokenPolicy,
  type AccessTokenVerifyResult
} from "./access-token";
import { parseBearerAuthorization } from "./bearer";

/** The claim-level rejection reasons produced by verifyAccessTokenClaims. */
type ClaimVerifyReason = Extract<AccessTokenVerifyResult, { ok: false }>["reason"];

/**
 * HMAC-SHA-256 access-token signer / verifier (Batch 2.2C).
 *
 * The signing key is INJECTED (never hardcoded, never read from .env here). The
 * signed payload is EXACTLY the 9-field `accessTokenClaimsSchema` — no email,
 * phone, health, payment, report, or provider data can ride along (the strict
 * schema rejects any extra field before signing). Verification checks the
 * signature FIRST (constant time), then delegates the claim set to the existing
 * pure `verifyAccessTokenClaims`. No token, signature, key, or claim value ever
 * appears in an error or reason.
 *
 * Token format (opaque to clients): `<base64url(claimsJSON)>.<base64url(hmac)>`.
 */

export const MIN_ACCESS_TOKEN_SIGNING_KEY_LENGTH = 32;

/** Value-free error (no key / token / signature echoed). */
export class AccessTokenSignError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccessTokenSignError";
  }
}

function assertSigningKey(key: unknown): asserts key is string {
  if (typeof key !== "string" || key.length < MIN_ACCESS_TOKEN_SIGNING_KEY_LENGTH) {
    throw new AccessTokenSignError("Access-token signing key is missing or too short.");
  }
}

const B64URL_RE = /^[A-Za-z0-9_-]+$/;

function hmac(key: string, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

/** Build + validate the 9-field claim set. exp is derived from iat + ttl. */
export function buildAccessTokenClaims(input: {
  userId: string;
  deviceSessionId: string;
  sessionVersion: number;
  tokenId: string;
  issuer: string;
  audience: string;
  issuedAt: number;
  ttlSeconds: number;
}): AccessTokenClaims {
  const claims = {
    sub: input.userId,
    sid: input.deviceSessionId,
    sv: input.sessionVersion,
    jti: input.tokenId,
    typ: MOBILE_ACCESS_TOKEN_TYP,
    iss: input.issuer,
    aud: input.audience,
    iat: input.issuedAt,
    exp: input.issuedAt + input.ttlSeconds
  };
  const parsed = accessTokenClaimsSchema.safeParse(claims);
  if (!parsed.success) {
    throw new AccessTokenSignError("Access-token claims are invalid.");
  }
  return parsed.data;
}

/** Sign a validated claim set. Rejects extra/unknown fields via the strict schema. */
export function signAccessToken(claims: AccessTokenClaims, key: string): string {
  assertSigningKey(key);
  const parsed = accessTokenClaimsSchema.safeParse(claims);
  if (!parsed.success) throw new AccessTokenSignError("Access-token claims are invalid.");
  const payloadB64 = Buffer.from(JSON.stringify(parsed.data), "utf8").toString("base64url");
  const sigB64 = hmac(key, payloadB64).toString("base64url");
  return `${payloadB64}.${sigB64}`;
}

export type AccessTokenSignVerifyResult =
  | { ok: true; claims: AccessTokenClaims }
  | { ok: false; reason: "malformed_token" | "bad_signature" | ClaimVerifyReason };

/**
 * Verify signature (constant time) then claim set. Any structural problem fails
 * closed with a coarse reason; no token / signature / key / claim is echoed.
 */
export function verifyAccessToken(
  token: unknown,
  key: string,
  policy: AccessTokenPolicy,
  now: number
): AccessTokenSignVerifyResult {
  assertSigningKey(key);
  if (typeof token !== "string" || token.length === 0 || token.length > 8192) {
    return { ok: false, reason: "malformed_token" };
  }
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "malformed_token" };
  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64 || !B64URL_RE.test(payloadB64) || !B64URL_RE.test(sigB64)) {
    return { ok: false, reason: "malformed_token" };
  }

  const expected = hmac(key, payloadB64);
  const provided = Buffer.from(sigB64, "base64url");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return { ok: false, reason: "bad_signature" };
  }

  let rawClaims: unknown;
  try {
    rawClaims = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed_token" };
  }

  const verified = verifyAccessTokenClaims(rawClaims, policy, now);
  if (!verified.ok) return { ok: false, reason: verified.reason };
  return { ok: true, claims: verified.claims };
}

/**
 * Parse `Authorization: Bearer <token>` and verify it. Reuses the strict bearer
 * parser (rejects cookie/query/basic/multiple/comma/CRLF/control) then verifies
 * signature + claims. The mobile Bearer boundary is entirely separate from the
 * Web cookie session.
 */
export type BearerVerifyResult =
  | { ok: true; claims: AccessTokenClaims }
  | { ok: false; reason: "missing" | "malformed" | "malformed_token" | "bad_signature" | ClaimVerifyReason };

export function verifyBearerAccessToken(
  authorizationHeader: unknown,
  key: string,
  policy: AccessTokenPolicy,
  now: number
): BearerVerifyResult {
  const parsed = parseBearerAuthorization(authorizationHeader);
  if (!parsed.ok) return { ok: false, reason: parsed.reason };
  return verifyAccessToken(parsed.token, key, policy, now);
}
