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
  CONTROL_CHARS_RE,
  ID_UNSAFE_CHARS_RE,
  MEDICAL_REVIEW_STATUSES,
} from "./types";

export const SUPPORTED_LANGUAGES = ["zh", "en"] as const;

// Same raw id policy as evidence/claim ids: no whitespace, invisible or
// control characters anywhere.
const ClaimIdSchema = z
  .string()
  .min(1)
  .max(200)
  .refine((raw) => !ID_UNSAFE_CHARS_RE.test(raw), "claim id must not contain whitespace or invisible characters")
  .refine((raw) => !CONTROL_CHARS_RE.test(raw), "claim id must not contain control characters");

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
 * Structural integrity of an asset against the TRUSTED source ref. Every
 * source-metadata field the asset carries (sourceConsensusId, sourceVersion,
 * sourceClaimIds, sourceSafetyWarningClaimIds) is re-compared against the
 * trusted ref — an asset that survived a JSON round-trip with tampered
 * source metadata is still caught, even when translatedClaimIds was left
 * untouched or was tampered consistently with sourceClaimIds. Detects
 * additions, deletions, replacements, duplicates, blank/whitespace ids and
 * case variants (comparison is exact after trim). Object.freeze on created
 * assets is only an extra safety layer — THIS comparison is the trust
 * boundary. Structural only — it cannot and does not verify semantic
 * translation equivalence.
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
  let refClaimIds: string[];
  let refSafetyIds: string[];
  try {
    refClaimIds = normalizeClaimIdSet(source.claimIds, "source claim ids");
    refSafetyIds = normalizeClaimIdSet(source.safetyWarningClaimIds, "source safety-warning claim ids");
  } catch (error) {
    violations.push(error instanceof Error ? error.message : "invalid source claim sets");
    return violations;
  }

  const checkSetAgainstRef = (label: string, declared: readonly string[], expected: readonly string[]) => {
    const trimmed = declared.map((id) => id.trim());
    if (trimmed.some((id) => id.length === 0)) {
      violations.push(`${label}_contains_blank_id`);
    }
    const unique = new Set(trimmed);
    if (unique.size !== trimmed.length) {
      violations.push(`${label}_contains_duplicates`);
    }
    for (const id of unique) {
      if (!expected.includes(id)) violations.push(`${label}_added:${id}`);
    }
    for (const id of expected) {
      if (!unique.has(id)) violations.push(`${label}_missing:${id}`);
    }
  };

  checkSetAgainstRef("source_claim_ids", asset.sourceClaimIds, refClaimIds);
  checkSetAgainstRef("source_safety_warning_claim_ids", asset.sourceSafetyWarningClaimIds, refSafetyIds);
  checkSetAgainstRef("translated_claim_ids", asset.translatedClaimIds, refClaimIds);

  // translatedClaimIds must ALSO agree with the asset's own declared
  // sourceClaimIds — a consistent tamper of both is still a mismatch above,
  // and an inconsistent pair is caught here.
  const declaredSet = [...new Set(asset.sourceClaimIds.map((id) => id.trim()))].sort();
  const translatedSet = [...new Set(asset.translatedClaimIds.map((id) => id.trim()))].sort();
  if (JSON.stringify(declaredSet) !== JSON.stringify(translatedSet)) {
    violations.push("translated_claim_ids_do_not_match_declared_source_claim_ids");
  }
  for (const id of refSafetyIds) {
    if (!translatedSet.includes(id)) {
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
