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
 *
 * The policy and `now` are also validated numerically (finite integers, correct
 * sign) BEFORE any time comparison, so a caller-supplied NaN / Infinity / negative
 * can never make a check fail open. No claim / policy value is echoed in a reason.
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
        | "invalid_policy"
        | "invalid_time"
        | "malformed_claims"
        | "wrong_issuer"
        | "wrong_audience"
        | "invalid_window"
        | "ttl_too_long"
        | "not_yet_valid"
        | "expired";
    };

/** A finite, safe, non-negative integer (Number.isInteger already implies finite). */
function isNonNegativeInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isPolicyValid(policy: AccessTokenPolicy): boolean {
  if (typeof policy.issuer !== "string" || policy.issuer.length === 0) return false;
  if (typeof policy.audience !== "string" || policy.audience.length === 0) return false;
  if (!Number.isInteger(policy.maxTtlSeconds) || policy.maxTtlSeconds <= 0) return false;
  if (policy.clockSkewSeconds !== undefined && !isNonNegativeInt(policy.clockSkewSeconds)) {
    return false;
  }
  return true;
}

/**
 * Validate a decoded claim set against policy at time `now` (epoch seconds).
 * Order: validate policy + now, then claim shape, then identity, then time.
 */
export function verifyAccessTokenClaims(
  rawClaims: unknown,
  policy: AccessTokenPolicy,
  now: number
): AccessTokenVerifyResult {
  // Fail closed on an unusable policy or clock — never fall through to comparisons.
  if (!policy || typeof policy !== "object" || !isPolicyValid(policy)) {
    return { ok: false, reason: "invalid_policy" };
  }
  if (!isNonNegativeInt(now)) {
    return { ok: false, reason: "invalid_time" };
  }

  const parsed = accessTokenClaimsSchema.safeParse(rawClaims);
  if (!parsed.success) return { ok: false, reason: "malformed_claims" };
  const c = parsed.data;

  // typ is a strict literal in the schema, so a wrong typ already failed above
  // as malformed_claims; no separate reachable "wrong_type" branch exists.
  if (c.typ !== MOBILE_ACCESS_TOKEN_TYP) return { ok: false, reason: "malformed_claims" };
  if (c.iss !== policy.issuer) return { ok: false, reason: "wrong_issuer" };
  if (c.aud !== policy.audience) return { ok: false, reason: "wrong_audience" };

  // Temporal window must be well-formed and within the TTL ceiling.
  if (c.exp <= c.iat) return { ok: false, reason: "invalid_window" };
  if (c.exp - c.iat > policy.maxTtlSeconds) return { ok: false, reason: "ttl_too_long" };

  const skew = policy.clockSkewSeconds ?? 0;
  if (c.iat > now + skew) return { ok: false, reason: "not_yet_valid" };
  // Exact expiry boundary fails closed.
  if (c.exp <= now - skew) return { ok: false, reason: "expired" };

  return { ok: true, claims: c };
}
