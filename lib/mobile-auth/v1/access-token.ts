import {
  accessTokenClaimsSchema,
  MOBILE_ACCESS_TOKEN_TYP,
  type AccessTokenClaims
} from "../../api-contract/v1/mobile-auth";

/**
 * Access-token CLAIMS verification (pure). This batch does NOT verify a real
 * cryptographic signature (no production signing key is wired in here); it
 * strictly validates the decoded claim SET — type, issuer, audience, temporal
 * window, and TTL bound — and rejects unknown fields via the strict schema.
 */

export type AccessTokenPolicy = {
  issuer: string;
  audience: string;
  maxTtlSeconds: number;
  /** Allowed clock skew in seconds (default 0). */
  clockSkewSeconds?: number;
};

export type AccessTokenVerifyResult =
  | { ok: true; claims: AccessTokenClaims }
  | {
      ok: false;
      reason:
        | "malformed_claims"
        | "wrong_type"
        | "wrong_issuer"
        | "wrong_audience"
        | "invalid_window"
        | "ttl_too_long"
        | "not_yet_valid"
        | "expired";
    };

/**
 * Validate a decoded claim set against policy at time `now` (epoch seconds).
 * Order matters: shape first, then identity, then time. No claim value is echoed
 * in the reason.
 */
export function verifyAccessTokenClaims(
  rawClaims: unknown,
  policy: AccessTokenPolicy,
  now: number
): AccessTokenVerifyResult {
  const parsed = accessTokenClaimsSchema.safeParse(rawClaims);
  if (!parsed.success) return { ok: false, reason: "malformed_claims" };
  const c = parsed.data;

  if (c.typ !== MOBILE_ACCESS_TOKEN_TYP) return { ok: false, reason: "wrong_type" };
  if (c.iss !== policy.issuer) return { ok: false, reason: "wrong_issuer" };
  if (c.aud !== policy.audience) return { ok: false, reason: "wrong_audience" };

  // Temporal window must be well-formed and within the TTL ceiling.
  if (c.exp <= c.iat) return { ok: false, reason: "invalid_window" };
  if (c.exp - c.iat > policy.maxTtlSeconds) return { ok: false, reason: "ttl_too_long" };

  const skew = policy.clockSkewSeconds ?? 0;
  if (c.iat > now + skew) return { ok: false, reason: "not_yet_valid" };
  if (c.exp <= now - skew) return { ok: false, reason: "expired" };

  return { ok: true, claims: c };
}
