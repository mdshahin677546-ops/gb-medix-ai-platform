// Evidence Consensus Draft (循证共识草稿) schema with a hard AI trust boundary.
//
// P1-005: AI draft input can NEVER carry review or publication state. The
// input schema is strict and rejects medicalReviewStatus / reviewerId /
// reviewedAt / approval / publicationStatus / publishedAt / withdrawn /
// superseded outright. After a successful parse, TRUSTED code fixes
// medicalReviewStatus = "pending"; the only way to change it is
// applyMedicalReviewDecision with an external MedicalReviewDecision.
//
// Agent agreement is NOT scientific consensus — every draft must carry that
// disclaimer. Individual clinical directives (diagnosis, prescription,
// dosing, stop-medication advice, disease probability, guaranteed outcomes,
// patient-specific treatment) are forbidden fields and always rejected.

import { z } from "zod";
import { validateAgentPanel } from "./roles";
import { MedicalReviewDecisionSchema } from "./review-gate";
import { MEDICAL_REVIEW_STATUSES } from "./types";

export const CONSENSUS_DRAFT_NAME_ZH = "循证共识草稿";
export const CONSENSUS_DRAFT_NAME_EN = "Evidence Consensus Draft";

export const AI_CONSENSUS_DISCLAIMER = "智能体一致意见不等于科学共识。";

export const FORBIDDEN_CONSENSUS_FIELDS = [
  "diagnosis",
  "prescription",
  "medicationDose",
  "stopMedication",
  "diseaseProbability",
  "guaranteedOutcome",
  "patientSpecificTreatment",
] as const;

/** Review/publication state fields AI input may never contain (P1-005). */
export const FORBIDDEN_AI_REVIEW_FIELDS = [
  "medicalReviewStatus",
  "reviewerId",
  "reviewedAt",
  "approval",
  "publicationStatus",
  "publishedAt",
  "withdrawn",
  "superseded",
] as const;

const ParticipantSchema = z
  .object({
    role: z.string().min(1),
    completed: z.boolean(),
  })
  .strict();

const consensusContentShape = {
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
  version: z.number().int().positive(),
  generatedAt: z.string().min(1),
};

/** What the AI pipeline is allowed to produce — NO review state fields. */
export const AiConsensusDraftInputSchema = z
  .object(consensusContentShape)
  .strict()
  .refine((draft) => draft.limitations.includes(AI_CONSENSUS_DISCLAIMER), {
    message: `limitations must include the disclaimer: ${AI_CONSENSUS_DISCLAIMER}`,
    path: ["limitations"],
  });

/** Trusted representation: content plus the system-managed review status. */
export const ConsensusDraftSchema = z
  .object({
    ...consensusContentShape,
    medicalReviewStatus: z.enum(MEDICAL_REVIEW_STATUSES),
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
 * Parse and validate an AI-produced consensus draft. Forbidden
 * clinical-directive fields AND review/publication state fields are
 * rejected with explicit errors; a valid panel is required; no draft can
 * claim complete consensus if any participating agent failed. On success
 * the returned draft ALWAYS has medicalReviewStatus = "pending" — the AI
 * cannot submit approved or rejected.
 */
export function parseConsensusDraft(input: unknown): ConsensusParseResult {
  const errors: string[] = [];
  if (input !== null && typeof input === "object") {
    for (const forbidden of FORBIDDEN_CONSENSUS_FIELDS) {
      if (forbidden in (input as Record<string, unknown>)) {
        errors.push(`forbidden clinical field in consensus draft: ${forbidden}`);
      }
    }
    for (const forbidden of FORBIDDEN_AI_REVIEW_FIELDS) {
      if (forbidden in (input as Record<string, unknown>)) {
        errors.push(`AI draft input may not carry review/publication state: ${forbidden}`);
      }
    }
  }
  if (errors.length > 0) {
    return { success: false, draft: null, errors };
  }
  const parsed = AiConsensusDraftInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      draft: null,
      errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
    };
  }
  const content = parsed.data;
  const panel = validateAgentPanel(content.participants.map((p) => p.role));
  errors.push(...panel.errors);
  for (const participant of content.participants) {
    if (!participant.completed) {
      errors.push(`agent ${participant.role} failed; draft cannot claim a complete consensus`);
    }
  }
  if (errors.length > 0) {
    return { success: false, draft: null, errors };
  }
  // Trusted code fixes the initial review status — always pending.
  return { success: true, draft: { ...content, medicalReviewStatus: "pending" }, errors: [] };
}

/**
 * The ONLY way a draft's review status changes: applying a trusted external
 * MedicalReviewDecision. The decision must target the draft's exact
 * version — a new version never inherits an old decision. Returns a new
 * draft; the input draft is never mutated.
 */
export function applyMedicalReviewDecision(draft: ConsensusDraft, decision: unknown): ConsensusDraft {
  const validDraft = ConsensusDraftSchema.parse(draft);
  const validDecision = MedicalReviewDecisionSchema.parse(decision);
  if (validDecision.contentVersion !== validDraft.version) {
    throw new Error(
      `Review decision targets version ${validDecision.contentVersion} but draft is version ${validDraft.version}; decisions never transfer across versions`
    );
  }
  return { ...validDraft, medicalReviewStatus: validDecision.decision };
}
