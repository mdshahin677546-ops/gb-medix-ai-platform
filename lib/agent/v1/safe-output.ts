import { z } from "zod";

/**
 * Safe agent output schema — limited to health-management guidance. Forbidden
 * clinical fields are rejected by construction (.strict()), and a guard also
 * rejects any object carrying forbidden keys.
 * Planning: AI_AGENT_CONSULTATION_PLAN.md §safe output.
 */

export const agentSafeOutputSchema = z
  .object({
    summary: z.string().min(1),
    wellnessObservations: z.array(z.string().min(1)).default([]),
    lifestyleSuggestions: z.array(z.string().min(1)).default([]),
    safetyNotice: z.string().optional(),
    professionalHelpRecommendation: z.string().optional(),
    nextQuestion: z.string().optional(),
    escalationRequired: z.boolean().default(false)
  })
  .strict();
export type AgentSafeOutput = z.infer<typeof agentSafeOutputSchema>;

/** Fields the model must never produce. */
export const FORBIDDEN_OUTPUT_FIELDS = [
  "diagnosis",
  "prescription",
  "medicationDose",
  "diseaseProbability",
  "treatmentPlan",
  "stopMedication",
  "guaranteedOutcome"
] as const;

const FORBIDDEN_SET: ReadonlySet<string> = new Set(
  FORBIDDEN_OUTPUT_FIELDS.map((f) => f.toLowerCase())
);

export function findForbiddenOutputFields(obj: Record<string, unknown>): string[] {
  return Object.keys(obj).filter((k) => FORBIDDEN_SET.has(k.toLowerCase()));
}

/**
 * Validate model-shaped output. Rejects (returns null) if forbidden fields are
 * present OR the safe schema fails. Never returns partially-valid clinical data.
 */
export function parseSafeOutput(raw: unknown): AgentSafeOutput | null {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    if (findForbiddenOutputFields(raw as Record<string, unknown>).length > 0) return null;
  }
  const parsed = agentSafeOutputSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
