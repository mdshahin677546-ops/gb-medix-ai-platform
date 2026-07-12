// EvidenceClaim schema and the claim-level gate that decides whether a set
// of claims may enter medical review.
//
// A draft must NOT enter medical review when any critical claim has no
// source, an unverified source, a withdrawn source, a source that does not
// exist, or expired evidence without an explicit limitation note.

import { z } from "zod";
import { EvidenceSource } from "./evidence";

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

export const EvidenceClaimSchema = z
  .object({
    id: z.string().min(1),
    statement: z.string().min(1),
    claimType: z.enum(CLAIM_TYPES),
    supportingEvidenceIds: z.array(z.string().min(1)),
    opposingEvidenceIds: z.array(z.string().min(1)),
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
  const sourceById = new Map(sources.map((s) => [s.id, s]));

  for (const raw of claims) {
    const claim = EvidenceClaimSchema.parse(raw);
    const critical = isCriticalClaim(claim);

    if (critical && claim.supportingEvidenceIds.length === 0) {
      violations.push({ claimId: claim.id, reason: "critical_claim_missing_evidence" });
    }
    if (critical && claim.verificationStatus !== "verified") {
      violations.push({ claimId: claim.id, reason: "critical_claim_not_verified" });
    }
    for (const evidenceId of [...claim.supportingEvidenceIds, ...claim.opposingEvidenceIds]) {
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
