import { z } from "zod";
import { opaqueIdSchema, localeSchema } from "./common";

/**
 * Product recommendation DTO. Recommendations reference REAL products only —
 * a model must never invent SKU, price, stock, or efficacy. When no real product
 * fits, the server returns an empty list.
 * Planning: SHARED_WEB_MOBILE_API_CONTRACT.md §6.
 */

export const productRecommendationSchema = z
  .object({
    productId: opaqueIdSchema,
    category: z.string().min(1),
    reason: z.string().min(1),
    score: z.number().int().min(0).max(100),
    locale: localeSchema,
    availability: z.enum(["available", "unavailable", "unknown"])
  })
  .strict();
export type ProductRecommendation = z.infer<typeof productRecommendationSchema>;

export const productRecommendationListSchema = z
  .object({ items: z.array(productRecommendationSchema) })
  .strict();
export type ProductRecommendationList = z.infer<typeof productRecommendationListSchema>;
