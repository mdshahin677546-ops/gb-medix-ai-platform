import { z } from "zod";
import {
  freeReportSchema,
  premiumReportSchema,
  recommendationSchema,
  reportStatusSchema,
  reportSummarySchema,
  reportTypeSchema,
  type FreeReport,
  type PremiumReport,
  type ReportSummary
} from "../../api-contract/v1/report";

/**
 * Map AIReport rows to the shared read-only report DTOs.
 *
 * IDOR is enforced upstream by querying { id, userId }; these mappers only shape
 * already-owned rows. Never emitted: userId, assessmentId, raw analysis JSON,
 * prompts, provider output, payment / entitlement objects. All outputs are
 * validated by the real shared report schemas (.strict()).
 */

export type ReportRow = {
  id: string;
  type: string;
  status: string;
  score: number;
  summary: string;
  analysis: unknown;
  recommendations: unknown;
  lifestylePlan: unknown;
  followUpPlan: unknown;
  createdAt: Date | string;
};

export type ReportDetail =
  | { kind: "not_serviceable" }
  | { kind: "locked" }
  | { kind: "summary"; data: ReportSummary }
  | { kind: "free"; data: FreeReport }
  | { kind: "premium"; data: PremiumReport };

const FREE_TYPE = "free_health_report";
const PREMIUM_TYPE = "premium_health_report";

// Only constitution + riskLevel are read from the analysis blob; every other
// field comes from typed columns. passthrough() tolerates extra analysis keys.
const analysisCoreSchema = z
  .object({
    constitution: z.string().min(1),
    riskLevel: z.enum(["LOW", "MEDIUM", "HIGH"])
  })
  .passthrough();

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function isServiceableType(type: string): boolean {
  return reportTypeSchema.safeParse(type).success;
}

function isReadyStatus(status: string): boolean {
  return status === "free_ready" || status === "premium_ready";
}

function parseRecommendations(value: unknown) {
  const parsed = z.array(recommendationSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

function parseStringList(value: unknown): string[] {
  const parsed = z.array(z.string().min(1)).safeParse(value);
  return parsed.success ? parsed.data : [];
}

/** List summary. Assumes a contract-serviceable type/status (see reports list query). */
export function toReportSummaryDTO(row: ReportRow): ReportSummary {
  return reportSummarySchema.parse({
    id: row.id,
    type: reportTypeSchema.parse(row.type),
    status: reportStatusSchema.parse(row.status),
    score: row.score,
    summary: row.summary,
    createdAt: toIso(row.createdAt)
  });
}

/**
 * Resolve a single report to its safe DTO variant.
 *
 * - Premium report + no active entitlement -> "locked" (route answers 402).
 * - Not-yet-ready (generating/failed)      -> "summary".
 * - Ready free / ready premium (entitled)  -> full free / premium DTO.
 * - Unknown/legacy type                    -> "not_serviceable" (route answers 404).
 *
 * `entitled` MUST be the result of the server-side resource-scoped entitlement
 * check; this mapper never decides entitlement itself.
 */
export function toReportDetailDTO(row: ReportRow, entitled: boolean): ReportDetail {
  if (!isServiceableType(row.type)) return { kind: "not_serviceable" };

  const isPremium = row.type === PREMIUM_TYPE;
  if (isPremium && !entitled) return { kind: "locked" };

  if (!isReadyStatus(row.status)) {
    return { kind: "summary", data: toReportSummaryDTO(row) };
  }

  const analysis = analysisCoreSchema.safeParse(row.analysis);
  if (!analysis.success) {
    // Ready row without a usable analysis blob: fall back to the safe summary
    // rather than fabricate constitution/riskLevel.
    return { kind: "summary", data: toReportSummaryDTO(row) };
  }

  if (row.type === FREE_TYPE) {
    return {
      kind: "free",
      data: freeReportSchema.parse({
        id: row.id,
        type: FREE_TYPE,
        healthScore: row.score,
        constitution: analysis.data.constitution,
        riskLevel: analysis.data.riskLevel,
        summary: row.summary,
        limitedRecommendations: parseRecommendations(row.recommendations)
      })
    };
  }

  return {
    kind: "premium",
    data: premiumReportSchema.parse({
      id: row.id,
      type: PREMIUM_TYPE,
      healthScore: row.score,
      constitution: analysis.data.constitution,
      riskLevel: analysis.data.riskLevel,
      summary: row.summary,
      recommendations: parseRecommendations(row.recommendations),
      lifestylePlan: parseStringList(row.lifestylePlan),
      followUpPlan: parseStringList(row.followUpPlan)
    })
  };
}
