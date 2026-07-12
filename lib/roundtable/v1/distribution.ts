// Multilingual draft distribution assets (传播素材草稿).
//
// Assets are DRAFTS until the underlying consensus is doctor-approved. They
// inherit the consensus version, review status and withdrawal state; a
// translation may never introduce new medical conclusions, and withdrawal
// of any language withdraws every language. Multilingual assets are never
// an independent source of medical fact. No translation provider is called
// in this foundation.

import { z } from "zod";
import { MEDICAL_REVIEW_STATUSES, MedicalReviewStatus } from "./consensus";

export const SUPPORTED_LANGUAGES = ["zh", "en"] as const;

export const ASSET_REVIEW_STATUSES = [...MEDICAL_REVIEW_STATUSES, "withdrawn"] as const;

export type AssetReviewStatus = (typeof ASSET_REVIEW_STATUSES)[number];

export const DraftDistributionAssetSchema = z
  .object({
    language: z.string().min(2),
    title: z.string().min(1),
    summary: z.string().min(1),
    seoTitle: z.string().min(1),
    seoDescription: z.string().min(1),
    socialPost: z.string().min(1),
    shortVideoScript: z.string().min(1),
    controversyCards: z.array(z.string()),
    sourceVersion: z.number().int().positive(),
    reviewStatus: z.enum(ASSET_REVIEW_STATUSES),
  })
  .strict();

export type DraftDistributionAsset = z.infer<typeof DraftDistributionAssetSchema>;

// A translation must not ADD medical conclusions the consensus process did
// not produce: no individual diagnosis, prescriptions/dosing, or cure
// promises may appear in distribution copy.
const FORBIDDEN_ASSET_PATTERNS: RegExp[] = [
  /(确诊|诊断)为/,
  /diagnosed?\s+(you|as having)/i,
  /(给你|为你|帮你)开(药|处方)/,
  /prescri(be|ption)/i,
  /每(天|日)服用\s*\d+/,
  /\d+\s*(mg\b|毫克)/i,
  /(建议|应该|请).{0,6}停药/,
  /stop\s+(taking\s+)?your\s+medication/i,
  /(保证|一定|肯定|百分百|100%).{0,6}(治愈|治好|痊愈|根治)/,
  /guarantee[sd]?\s+(a\s+)?cure/i,
  /will\s+(definitely\s+)?cure/i,
];

export interface AssetContentInput {
  language: string;
  title: string;
  summary: string;
  seoTitle: string;
  seoDescription: string;
  socialPost: string;
  shortVideoScript: string;
  controversyCards: string[];
}

export function findForbiddenAssetContent(content: AssetContentInput): string[] {
  const violations: string[] = [];
  const texts = [
    content.title,
    content.summary,
    content.seoTitle,
    content.seoDescription,
    content.socialPost,
    content.shortVideoScript,
    ...content.controversyCards,
  ];
  for (const text of texts) {
    for (const pattern of FORBIDDEN_ASSET_PATTERNS) {
      if (pattern.test(text)) {
        violations.push(`forbidden medical conclusion in ${content.language} asset content: ${pattern.source}`);
      }
    }
  }
  return violations;
}

export interface ConsensusForDistribution {
  version: number;
  medicalReviewStatus: MedicalReviewStatus;
}

/**
 * Build draft assets that inherit the consensus version and review status.
 * Throws if any translation adds forbidden medical conclusions.
 */
export function createDraftDistributionAssets(
  consensus: ConsensusForDistribution,
  contents: readonly AssetContentInput[]
): DraftDistributionAsset[] {
  if (contents.length === 0) {
    throw new Error("at least one language is required for distribution assets");
  }
  const seen = new Set<string>();
  return contents.map((content) => {
    if (seen.has(content.language)) {
      throw new Error(`duplicate language in distribution assets: ${content.language}`);
    }
    seen.add(content.language);
    const violations = findForbiddenAssetContent(content);
    if (violations.length > 0) {
      throw new Error(violations.join("; "));
    }
    return DraftDistributionAssetSchema.parse({
      ...content,
      sourceVersion: consensus.version,
      reviewStatus: consensus.medicalReviewStatus,
    });
  });
}

export interface AssetPublishability {
  canPublish: boolean;
  failures: string[];
}

/** An asset is publishable only when its source consensus is approved. */
export function evaluateAssetPublishability(
  asset: DraftDistributionAsset,
  consensus: ConsensusForDistribution
): AssetPublishability {
  const failures: string[] = [];
  if (consensus.medicalReviewStatus !== "approved") {
    failures.push(`source consensus is ${consensus.medicalReviewStatus}; assets cannot be published`);
  }
  if (asset.reviewStatus !== "approved") {
    failures.push(`asset review status is ${asset.reviewStatus}; only approved assets can be published`);
  }
  if (asset.sourceVersion !== consensus.version) {
    failures.push(`asset sourceVersion ${asset.sourceVersion} does not match consensus version ${consensus.version}`);
  }
  return { canPublish: failures.length === 0, failures };
}

/**
 * Withdrawal propagates across ALL languages: if any asset (or the source
 * consensus) is withdrawn, every language is withdrawn. Returns new objects;
 * inputs are never mutated.
 */
export function propagateWithdrawal(
  assets: readonly DraftDistributionAsset[],
  sourceWithdrawn = false
): DraftDistributionAsset[] {
  const anyWithdrawn = sourceWithdrawn || assets.some((a) => a.reviewStatus === "withdrawn");
  if (!anyWithdrawn) {
    return assets.map((a) => ({ ...a }));
  }
  return assets.map((a) => ({ ...a, reviewStatus: "withdrawn" as AssetReviewStatus }));
}
