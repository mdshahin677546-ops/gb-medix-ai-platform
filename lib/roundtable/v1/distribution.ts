// Multilingual draft distribution assets (传播素材草稿).
//
// Assets are DRAFTS born with medicalReviewStatus = "pending" — an asset can
// only become approved through a trusted external MedicalReviewDecision,
// never at creation time and never from AI input. Every asset is bound to
// its source consensus (id, version, claim-id sets) and the translated
// claim-id set must be STRUCTURALLY identical to the source set: no
// additions, no deletions, no duplicates, safety-warning claims fully
// preserved. This guarantees structural integrity only — NOT semantic
// translation equivalence. Withdrawal or supersession of the source content
// propagates to every language. Multilingual assets are never an
// independent source of medical fact. No translation provider is called in
// this foundation.

import { z } from "zod";
import { MedicalReviewDecisionSchema } from "./review-gate";
import {
  CONTENT_LIFECYCLE_STATUSES,
  ContentLifecycleStatus,
  MEDICAL_REVIEW_STATUSES,
} from "./types";

export const SUPPORTED_LANGUAGES = ["zh", "en"] as const;

const ClaimIdSchema = z
  .string()
  .max(200)
  .refine((s) => s.trim().length > 0, "claim id must be non-blank after trim");

export const DraftDistributionAssetSchema = z
  .object({
    language: z.string().min(2).max(8),
    title: z.string().min(1),
    summary: z.string().min(1),
    seoTitle: z.string().min(1),
    seoDescription: z.string().min(1),
    socialPost: z.string().min(1),
    shortVideoScript: z.string().min(1),
    controversyCards: z.array(z.string()),
    sourceConsensusId: z.string().min(1),
    sourceVersion: z.number().int().positive(),
    sourceClaimIds: z.array(ClaimIdSchema),
    sourceSafetyWarningClaimIds: z.array(ClaimIdSchema),
    translatedClaimIds: z.array(ClaimIdSchema),
    medicalReviewStatus: z.enum(MEDICAL_REVIEW_STATUSES),
    lifecycleStatus: z.enum(CONTENT_LIFECYCLE_STATUSES),
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
  /** Claim ids carried by this translation — must equal the source set. */
  translatedClaimIds: string[];
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

/** Immutable reference to the source consensus a translation derives from. */
export interface ConsensusSourceRef {
  id: string;
  version: number;
  claimIds: readonly string[];
  safetyWarningClaimIds: readonly string[];
  lifecycleStatus: ContentLifecycleStatus;
}

function normalizeClaimIdSet(ids: readonly string[], label: string): string[] {
  const trimmed = ids.map((id) => id.trim());
  if (trimmed.some((id) => id.length === 0)) {
    throw new Error(`${label} contains a blank claim id`);
  }
  const unique = new Set(trimmed);
  if (unique.size !== trimmed.length) {
    throw new Error(`${label} contains duplicate claim ids`);
  }
  return [...unique].sort();
}

function compareClaimSets(source: readonly string[], translated: readonly string[]): string[] {
  const violations: string[] = [];
  const sourceSet = new Set(source);
  const translatedSet = new Set(translated);
  for (const id of translated) {
    if (!sourceSet.has(id)) violations.push(`translated_claim_added:${id}`);
  }
  for (const id of source) {
    if (!translatedSet.has(id)) violations.push(`translated_claim_missing:${id}`);
  }
  return violations;
}

function freezeAsset(asset: DraftDistributionAsset): DraftDistributionAsset {
  Object.freeze(asset.controversyCards);
  Object.freeze(asset.sourceClaimIds);
  Object.freeze(asset.sourceSafetyWarningClaimIds);
  Object.freeze(asset.translatedClaimIds);
  return Object.freeze(asset);
}

/**
 * Build draft assets bound to the source consensus. Assets are ALWAYS
 * created with medicalReviewStatus = "pending" (auto-generated drafts can
 * never be born approved), inherit the source lifecycle, and are frozen so
 * callers cannot mutate the medical structure afterwards.
 */
export function createDraftDistributionAssets(
  source: ConsensusSourceRef,
  contents: readonly AssetContentInput[]
): DraftDistributionAsset[] {
  if (contents.length === 0) {
    throw new Error("at least one language is required for distribution assets");
  }
  const sourceClaimIds = normalizeClaimIdSet(source.claimIds, "source claim ids");
  const sourceSafetyIds = normalizeClaimIdSet(source.safetyWarningClaimIds, "source safety-warning claim ids");
  for (const id of sourceSafetyIds) {
    if (!sourceClaimIds.includes(id)) {
      throw new Error(`safety-warning claim ${id} is not part of the source claim set`);
    }
  }
  const seenLanguages = new Set<string>();
  return contents.map((content) => {
    const language = content.language.trim().toLowerCase();
    if (seenLanguages.has(language)) {
      throw new Error(`duplicate language in distribution assets: ${language}`);
    }
    seenLanguages.add(language);
    const forbidden = findForbiddenAssetContent(content);
    if (forbidden.length > 0) {
      throw new Error(forbidden.join("; "));
    }
    const translated = normalizeClaimIdSet(content.translatedClaimIds, `translated claim ids (${language})`);
    const setViolations = compareClaimSets(sourceClaimIds, translated);
    if (setViolations.length > 0) {
      throw new Error(
        `translated claim set for ${language} must equal the source claim set: ${setViolations.join("; ")}`
      );
    }
    return freezeAsset(
      DraftDistributionAssetSchema.parse({
        language,
        title: content.title,
        summary: content.summary,
        seoTitle: content.seoTitle,
        seoDescription: content.seoDescription,
        socialPost: content.socialPost,
        shortVideoScript: content.shortVideoScript,
        controversyCards: [...content.controversyCards],
        sourceConsensusId: source.id,
        sourceVersion: source.version,
        sourceClaimIds,
        sourceSafetyWarningClaimIds: sourceSafetyIds,
        translatedClaimIds: translated,
        medicalReviewStatus: "pending",
        lifecycleStatus: source.lifecycleStatus,
      })
    );
  });
}

/**
 * Structural integrity of an asset against its source: identity, version,
 * claim-set equality, safety-warning preservation, no duplicates. Detects
 * any tampering with the immutable medical structure. Structural only — it
 * cannot and does not verify semantic translation equivalence.
 */
export function validateAssetClaimIntegrity(
  asset: DraftDistributionAsset,
  source: ConsensusSourceRef
): string[] {
  const violations: string[] = [];
  const parsed = DraftDistributionAssetSchema.safeParse(asset);
  if (!parsed.success) {
    return parsed.error.issues.map((issue) => `invalid asset: ${issue.path.join(".")}: ${issue.message}`);
  }
  if (asset.sourceConsensusId !== source.id) {
    violations.push(`asset is bound to consensus ${asset.sourceConsensusId}, expected ${source.id}`);
  }
  if (asset.sourceVersion !== source.version) {
    violations.push(`asset sourceVersion ${asset.sourceVersion} does not match consensus version ${source.version}`);
  }
  let sourceClaimIds: string[];
  let sourceSafetyIds: string[];
  try {
    sourceClaimIds = normalizeClaimIdSet(source.claimIds, "source claim ids");
    sourceSafetyIds = normalizeClaimIdSet(source.safetyWarningClaimIds, "source safety-warning claim ids");
  } catch (error) {
    violations.push(error instanceof Error ? error.message : "invalid source claim sets");
    return violations;
  }
  const translatedUnique = new Set(asset.translatedClaimIds.map((id) => id.trim()));
  if (translatedUnique.size !== asset.translatedClaimIds.length) {
    violations.push("translated claim ids contain duplicates");
  }
  violations.push(...compareClaimSets(sourceClaimIds, [...translatedUnique]));
  for (const id of sourceSafetyIds) {
    if (!translatedUnique.has(id)) {
      violations.push(`safety_warning_claim_missing:${id}`);
    }
  }
  return violations;
}

/**
 * The ONLY way asset review status changes: a trusted external decision
 * targeting the exact source version. Returns new frozen assets.
 */
export function applyReviewDecisionToAssets(
  assets: readonly DraftDistributionAsset[],
  decision: unknown,
  source: ConsensusSourceRef
): DraftDistributionAsset[] {
  const validDecision = MedicalReviewDecisionSchema.parse(decision);
  if (validDecision.contentVersion !== source.version) {
    throw new Error(
      `Review decision targets version ${validDecision.contentVersion} but source is version ${source.version}`
    );
  }
  return assets.map((asset) => {
    const integrity = validateAssetClaimIntegrity(asset, source);
    if (integrity.length > 0) {
      throw new Error(`asset ${asset.language} failed integrity checks: ${integrity.join("; ")}`);
    }
    return freezeAsset(
      DraftDistributionAssetSchema.parse({ ...asset, medicalReviewStatus: validDecision.decision })
    );
  });
}

export interface AssetPublishability {
  canPublish: boolean;
  failures: string[];
}

/**
 * An asset is publishable only when: its structure matches the source, the
 * source and asset are both `active`, and a trusted decision approved this
 * exact version. Without an external review decision no language can ever
 * be approved or published.
 */
export function evaluateAssetPublishability(
  asset: DraftDistributionAsset,
  source: ConsensusSourceRef
): AssetPublishability {
  const failures = validateAssetClaimIntegrity(asset, source);
  if (source.lifecycleStatus !== "active") {
    failures.push(`source consensus lifecycle is ${source.lifecycleStatus}; assets cannot be published`);
  }
  if (asset.lifecycleStatus !== "active") {
    failures.push(`asset lifecycle is ${asset.lifecycleStatus}; withdrawn/superseded assets cannot be published`);
  }
  if (asset.medicalReviewStatus !== "approved") {
    failures.push(`asset review status is ${asset.medicalReviewStatus}; only approved assets can be published`);
  }
  return { canPublish: failures.length === 0, failures };
}

/**
 * Lifecycle sync across ALL languages: if the source is withdrawn or
 * superseded, every asset takes that status; if any single asset is
 * withdrawn, every language is withdrawn. Returns new frozen objects;
 * inputs are never mutated.
 */
export function syncAssetsWithSourceLifecycle(
  assets: readonly DraftDistributionAsset[],
  source: ConsensusSourceRef
): DraftDistributionAsset[] {
  let target: ContentLifecycleStatus | null = null;
  if (source.lifecycleStatus !== "active") {
    target = source.lifecycleStatus;
  } else if (assets.some((a) => a.lifecycleStatus === "withdrawn")) {
    target = "withdrawn";
  }
  if (target === null) {
    return assets.map((a) => freezeAsset({ ...a }));
  }
  const finalTarget = target;
  return assets.map((a) => freezeAsset({ ...a, lifecycleStatus: finalTarget }));
}
