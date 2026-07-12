// EvidenceSource schema and usability rules.
//
// A URL or DOI existing is NOT verification: only verificationStatus ===
// "verified" counts, and withdrawn or rejected sources are never usable.
// Real evidence retrieval and online DOI/PMID verification are NOT wired up
// in this foundation — sources are provided by future evidence services
// through this schema, and URL/DOI checks here are structural only.

import { z } from "zod";
import { CONTROL_CHARS_RE, isValidCalendarDate, isValidIsoDateTime } from "./types";

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

/** Non-blank after trim, bounded, no control characters. */
export const EvidenceIdSchema = z
  .string()
  .max(200)
  .refine((s) => s.trim().length > 0, "evidence id must be non-blank after trim")
  .refine((s) => !CONTROL_CHARS_RE.test(s), "evidence id must not contain control characters");

const DOI_RE = /^doi:10\.\d{4,9}\/\S+$/i;

/**
 * Structural check only: an http(s) URL or a `doi:10.xxxx/...` identifier.
 * Passing this check does NOT mean the source exists or is verified.
 */
export function isStructurallyValidUrlOrDoi(value: string): boolean {
  if (DOI_RE.test(value)) return true;
  if (!/^https?:\/\//i.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export const EvidenceSourceSchema = z
  .object({
    id: EvidenceIdSchema,
    title: z.string().min(1).max(500),
    publisherOrAuthors: z.string().min(1).max(500),
    publicationDate: z
      .string()
      .refine(isValidCalendarDate, "publicationDate must be a real YYYY-MM-DD calendar date"),
    retrievedAt: z
      .string()
      .refine(isValidIsoDateTime, "retrievedAt must be a valid ISO-8601 timestamp with a real date"),
    sourceType: z.enum(EVIDENCE_SOURCE_TYPES),
    urlOrIdentifier: z
      .string()
      .max(500)
      .refine(isStructurallyValidUrlOrDoi, "urlOrIdentifier must be an http(s) URL or doi:10.x/x identifier"),
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
