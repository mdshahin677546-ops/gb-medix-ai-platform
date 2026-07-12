// EvidenceClaim schema and the claim-level gate that decides whether a set
// of claims may enter medical review.
//
// Fail-closed rules (P1-002):
// - an EMPTY claim set is never review-ready (no vacuous `every([])` pass);
// - duplicate EvidenceSource ids are rejected outright — even identical
//   objects — so a later "verified" write can never shadow an earlier
//   "withdrawn" one;
// - ID policy: ids are compared EXACTLY after trim; ids that collide
//   case-insensitively are rejected as ambiguous duplicates.
// A draft must NOT enter medical review when any critical claim has no
// source, an unverified source, a withdrawn source, a source that does not
// exist, or expired evidence without an explicit limitation note.

import { z } from "zod";
import { EvidenceIdSchema, EvidenceSource } from "./evidence";
import { CONTROL_CHARS_RE, ID_UNSAFE_CHARS_RE } from "./types";

export const CLAIM_TYPES = [
  "confirmed_fact",
  "current_consensus",
  "limited_inference",
  "disputed",
  "unresolved",
  "safety_warning",
] as const;

/** Claim types that assert medical facts/consensus and MUST bind evidence. */
export const CRITICAL_CLAIM_TYPES = ["confirmed_fact", "current_consensus", "safety_warning"] as const;

export const CLAIM_VERIFICATION_STATUSES = ["pending", "verified", "rejected"] as const;

// SAME schema as EvidenceSource ids — one shared policy, no place where an
// id is normalized on one side but not the other (RR-P2-001).
const ReferenceIdSchema = EvidenceIdSchema;

export const EvidenceClaimSchema = z
  .object({
    id: ReferenceIdSchema,
    statement: z.string().min(1),
    claimType: z.enum(CLAIM_TYPES),
    supportingEvidenceIds: z.array(ReferenceIdSchema),
    opposingEvidenceIds: z.array(ReferenceIdSchema),
    confidence: z.number().finite().min(0).max(1),
    limitations: z.array(z.string()),
    verificationStatus: z.enum(CLAIM_VERIFICATION_STATUSES),
  })
  .strict();

export type EvidenceClaim = z.infer<typeof EvidenceClaimSchema>;

export function isCriticalClaim(claim: EvidenceClaim): boolean {
  return (CRITICAL_CLAIM_TYPES as readonly string[]).includes(claim.claimType);
}

export interface ClaimViolation {
  claimId: string;
  reason: string;
}

export interface ClaimReviewReadiness {
  ready: boolean;
  violations: ClaimViolation[];
}

export function validateClaimsForMedicalReview(
  claims: readonly EvidenceClaim[],
  sources: readonly EvidenceSource[]
): ClaimReviewReadiness {
  const violations: ClaimViolation[] = [];

  // Fail closed: no claims means nothing to review — never "ready".
  if (claims.length === 0) {
    return { ready: false, violations: [{ claimId: "(claims)", reason: "no_claims_provided" }] };
  }

  // Source ids follow the SAME raw policy as claim reference ids: no
  // whitespace or invisible characters anywhere, no control characters.
  for (const source of sources) {
    if (
      typeof source.id !== "string" ||
      source.id.length === 0 ||
      ID_UNSAFE_CHARS_RE.test(source.id) ||
      CONTROL_CHARS_RE.test(source.id)
    ) {
      violations.push({ claimId: "(evidence)", reason: "invalid_evidence_id" });
    }
  }
  if (violations.length > 0) {
    return { ready: false, violations };
  }

  // Duplicate evidence ids are ambiguous and rejected before any Map is
  // built. Comparison uses trimmed ids; ids differing only by case are also
  // treated as ambiguous duplicates (documented ID policy).
  const seenCanonical = new Map<string, string>();
  for (const source of sources) {
    const exact = source.id.trim();
    const canonical = exact.toLowerCase();
    if (seenCanonical.has(canonical)) {
      violations.push({
        claimId: "(evidence)",
        reason: `duplicate_evidence_id:${exact}`,
      });
      continue;
    }
    seenCanonical.set(canonical, exact);
  }
  if (violations.length > 0) {
    return { ready: false, violations };
  }

  const sourceById = new Map(sources.map((s) => [s.id.trim(), s]));

  for (const raw of claims) {
    const claim = EvidenceClaimSchema.parse(raw);
    const critical = isCriticalClaim(claim);

    if (critical && claim.supportingEvidenceIds.length === 0) {
      violations.push({ claimId: claim.id, reason: "critical_claim_missing_evidence" });
    }
    if (critical && claim.verificationStatus !== "verified") {
      violations.push({ claimId: claim.id, reason: "critical_claim_not_verified" });
    }
    for (const rawEvidenceId of [...claim.supportingEvidenceIds, ...claim.opposingEvidenceIds]) {
      const evidenceId = rawEvidenceId.trim();
      // Exact match after trim — "E1" does not resolve "e1" (fail closed).
      const source = sourceById.get(evidenceId);
      if (!source) {
        violations.push({ claimId: claim.id, reason: `evidence_source_not_found:${evidenceId}` });
        continue;
      }
      if (source.withdrawn || source.verificationStatus === "withdrawn") {
        violations.push({ claimId: claim.id, reason: `evidence_withdrawn:${evidenceId}` });
        continue;
      }
      if (source.verificationStatus !== "verified") {
        violations.push({ claimId: claim.id, reason: `evidence_not_verified:${evidenceId}` });
      }
      if (source.expired && claim.limitations.length === 0) {
        violations.push({ claimId: claim.id, reason: `expired_evidence_without_limitation:${evidenceId}` });
      }
    }
  }
  return { ready: violations.length === 0, violations };
}
