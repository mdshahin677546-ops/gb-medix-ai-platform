import { z } from "zod";
import { opaqueIdSchema } from "./common";

/**
 * Report DTOs. Free reports desensitize premium fields; premium access is
 * gated by Entitlement server-side (ENTITLEMENT_REQUIRED / 402). Reads are
 * IDOR-safe by scoping to { id, userId } on the server.
 * Planning: SHARED_WEB_MOBILE_API_CONTRACT.md §Report.
 */

export const reportTypeSchema = z.enum(["free_health_report", "premium_health_report"]);
export const reportStatusSchema = z.enum([
  "free_generating",
  "free_ready",
  "premium_generating",
  "premium_ready",
  "failed"
]);

export const recommendationSchema = z
  .object({ category: z.string().min(1), content: z.string().min(1) })
  .strict();

export const reportSummarySchema = z
  .object({
    id: opaqueIdSchema,
    type: reportTypeSchema,
    status: reportStatusSchema,
    score: z.number().int().min(0).max(100),
    summary: z.string(),
    createdAt: z.string().datetime()
  })
  .strict();
export type ReportSummary = z.infer<typeof reportSummarySchema>;

export const freeReportSchema = z
  .object({
    id: opaqueIdSchema,
    type: z.literal("free_health_report"),
    healthScore: z.number().int().min(0).max(100),
    constitution: z.string().min(1),
    riskLevel: z.enum(["LOW", "MEDIUM", "HIGH"]),
    summary: z.string().min(1),
    limitedRecommendations: z.array(recommendationSchema)
  })
  .strict();
export type FreeReport = z.infer<typeof freeReportSchema>;

export const premiumReportSchema = z
  .object({
    id: opaqueIdSchema,
    type: z.literal("premium_health_report"),
    healthScore: z.number().int().min(0).max(100),
    constitution: z.string().min(1),
    riskLevel: z.enum(["LOW", "MEDIUM", "HIGH"]),
    summary: z.string().min(1),
    recommendations: z.array(recommendationSchema),
    lifestylePlan: z.array(z.string().min(1)),
    followUpPlan: z.array(z.string().min(1))
  })
  .strict();
export type PremiumReport = z.infer<typeof premiumReportSchema>;
