// EvidenceSource schema and usability rules.
//
// A URL or DOI existing is NOT verification: only verificationStatus ===
// "verified" counts, and withdrawn or rejected sources are never usable.
// Real evidence retrieval is not wired up in this foundation — sources are
// provided by future evidence services through this schema.

import { z } from "zod";

export const EVIDENCE_SOURCE_TYPES = [
  "guideline",
  "systematic_review",
  "meta_analysis",
  "randomized_trial",
  "observational_study",
  "regulatory_notice",
  "consensus_statement",
  "expert_opinion",
  "other",
] as const;

export const EVIDENCE_VERIFICATION_STATUSES = ["pending", "verified", "rejected", "withdrawn"] as const;

export const EVIDENCE_LEVELS = ["high", "moderate", "low", "very_low"] as const;

export const EvidenceSourceSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    publisherOrAuthors: z.string().min(1),
    publicationDate: z.string().min(1),
    retrievedAt: z.string().min(1),
    sourceType: z.enum(EVIDENCE_SOURCE_TYPES),
    urlOrIdentifier: z.string().min(1),
    evidenceLevel: z.enum(EVIDENCE_LEVELS),
    verificationStatus: z.enum(EVIDENCE_VERIFICATION_STATUSES),
    withdrawn: z.boolean(),
    expired: z.boolean(),
    conflictOfInterestNote: z.string().nullable(),
  })
  .strict();

export type EvidenceSource = z.infer<typeof EvidenceSourceSchema>;

export interface EvidenceUsability {
  usable: boolean;
  reasons: string[];
}

/**
 * Usable evidence must be verified and not withdrawn. Expired evidence is
 * flagged: it may only support a claim that explicitly notes the limitation.
 */
export function evaluateEvidenceUsability(source: EvidenceSource): EvidenceUsability {
  const parsed = EvidenceSourceSchema.parse(source);
  const reasons: string[] = [];
  if (parsed.verificationStatus !== "verified") {
    reasons.push(`evidence ${parsed.id} is not verified (status: ${parsed.verificationStatus})`);
  }
  if (parsed.withdrawn || parsed.verificationStatus === "withdrawn") {
    reasons.push(`evidence ${parsed.id} has been withdrawn`);
  }
  return { usable: reasons.length === 0, reasons };
}
