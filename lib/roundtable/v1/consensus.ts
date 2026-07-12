// Evidence Consensus Draft (循证共识草稿) schema.
//
// Agent agreement is NOT scientific consensus — every draft must carry that
// disclaimer. Individual clinical directives (diagnosis, prescription,
// dosing, stop-medication advice, disease probability, guaranteed outcomes,
// patient-specific treatment) are forbidden fields and always rejected.

import { z } from "zod";
import { validateAgentPanel } from "./roles";

export const CONSENSUS_DRAFT_NAME_ZH = "循证共识草稿";
export const CONSENSUS_DRAFT_NAME_EN = "Evidence Consensus Draft";

export const AI_CONSENSUS_DISCLAIMER = "智能体一致意见不等于科学共识。";

export const MEDICAL_REVIEW_STATUSES = [
  "pending",
  "approved",
  "revision_required",
  "rejected",
  "high_risk_blocked",
] as const;

export type MedicalReviewStatus = (typeof MEDICAL_REVIEW_STATUSES)[number];

export const FORBIDDEN_CONSENSUS_FIELDS = [
  "diagnosis",
  "prescription",
  "medicationDose",
  "stopMedication",
  "diseaseProbability",
  "guaranteedOutcome",
  "patientSpecificTreatment",
] as const;

const ParticipantSchema = z
  .object({
    role: z.string().min(1),
    completed: z.boolean(),
  })
  .strict();

export const ConsensusDraftSchema = z
  .object({
    topic: z.string().min(1),
    scope: z.string().min(1),
    participants: z.array(ParticipantSchema).min(5),
    confirmedFacts: z.array(z.string()),
    currentConsensus: z.array(z.string()),
    limitedInferences: z.array(z.string()),
    disputedViews: z.array(z.string()),
    adversarialFindings: z.array(z.string()),
    safetyWarnings: z.array(z.string()),
    limitations: z.array(z.string()).min(1),
    notApplicableTo: z.array(z.string()),
    unresolvedQuestions: z.array(z.string()),
    evidenceReferences: z.array(z.string().min(1)),
    medicalReviewStatus: z.enum(MEDICAL_REVIEW_STATUSES),
    version: z.number().int().positive(),
    generatedAt: z.string().min(1),
  })
  .strict()
  .refine((draft) => draft.limitations.includes(AI_CONSENSUS_DISCLAIMER), {
    message: `limitations must include the disclaimer: ${AI_CONSENSUS_DISCLAIMER}`,
    path: ["limitations"],
  });

export type ConsensusDraft = z.infer<typeof ConsensusDraftSchema>;

export interface ConsensusParseResult {
  success: boolean;
  draft: ConsensusDraft | null;
  errors: string[];
}

/**
 * Parse and validate a consensus draft. Forbidden clinical-directive fields
 * are rejected with explicit errors (in addition to strict schema parsing),
 * a valid panel is required, and no draft can claim complete consensus if
 * any participating agent failed.
 */
export function parseConsensusDraft(input: unknown): ConsensusParseResult {
  const errors: string[] = [];
  if (input !== null && typeof input === "object") {
    for (const forbidden of FORBIDDEN_CONSENSUS_FIELDS) {
      if (forbidden in (input as Record<string, unknown>)) {
        errors.push(`forbidden clinical field in consensus draft: ${forbidden}`);
      }
    }
  }
  if (errors.length > 0) {
    return { success: false, draft: null, errors };
  }
  const parsed = ConsensusDraftSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      draft: null,
      errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
    };
  }
  const draft = parsed.data;
  const panel = validateAgentPanel(draft.participants.map((p) => p.role));
  errors.push(...panel.errors);
  for (const participant of draft.participants) {
    if (!participant.completed) {
      errors.push(`agent ${participant.role} failed; draft cannot claim a complete consensus`);
    }
  }
  if (errors.length > 0) {
    return { success: false, draft: null, errors };
  }
  return { success: true, draft, errors: [] };
}
