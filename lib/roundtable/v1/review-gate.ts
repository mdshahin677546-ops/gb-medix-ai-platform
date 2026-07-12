// Mandatory medical review publication gate.
//
// Nothing is ever published before a doctor approves it. There is no bypass
// for high-risk content, pending/revision_required/rejected reviews,
// unverified evidence, failed privacy checks or incomplete audit trails.
// Doctor accounts are NOT implemented in this foundation — the reviewer id
// is an opaque identifier supplied by a future external review system.

import { z } from "zod";
import { MEDICAL_REVIEW_STATUSES } from "./consensus";

export const PublicationGateInputSchema = z
  .object({
    medicalReviewStatus: z.enum(MEDICAL_REVIEW_STATUSES),
    allCriticalClaimsVerified: z.boolean(),
    noHighRiskMedicalContent: z.boolean(),
    privacyCheckPassed: z.boolean(),
    evidenceCheckPassed: z.boolean(),
    auditComplete: z.boolean(),
    versionIsImmutable: z.boolean(),
  })
  .strict();

export type PublicationGateInput = z.infer<typeof PublicationGateInputSchema>;

export interface PublicationGateResult {
  canPublish: boolean;
  failures: string[];
}

export function evaluatePublicationGate(input: PublicationGateInput): PublicationGateResult {
  const gate = PublicationGateInputSchema.parse(input);
  const failures: string[] = [];
  if (gate.medicalReviewStatus !== "approved") {
    failures.push(`medical review status is ${gate.medicalReviewStatus}; publication requires approved`);
  }
  if (gate.allCriticalClaimsVerified !== true) {
    failures.push("not all critical claims are verified");
  }
  if (gate.noHighRiskMedicalContent !== true) {
    failures.push("high-risk medical content present; publication blocked with no bypass");
  }
  if (gate.privacyCheckPassed !== true) {
    failures.push("privacy check failed");
  }
  if (gate.evidenceCheckPassed !== true) {
    failures.push("evidence check failed");
  }
  if (gate.auditComplete !== true) {
    failures.push("audit trail incomplete");
  }
  if (gate.versionIsImmutable !== true) {
    failures.push("version is not immutable");
  }
  return { canPublish: failures.length === 0, failures };
}
