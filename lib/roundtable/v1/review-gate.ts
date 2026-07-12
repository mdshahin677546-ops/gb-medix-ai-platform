// Mandatory medical review publication gate and the TRUSTED review-decision
// structure.
//
// Trust boundary (P1-005): AI-generated drafts can never carry review
// status. Review outcomes enter the system only through
// MedicalReviewDecision, and the publication gate derives its review fields
// from that decision — never from AI draft fields.
//
// Nothing is ever published before a doctor approves it. There is no bypass
// for high-risk content, pending/revision_required/rejected reviews,
// withdrawn/superseded content, unverified evidence, failed privacy checks
// or incomplete audit trails. Doctor accounts are NOT implemented in this
// foundation — the reviewer id is an opaque identifier supplied by a future
// external review system and is NOT proof of verified medical credentials.

import { z } from "zod";
import {
  CONTENT_LIFECYCLE_STATUSES,
  ContentLifecycleStatus,
  CONTROL_CHARS_RE,
  isValidIsoDateTime,
} from "./types";

export const REVIEWER_ID_MAX_LENGTH = 128;

/**
 * Opaque external reviewer id: must be a string, non-blank after trim,
 * bounded, and free of control characters. The control-character check runs
 * on the RAW string BEFORE any trim/transform, so "reviewer\n" (or tab/CR,
 * leading or trailing, C0/DEL/C1) can never slip through by being trimmed
 * away. Plain ASCII spaces around an id remain allowed and are trimmed. It
 * is NOT an auth credential and NOT proof of doctor identity/qualification.
 */
export const ReviewerIdSchema = z
  .string()
  .max(REVIEWER_ID_MAX_LENGTH, `reviewer id must be at most ${REVIEWER_ID_MAX_LENGTH} characters`)
  .refine((raw) => !CONTROL_CHARS_RE.test(raw), "reviewer id must not contain control characters")
  .transform((s) => s.trim())
  .refine((s) => s.length > 0, "reviewer id must be non-blank after trim");

export const MEDICAL_REVIEW_DECISIONS = [
  "approved",
  "rejected",
  "revision_required",
  "high_risk_blocked",
] as const;

/** Trusted, externally-supplied review outcome — never produced by AI. */
export const MedicalReviewDecisionSchema = z
  .object({
    reviewerId: ReviewerIdSchema,
    decision: z.enum(MEDICAL_REVIEW_DECISIONS),
    /** The exact content version this decision applies to. */
    contentVersion: z.number().int().positive(),
    decidedAt: z.string().refine(isValidIsoDateTime, "decidedAt must be a valid ISO-8601 timestamp"),
  })
  .strict();

export type MedicalReviewDecision = z.infer<typeof MedicalReviewDecisionSchema>;

export const PublicationGateInputSchema = z
  .object({
    /** Accepts any string so unknown statuses REJECT instead of throwing;
     * only the literal "approved" can ever pass the gate. */
    medicalReviewStatus: z.string(),
    contentLifecycleStatus: z.enum(CONTENT_LIFECYCLE_STATUSES),
    contentVersion: z.number().int().positive(),
    approvedContentVersion: z.number().int().positive(),
    approvedByReviewerId: ReviewerIdSchema,
    allCriticalClaimsVerified: z.boolean(),
    noHighRiskMedicalContent: z.boolean(),
    privacyCheckPassed: z.boolean(),
    evidenceCheckPassed: z.boolean(),
    auditComplete: z.boolean(),
    versionIsImmutable: z.boolean(),
  })
  .strict();

export type PublicationGateInput = z.input<typeof PublicationGateInputSchema>;
export type ParsedPublicationGateInput = z.output<typeof PublicationGateInputSchema>;

export interface PublicationGateResult {
  canPublish: boolean;
  failures: string[];
}

/**
 * Fail-closed gate. Never throws: malformed, unknown or missing input is a
 * rejection, not an exception. Approval is bound to the exact content
 * version and only `active` content with status `approved` can pass.
 */
export function evaluatePublicationGate(input: unknown): PublicationGateResult {
  const parsed = PublicationGateInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      canPublish: false,
      failures: parsed.error.issues.map((issue) => `invalid gate input: ${issue.path.join(".")}: ${issue.message}`),
    };
  }
  const gate = parsed.data;
  const failures: string[] = [];
  if (gate.medicalReviewStatus !== "approved") {
    failures.push(`medical review status is "${gate.medicalReviewStatus}"; publication requires approved`);
  }
  if (gate.contentLifecycleStatus !== "active") {
    failures.push(`content lifecycle is ${gate.contentLifecycleStatus}; only active content can be published`);
  }
  if (gate.contentVersion !== gate.approvedContentVersion) {
    failures.push(
      `approval is bound to version ${gate.approvedContentVersion} but content is version ${gate.contentVersion}; a new version never inherits an old approval`
    );
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

export interface GateChecks {
  allCriticalClaimsVerified: boolean;
  noHighRiskMedicalContent: boolean;
  privacyCheckPassed: boolean;
  evidenceCheckPassed: boolean;
  auditComplete: boolean;
  versionIsImmutable: boolean;
}

/**
 * Build gate input from the TRUSTED review decision — the review status and
 * approved version come from the decision, never from an AI draft field.
 */
export function buildPublicationGateInput(args: {
  decision: MedicalReviewDecision;
  contentVersion: number;
  contentLifecycleStatus: ContentLifecycleStatus;
  checks: GateChecks;
}): PublicationGateInput {
  const decision = MedicalReviewDecisionSchema.parse(args.decision);
  return {
    medicalReviewStatus: decision.decision,
    contentLifecycleStatus: args.contentLifecycleStatus,
    contentVersion: args.contentVersion,
    approvedContentVersion: decision.contentVersion,
    approvedByReviewerId: decision.reviewerId,
    ...args.checks,
  };
}
