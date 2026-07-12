// EvidenceSource schema and usability rules.
//
// A URL or DOI existing is NOT verification: only verificationStatus ===
// "verified" counts, and withdrawn or rejected sources are never usable.
// Real evidence retrieval and online DOI/PMID verification are NOT wired up
// in this foundation — sources are provided by future evidence services
// through this schema, and URL/DOI checks here are structural only.

import { z } from "zod";
import { CONTROL_CHARS_RE, ID_UNSAFE_CHARS_RE, isValidCalendarDate, isValidIsoDateTime } from "./types";

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

/**
 * Shared id policy for EvidenceSource ids AND claim reference ids (single
 * source of truth — claims.ts imports this schema). Checked on the RAW
 * string BEFORE any trim: no whitespace of any kind (ASCII space, NBSP
 * U+00A0, ideographic space U+3000), no zero-width/invisible characters
 * (U+200B..U+200F, U+2060, U+FEFF, soft hyphen), no control characters —
 * as prefix, suffix or anywhere inside the id.
 */
export const EvidenceIdSchema = z
  .string()
  .min(1)
  .max(200)
  .refine((raw) => !ID_UNSAFE_CHARS_RE.test(raw), "id must not contain whitespace or invisible characters")
  .refine((raw) => !CONTROL_CHARS_RE.test(raw), "id must not contain control characters");

const DOI_RE = /^doi:10\.\d{4,9}\/\S+$/i;

/**
 * Structural check only: an http(s) URL or a `doi:10.xxxx/...` identifier.
 * URLs must carry NO credentials — username and password (plain or
 * percent-encoded) are rejected, and a hostname must be present. Passing
 * this check does NOT mean the source exists or is verified.
 */
export function isStructurallyValidUrlOrDoi(value: string): boolean {
  if (DOI_RE.test(value)) return true;
  if (!/^https?:\/\//i.test(value)) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    if (url.username !== "" || url.password !== "") return false;
    if (url.hostname.length === 0) return false;
    return true;
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
