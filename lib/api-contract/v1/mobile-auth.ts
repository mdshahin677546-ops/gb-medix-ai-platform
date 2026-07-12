import { z } from "zod";
import { opaqueIdSchema } from "./common";

/**
 * GB MEDIX AI — Mobile Auth / DeviceSession public contract (batch 2.2A).
 *
 * Contract + strict schemas only. This batch introduces NO Prisma model, no real
 * login/refresh/logout route, no production signing key, and no SecureStore.
 * Mobile auth stays separate from the Web cookie session; these are the shared
 * wire shapes a later, Codex-approved implementation will fill in.
 */

/** Opaque identifiers — bare strings on the wire, never parsed by clients. */
export const deviceSessionIdSchema = opaqueIdSchema;
export type DeviceSessionId = z.infer<typeof deviceSessionIdSchema>;

export const tokenFamilyIdSchema = opaqueIdSchema;
export type TokenFamilyId = z.infer<typeof tokenFamilyIdSchema>;

export const tokenIdSchema = opaqueIdSchema;
export type TokenId = z.infer<typeof tokenIdSchema>;

/** Fixed access-token type tag; any other value is rejected. */
export const MOBILE_ACCESS_TOKEN_TYP = "gbmedix_mobile_at" as const;

/**
 * Access token claims — a strict allowlist. Only these nine fields are permitted;
 * any extra field (email, phone, health, payment, consent, entitlement, device
 * fingerprint, refresh token / hash, …) is rejected by `.strict()`. The token
 * carries NO user status / verified flag / entitlement — those are server facts
 * resolved per request, never trusted from the token body.
 */
export const accessTokenClaimsSchema = z
  .object({
    sub: z.string().min(1).max(128), // userId
    sid: z.string().min(1).max(128), // device session id
    sv: z.number().int().min(0), // sessionVersion snapshot (revalidated server-side)
    jti: z.string().min(1).max(128), // unique token id
    typ: z.literal(MOBILE_ACCESS_TOKEN_TYP),
    iss: z.string().min(1).max(256),
    aud: z.string().min(1).max(256),
    iat: z.number().int().nonnegative(),
    exp: z.number().int().nonnegative()
  })
  .strict();
export type AccessTokenClaims = z.infer<typeof accessTokenClaimsSchema>;

/**
 * Canonical refresh-token format — the SINGLE source of truth. Both the public
 * contract schemas below and lib/mobile-auth/v1/refresh-token.ts consume these,
 * so the format can never drift between the wire contract and the crypto util.
 *
 * Format: gbrt_v1_<base64url body>. The body is base64url ONLY (A-Z a-z 0-9 _ -),
 * so `+`, `/`, `=`, whitespace, and control characters are rejected, and it must
 * be long enough to encode >= 32 random bytes.
 */
export const REFRESH_TOKEN_PREFIX = "gbrt_v1_" as const;
/** base64url of 32 bytes = 43 chars. */
export const REFRESH_TOKEN_MIN_BODY_LENGTH = 43;
export const REFRESH_TOKEN_MAX_LENGTH = 256;

export const REFRESH_TOKEN_REGEX = new RegExp(
  `^${REFRESH_TOKEN_PREFIX}[A-Za-z0-9_-]{${REFRESH_TOKEN_MIN_BODY_LENGTH},}$`
);

/** Strict refresh-token string schema (prefix + base64url body, length-bounded). */
export const refreshTokenSchema = z
  .string()
  .min(1)
  .max(REFRESH_TOKEN_MAX_LENGTH)
  .regex(REFRESH_TOKEN_REGEX);
export type RefreshTokenString = z.infer<typeof refreshTokenSchema>;

export const mobileRefreshRequestSchema = z
  .object({
    refreshToken: refreshTokenSchema
  })
  .strict();
export type MobileRefreshRequest = z.infer<typeof mobileRefreshRequestSchema>;

/**
 * Refresh result. The new refresh token plaintext is returned EXACTLY ONCE here
 * (never stored/logged/audited afterward); only its hash is ever persisted.
 */
export const mobileRefreshResultSchema = z
  .object({
    accessToken: z.string().min(1),
    refreshToken: refreshTokenSchema,
    accessTokenExpiresInSeconds: z.number().int().positive(),
    deviceSessionId: deviceSessionIdSchema
  })
  .strict();
export type MobileRefreshResult = z.infer<typeof mobileRefreshResultSchema>;

export const mobileLogoutRequestSchema = z
  .object({
    refreshToken: refreshTokenSchema
  })
  .strict();
export type MobileLogoutRequest = z.infer<typeof mobileLogoutRequestSchema>;

/**
 * Logout-all takes no client-provided userId; the acting user is resolved from
 * the authenticated request server-side. `.strict()` rejects any smuggled field.
 */
export const mobileLogoutAllRequestSchema = z.object({}).strict();
export type MobileLogoutAllRequest = z.infer<typeof mobileLogoutAllRequestSchema>;
