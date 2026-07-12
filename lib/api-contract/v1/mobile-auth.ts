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

/** A refresh token on the wire is an opaque, length-bounded string. */
const refreshTokenWireSchema = z.string().min(1).max(256);

export const mobileRefreshRequestSchema = z
  .object({
    refreshToken: refreshTokenWireSchema
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
    refreshToken: refreshTokenWireSchema,
    accessTokenExpiresInSeconds: z.number().int().positive(),
    deviceSessionId: deviceSessionIdSchema
  })
  .strict();
export type MobileRefreshResult = z.infer<typeof mobileRefreshResultSchema>;

export const mobileLogoutRequestSchema = z
  .object({
    refreshToken: refreshTokenWireSchema
  })
  .strict();
export type MobileLogoutRequest = z.infer<typeof mobileLogoutRequestSchema>;

/**
 * Logout-all takes no client-provided userId; the acting user is resolved from
 * the authenticated request server-side. `.strict()` rejects any smuggled field.
 */
export const mobileLogoutAllRequestSchema = z.object({}).strict();
export type MobileLogoutAllRequest = z.infer<typeof mobileLogoutAllRequestSchema>;
