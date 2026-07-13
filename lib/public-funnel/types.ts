/**
 * GB MEDIX AI — Public growth funnel view models (Roundtable UI Batch 1).
 *
 * These are PUBLIC-FACING view models for rendering the medical-roundtable →
 * consultation funnel. They are intentionally decoupled from the roundtable
 * backend logic library (lib/roundtable/v1) — this module only READS a
 * publication-status projection and never runs orchestration. There is NO Prisma
 * model for published roundtables yet, so the public data source in this batch is
 * a clearly-marked DEMO fixture set (see demo-data.ts). Nothing here is a real,
 * doctor-reviewed medical conclusion.
 */

/** Public-facing publication status of a roundtable projection. */
export type RoundtablePublicationStatus =
  | "draft"
  | "review_required"
  | "in_medical_review"
  | "changes_requested"
  | "approved"
  | "published"
  | "update_required"
  | "retracted"
  | "archived";

/** Evidence strength for a claim. */
export type EvidenceStatus =
  | "supported"
  | "supported_with_limitations"
  | "conflicting_evidence"
  | "insufficient_evidence"
  | "expert_opinion_only"
  | "rejected";

export type EvidenceLevel = "high" | "moderate" | "low" | "unrated";

/** Coarse, non-diagnostic risk tier for a roundtable / signal. */
export type RiskTier = "routine" | "info" | "attention" | "urgent";

export type RoundtableCategory =
  | "chronic"
  | "sleep_mood"
  | "womens"
  | "children"
  | "elderly"
  | "tcm"
  | "nutrition"
  | "medication_safety"
  | "devices";

export type ActionTier =
  | "self_monitor"
  | "continue_consult"
  | "book_professional"
  | "seek_care_soon";

export type Perspective = {
  key: string;
  label: string;
};

export type ConsensusItem = {
  claim: string;
  support: "strong" | "moderate" | "limited";
  scope: string;
  limitation: string;
  evidenceStatus: EvidenceStatus;
};

export type Disagreement = {
  question: string;
  positions: { perspective: string; view: string }[];
  reason: string;
  evidenceSufficient: boolean;
  needsClinician: boolean;
};

export type ClaimEvidence = {
  claim: string;
  evidenceStatus: EvidenceStatus;
  evidenceLevel: EvidenceLevel;
  sourceTitle: string;
  sourceType: string;
  year: number | null;
  scope: string;
  limitation: string;
  supportingPerspectives: string[];
  challengingPerspectives: string[];
};

export type RiskSignal = {
  tier: RiskTier;
  text: string;
};

export type ActionRecommendation = {
  tier: ActionTier;
  text: string;
};

export type RelatedLink = { slug: string; title: string };

/** The full public roundtable view model (one language). */
export type RoundtableViewModel = {
  id: string;
  slug: string;
  locale: "en" | "zh";
  /** ALWAYS true in this batch — public data is demonstration content, not a real review. */
  isDemo: boolean;
  title: string;
  summary: string;
  category: RoundtableCategory;
  coreQuestion: string;
  oneMinute: {
    conclusion: string;
    keyLimitation: string;
    topRiskSignal: string;
    nextStep: string;
  };
  background: string;
  perspectives: Perspective[];
  consensusSummary: string;
  consensusItems: ConsensusItem[];
  disagreements: Disagreement[];
  claims: ClaimEvidence[];
  riskSignals: RiskSignal[];
  actionRecommendations: ActionRecommendation[];
  faqs: { q: string; a: string }[];
  reviewStatus: RoundtablePublicationStatus;
  version: number;
  publishedAt: string;
  updatedAt: string;
  readingTimeMinutes: number;
  relatedRoundtables: RelatedLink[];
  relatedServices: string[];
  relatedProducts: string[];
};

/** Compact card projection for lists/home. */
export type RoundtableCardModel = {
  id: string;
  slug: string;
  isDemo: boolean;
  title: string;
  category: RoundtableCategory;
  coreQuestion: string;
  consensusSummary: string;
  disagreementCount: number;
  perspectiveCount: number;
  evidenceCount: number;
  reviewStatus: RoundtablePublicationStatus;
  version: number;
  updatedAt: string;
  readingTimeMinutes: number;
  topRiskTier: RiskTier;
};
