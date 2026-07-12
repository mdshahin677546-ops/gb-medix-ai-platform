// Post-publication monitoring and revision triggers.
//
// Comments and likes are review SIGNALS, never Evidence, and ordinary likes
// can never change medical facts. A published version is immutable: a
// revision produces a NEW version that re-enters medical review while the
// old version is marked superseded (or under review), never overwritten.

import { z } from "zod";
import { EVIDENCE_LEVELS } from "./evidence";

export const REVISION_TRIGGER_REASONS = [
  "new_high_quality_evidence",
  "source_withdrawn",
  "material_expert_correction",
  "major_safety_report",
  "guideline_updated",
  "content_expired",
] as const;

export type RevisionTriggerReason = (typeof REVISION_TRIGGER_REASONS)[number];

const nonNegativeInt = z.number().int().finite().nonnegative();

export const RevisionSignalsSchema = z
  .object({
    newEvidence: z.array(
      z.object({ evidenceId: z.string().min(1), evidenceLevel: z.enum(EVIDENCE_LEVELS) }).strict()
    ),
    withdrawnEvidence: z.array(z.string().min(1)),
    expertCorrections: z.array(z.object({ id: z.string().min(1), material: z.boolean() }).strict()),
    publicComments: z.array(
      z.object({ id: z.string().min(1), kind: z.enum(["like", "comment", "report"]) }).strict()
    ),
    safetyReports: z.array(z.object({ id: z.string().min(1), severity: z.enum(["minor", "major"]) }).strict()),
    contentAgeDays: nonNegativeInt,
    maxContentAgeDays: z.number().int().finite().positive(),
    guidelineUpdates: z.array(z.string().min(1)),
  })
  .strict();

export type RevisionSignals = z.infer<typeof RevisionSignalsSchema>;

export interface RevisionTriggerResult {
  shouldRevise: boolean;
  reasons: RevisionTriggerReason[];
}

export function evaluateRevisionTriggers(signals: RevisionSignals): RevisionTriggerResult {
  const parsed = RevisionSignalsSchema.parse(signals);
  const reasons: RevisionTriggerReason[] = [];
  if (parsed.newEvidence.some((e) => e.evidenceLevel === "high")) {
    reasons.push("new_high_quality_evidence");
  }
  if (parsed.withdrawnEvidence.length > 0) {
    reasons.push("source_withdrawn");
  }
  if (parsed.expertCorrections.some((c) => c.material)) {
    reasons.push("material_expert_correction");
  }
  if (parsed.safetyReports.some((r) => r.severity === "major")) {
    reasons.push("major_safety_report");
  }
  if (parsed.guidelineUpdates.length > 0) {
    reasons.push("guideline_updated");
  }
  if (parsed.contentAgeDays > parsed.maxContentAgeDays) {
    reasons.push("content_expired");
  }
  // Likes and ordinary comments deliberately trigger nothing.
  return { shouldRevise: reasons.length > 0, reasons };
}

export interface PublishedVersionRef {
  operationId: string;
  version: number;
}

export interface RevisionPlan {
  operationId: string;
  supersededVersion: number;
  previousVersionMarkedAs: "superseded";
  newVersion: number;
  /** Every new version starts unreviewed and must pass the gate again. */
  newVersionReviewStatus: "pending";
  newVersionState: "awaiting_medical_review";
}

/** Pure: never mutates the current version — old versions are immutable. */
export function createRevisionPlan(current: PublishedVersionRef): RevisionPlan {
  if (!Number.isInteger(current.version) || current.version < 1) {
    throw new Error(`Invalid current version: ${String(current.version)}`);
  }
  return Object.freeze({
    operationId: current.operationId,
    supersededVersion: current.version,
    previousVersionMarkedAs: "superseded" as const,
    newVersion: current.version + 1,
    newVersionReviewStatus: "pending" as const,
    newVersionState: "awaiting_medical_review" as const,
  });
}
