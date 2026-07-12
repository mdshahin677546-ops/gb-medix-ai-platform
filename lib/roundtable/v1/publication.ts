// PublicationPlan — the ONLY publication output of this foundation.
//
// This round never writes to a database and never renders a public page:
// an approved run produces a plan object that a future, separately-reviewed
// publishing system may execute idempotently.

import { z } from "zod";
import { evaluatePublicationGate, PublicationGateInput } from "./review-gate";

export const HOMEPAGE_PLACEMENTS = ["featured", "standard", "none"] as const;

export const PublicationPlanSchema = z
  .object({
    publicationIdempotencyKey: z.string().min(1),
    approvedVersion: z.number().int().positive(),
    /** Opaque reviewer identifier from a future external review system. */
    approvedByReviewerId: z.string().min(1),
    approvedAt: z.string().min(1),
    languages: z.array(z.string().min(2)).min(1),
    homepagePlacement: z.enum(HOMEPAGE_PLACEMENTS),
    auditReference: z.string().min(1),
  })
  .strict();

export type PublicationPlan = z.infer<typeof PublicationPlanSchema>;

export interface CreatePublicationPlanInput {
  operationId: string;
  gate: PublicationGateInput;
  approvedVersion: number;
  approvedByReviewerId: string;
  approvedAt: string;
  languages: string[];
  homepagePlacement: (typeof HOMEPAGE_PLACEMENTS)[number];
  auditReference: string;
}

/**
 * Deterministic: publishing the same operation + version always yields the
 * same idempotency key, so a retried publish can never double-publish.
 */
export function buildPublicationIdempotencyKey(operationId: string, approvedVersion: number): string {
  if (!Number.isInteger(approvedVersion) || approvedVersion < 1) {
    throw new Error(`Invalid approved version: ${String(approvedVersion)}`);
  }
  return `publish:${operationId}:v${approvedVersion}`;
}

export function createPublicationPlan(input: CreatePublicationPlanInput): PublicationPlan {
  const gate = evaluatePublicationGate(input.gate);
  if (!gate.canPublish) {
    throw new Error(`Publication gate failed: ${gate.failures.join("; ")}`);
  }
  return PublicationPlanSchema.parse({
    publicationIdempotencyKey: buildPublicationIdempotencyKey(input.operationId, input.approvedVersion),
    approvedVersion: input.approvedVersion,
    approvedByReviewerId: input.approvedByReviewerId,
    approvedAt: input.approvedAt,
    languages: [...new Set(input.languages)],
    homepagePlacement: input.homepagePlacement,
    auditReference: input.auditReference,
  });
}
