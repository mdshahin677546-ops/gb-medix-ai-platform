import { z } from "zod";
import { opaqueIdSchema } from "./common";

/**
 * Entitlement DTOs. Entitlement is the single source of truth for premium access
 * across surfaces. `source` is a PLANNED enum semantic only — this batch does NOT
 * modify the Entitlement database structure or add a `source` column.
 * Payment fact != entitlement fact. Client purchase success != server activation.
 * Planning: PARALLEL_DEVELOPMENT_ROADMAP.md §8, SHARED_WEB_MOBILE_API_CONTRACT.md §7.
 */

/** PLANNED enum — not yet backed by the database. */
export const entitlementSourceSchema = z.enum([
  "stripe",
  "apple",
  "google",
  "admin",
  "promotion"
]);
export type EntitlementSource = z.infer<typeof entitlementSourceSchema>;

export const entitlementStatusSchema = z.enum([
  "pending",
  "active",
  "expired",
  "revoked",
  "refunded",
  "disputed",
  "cancelled"
]);
export type EntitlementStatus = z.infer<typeof entitlementStatusSchema>;

export const entitlementSchema = z
  .object({
    id: opaqueIdSchema,
    productCode: z.string().min(1),
    resourceType: z.string().min(1).nullable(),
    resourceId: opaqueIdSchema.nullable(),
    status: entitlementStatusSchema,
    /** PLANNED: source is optional until the server-verified source model ships. */
    source: entitlementSourceSchema.optional(),
    expiresAt: z.string().datetime().nullable()
  })
  .strict();
export type Entitlement = z.infer<typeof entitlementSchema>;

/**
 * Paginated entitlement list response (batch 2.1, additive — does NOT change
 * `entitlementSchema`). `nextCursor` is an opaque pagination token or null; the
 * list is always scoped server-side to the authenticated user.
 */
export const entitlementListResponseSchema = z
  .object({
    entitlements: z.array(entitlementSchema),
    nextCursor: z.string().min(1).nullable()
  })
  .strict();
export type EntitlementListResponse = z.infer<typeof entitlementListResponseSchema>;
