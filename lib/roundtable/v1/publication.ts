// PublicationPlan — the ONLY publication output of this foundation.
//
// This round never writes to a database and never renders a public page:
// an approved run produces a plan object that a future, separately-reviewed
// publishing system may execute idempotently.
//
// P1-001: createPublicationPlan re-runs the FULL publication gate itself —
// it never trusts the caller to have checked. P2-002: the idempotency key
// binds the stable content id (operationId), the exact content version, the
// normalized language set, the normalized publication-target set and a
// stable identity digest, so different languages/targets/versions can never
// collide and set ordering never matters.

import { z } from "zod";
import {
  evaluatePublicationGate,
  PublicationGateInput,
  PublicationGateInputSchema,
  ReviewerIdSchema,
} from "./review-gate";
import { isValidIsoDateTime, stableFingerprint } from "./types";

export const PUBLICATION_TARGETS = ["roundtable_home", "seo_page"] as const;

export type PublicationTarget = (typeof PUBLICATION_TARGETS)[number];

const LanguageSchema = z
  .string()
  .min(2)
  .max(8)
  .refine((s) => /^[a-z]{2}(-[a-z0-9]{2,4})?$/i.test(s.trim()), "language must be a BCP-47-like code");

export const PublicationPlanSchema = z
  .object({
    publicationIdempotencyKey: z.string().min(1),
    /** Stable content identity for this plan (the daily-run operationId). */
    operationId: z.string().min(1),
    approvedVersion: z.number().int().positive(),
    /** Opaque reviewer identifier from a future external review system —
     * NOT proof of verified medical credentials. */
    approvedByReviewerId: ReviewerIdSchema,
    approvedAt: z.string().refine(isValidIsoDateTime, "approvedAt must be a valid ISO-8601 timestamp"),
    languages: z.array(LanguageSchema).min(1),
    publicationTargets: z.array(z.enum(PUBLICATION_TARGETS)).min(1),
    auditReference: z.string().min(1).max(200),
  })
  .strict();

export type PublicationPlan = z.infer<typeof PublicationPlanSchema>;

function normalizeLanguages(languages: readonly string[]): string[] {
  const normalized = languages.map((l) => l.trim().toLowerCase()).filter((l) => l.length > 0);
  return [...new Set(normalized)].sort();
}

function normalizeTargets(targets: readonly string[]): string[] {
  return [...new Set(targets.map((t) => t.trim()))].sort();
}

export interface PublicationIdentity {
  operationId: string;
  contentVersion: number;
  languages: readonly string[];
  publicationTargets: readonly string[];
}

/**
 * Deterministic and order-insensitive: the same operation + version +
 * language SET + target SET always yields the same key; any difference in
 * any of those dimensions yields a different key.
 */
export function buildPublicationIdempotencyKey(identity: PublicationIdentity): string {
  if (!Number.isInteger(identity.contentVersion) || identity.contentVersion < 1) {
    throw new Error(`Invalid content version: ${String(identity.contentVersion)}`);
  }
  if (identity.operationId.trim().length === 0) {
    throw new Error("operationId must be non-blank");
  }
  const languages = normalizeLanguages(identity.languages);
  const targets = normalizeTargets(identity.publicationTargets);
  if (languages.length === 0) {
    throw new Error("at least one language is required");
  }
  if (targets.length === 0) {
    throw new Error("at least one publication target is required");
  }
  const digest = stableFingerprint(
    JSON.stringify([identity.operationId, identity.contentVersion, languages, targets])
  );
  return `publish:${identity.operationId}:v${identity.contentVersion}:${languages.join("+")}:${targets.join("+")}:${digest}`;
}

export interface CreatePublicationPlanInput {
  operationId: string;
  /** Full gate input — re-validated here regardless of caller checks. */
  gate: PublicationGateInput;
  approvedAt: string;
  languages: string[];
  publicationTargets: PublicationTarget[];
  auditReference: string;
}

export function createPublicationPlan(input: CreatePublicationPlanInput): PublicationPlan {
  // Never trust the caller: the full gate runs here, every time.
  const gateResult = evaluatePublicationGate(input.gate);
  if (!gateResult.canPublish) {
    throw new Error(`Publication gate failed: ${gateResult.failures.join("; ")}`);
  }
  const gate = PublicationGateInputSchema.parse(input.gate);
  const languages = normalizeLanguages(input.languages);
  const publicationTargets = normalizeTargets(input.publicationTargets);
  return PublicationPlanSchema.parse({
    publicationIdempotencyKey: buildPublicationIdempotencyKey({
      operationId: input.operationId,
      contentVersion: gate.approvedContentVersion,
      languages,
      publicationTargets,
    }),
    operationId: input.operationId,
    approvedVersion: gate.approvedContentVersion,
    approvedByReviewerId: gate.approvedByReviewerId,
    approvedAt: input.approvedAt,
    languages,
    publicationTargets,
    auditReference: input.auditReference,
  });
}
