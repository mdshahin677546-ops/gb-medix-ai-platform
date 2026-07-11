import { z } from "zod";
import { opaqueIdSchema } from "./common";

/**
 * Auth DTOs — request/response shapes only. This batch defines NO token issuance,
 * refresh, or DeviceSession logic. Real mobile auth is BLOCKED pending a
 * Codex-approved DeviceSession + refresh-token design
 * (MOBILE_APP_IMPLEMENTATION_PLAN.md §6). Tokens are opaque strings on the wire;
 * their format, storage, and rotation are intentionally NOT specified here.
 */

export const registerRequestSchema = z
  .object({ email: z.string().email() })
  .strict();
export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const loginRequestSchema = z
  .object({ email: z.string().email() })
  .strict();
export type LoginRequest = z.infer<typeof loginRequestSchema>;

/** Refresh is type-only in this batch — no runtime refresh flow is implemented. */
export const refreshRequestSchema = z
  .object({ refreshToken: z.string().min(1) })
  .strict();
export type RefreshRequest = z.infer<typeof refreshRequestSchema>;

export const userStatusSchema = z.enum(["pending", "active"]);

/** Public "me" DTO — deliberately excludes sessionVersion, tokens, email PII beyond what a client needs. */
export const meSchema = z
  .object({
    id: opaqueIdSchema,
    status: userStatusSchema,
    emailVerified: z.boolean(),
    locale: z.enum(["en", "zh"]).optional()
  })
  .strict();
export type Me = z.infer<typeof meSchema>;

/**
 * Auth session tokens are represented as opaque strings ONLY. No claims, TTL, or
 * signing detail is part of the shared contract in this batch (BLOCKED).
 */
export const authTokensSchema = z
  .object({
    accessToken: z.string().min(1),
    refreshToken: z.string().min(1),
    expiresInSeconds: z.number().int().positive()
  })
  .strict();
export type AuthTokens = z.infer<typeof authTokensSchema>;
