import { z } from "zod";

/**
 * Shared primitives. IDs are opaque strings on the wire — no internal database
 * shape is exposed, and DTOs must never embed Prisma model objects.
 * Planning: SHARED_WEB_MOBILE_API_CONTRACT.md §8.
 */

/** Opaque resource identifier. Treated as a bare string; never parsed by clients. */
export const opaqueIdSchema = z.string().min(1).max(128);
export type OpaqueId = z.infer<typeof opaqueIdSchema>;

/**
 * Strict opaque id for untrusted route inputs (e.g. a report id in the path).
 * Tighter than `opaqueIdSchema`: only safe id characters (A-Z a-z 0-9 _ -), so
 * control characters, whitespace, and injection-ish input are rejected BEFORE
 * any database query. An id is never treated as proof of ownership.
 */
export const routeIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);
export type RouteId = z.infer<typeof routeIdSchema>;

/** De-identified request identifier for correlating a single request in logs. */
export const requestIdSchema = z.string().min(1).max(128);

export const localeSchema = z.enum(["en", "zh"]);
export type Locale = z.infer<typeof localeSchema>;

export const paginationQuerySchema = z
  .object({
    cursor: z.string().min(1).max(256).optional(),
    limit: z.number().int().min(1).max(100).default(20)
  })
  .strict();
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export function pageSchema<TSchema extends z.ZodTypeAny>(itemSchema: TSchema) {
  return z
    .object({
      items: z.array(itemSchema),
      nextCursor: z.string().min(1).nullable()
    })
    .strict();
}

/**
 * Fields that must NEVER appear in a shared DTO. Used by the contract tests to
 * assert DTOs stay free of internal / sensitive server state.
 */
export const FORBIDDEN_DTO_FIELDS = [
  "passwordHash",
  "sessionVersion",
  "accessToken",
  "refreshToken",
  "refreshTokenHash",
  "authorization",
  "cookie",
  "email",
  "ip",
  "apiKey",
  "stripeSecret",
  "databaseUrl",
  "prisma"
] as const;
