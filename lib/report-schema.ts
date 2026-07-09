import { z } from "zod";
import { fallbackResult, type TCMResult } from "@/lib/tcm";

export const RecommendationSchema = z.object({
  category: z.string().min(1),
  content: z.string().min(1)
});

export const ProductSuggestionSchema = z.object({
  category: z.string().min(1),
  title: z.string().min(1),
  reason: z.string().min(1),
  score: z.number().int().min(0).max(100).default(70)
});

export const ReportSchema = z.object({
  healthScore: z.number().int().min(0).max(100),
  constitution: z.string().min(1),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH"]),
  summary: z.string().min(1),
  recommendations: z.array(RecommendationSchema).min(1),
  lifestylePlan: z.array(z.string().min(1)).min(1),
  productSuggestions: z.array(ProductSuggestionSchema).default([]),
  followUpPlan: z.array(z.string().min(1)).default([])
});

export type StructuredReport = z.infer<typeof ReportSchema>;

/**
 * Adapt a validated structured report into the legacy TCMResult shape the
 * current result UI consumes, so the JSON pipeline can coexist with the
 * existing rendering path.
 */
export function structuredReportToTCMResult(report: StructuredReport): TCMResult {
  return {
    bodyInsight: report.summary,
    constitutionType: report.constitution,
    whatYourBodyIsTellingYou: report.summary,
    lifestyleSuggestions: report.recommendations.map((item) => item.content).slice(0, 5),
    riskLevel: report.riskLevel,
    hiddenSignals: report.recommendations
      .map((item) => `${item.category}: ${item.content}`)
      .slice(0, 3),
    sevenDayPlanPreview: report.lifestylePlan.slice(0, 3),
    upgradeCta: fallbackResult.upgradeCta
  };
}

/**
 * A safe structured report used when no AI provider is configured.
 */
export function fallbackStructuredReport(): StructuredReport {
  return {
    healthScore: 84,
    constitution: fallbackResult.constitutionType,
    riskLevel: fallbackResult.riskLevel,
    summary: fallbackResult.bodyInsight,
    recommendations: fallbackResult.lifestyleSuggestions.map((content) => ({
      category: "lifestyle",
      content
    })),
    lifestylePlan: fallbackResult.sevenDayPlanPreview,
    productSuggestions: [],
    followUpPlan: [
      "Recheck your sleep, energy, digestion, and stress pattern in 7 days.",
      "Save notes on what changed after trying the lifestyle guidance."
    ]
  };
}

export function toFreeReportPayload(report: StructuredReport) {
  return {
    healthScore: report.healthScore,
    constitution: report.constitution,
    riskLevel: report.riskLevel,
    summary: report.summary,
    basicInsights: [
      report.summary,
      `Current wellness pattern: ${report.constitution}`
    ],
    limitedRecommendations: report.recommendations.slice(0, 3)
  };
}

/**
 * Instruction appended to the model prompt so it returns JSON matching ReportSchema.
 */
export function reportJsonInstruction() {
  return `Return only valid JSON with this exact shape:
{
  "healthScore": number from 0 to 100,
  "constitution": "short TCM-inspired constitution label",
  "riskLevel": "LOW" | "MEDIUM" | "HIGH",
  "summary": "wellness summary, not diagnosis",
  "recommendations": [{"category": "sleep|diet|stress|activity|general", "content": "wellness recommendation"}],
  "lifestylePlan": ["day-by-day or step-by-step lifestyle action"],
  "productSuggestions": [{"category": "sleep|nutrition|stress|activity|general", "title": "general wellness product category", "reason": "why it may support the plan", "score": number from 0 to 100}],
  "followUpPlan": ["non-clinical follow-up action"]
}`;
}
