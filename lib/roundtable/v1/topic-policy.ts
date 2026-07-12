// Daily topic candidate schema, safety policy and selection scoring.
//
// Patient-identifiable topics, individual-case medical questions and
// unverifiable topics are always rejected. A patient's individual question
// must never be turned directly into a forum topic.

import { z } from "zod";
import { normalizeTopicText, stableFingerprint } from "./types";

export const TOPIC_RISK_LEVELS = ["low", "medium", "high"] as const;

export const PRIORITY_TOPIC_CATEGORIES = [
  "clinical_guideline_difference",
  "nutrition",
  "sleep",
  "exercise",
  "public_health",
  "health_misconception",
  "tcm_western_evidence_comparison",
  "medication_safety_public_knowledge",
  "new_research_evidence_strength",
  "medical_ethics_health_technology",
] as const;

export const ALLOWED_TOPIC_CATEGORIES = [
  ...PRIORITY_TOPIC_CATEGORIES,
  "general_medical_knowledge",
  "health_management",
] as const;

export const CandidateTopicSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    normalizedQuestion: z.string().min(1),
    category: z.string().min(1),
    riskLevel: z.enum(TOPIC_RISK_LEVELS),
    sourceHints: z.array(z.string()),
    freshnessScore: z.number().finite().min(0).max(1),
    evidenceAvailabilityScore: z.number().finite().min(0).max(1),
    publicInterestScore: z.number().finite().min(0).max(1),
    duplicateFingerprint: z.string().min(1),
    containsPatientData: z.boolean(),
  })
  .strict();

export type CandidateTopic = z.infer<typeof CandidateTopicSchema>;

export type TopicBlockReason =
  | "privacy"
  | "high_risk"
  | "no_verifiable_evidence"
  | "out_of_scope"
  | "duplicate";

export interface TopicSafetyResult {
  allowed: boolean;
  blockReason: TopicBlockReason | null;
  detail: string | null;
}

// Individual-case medical requests that must never become a roundtable topic:
// individual diagnosis, individual dosing, stop/adjust medication advice,
// personal disease probability, guaranteed cures.
const HIGH_RISK_TOPIC_PATTERNS: RegExp[] = [
  /我(是不是|得了|患了|有没有得|有没有患)/,
  /(帮我|给我|替我).{0,6}(确诊|诊断|看病)/,
  /diagnos(e|is)\s+(me|my|this patient)/i,
  /(我|本人).{0,10}(该|应该)?(吃|服用).{0,10}(多少|几片|几粒|什么剂量)/,
  /(what|how much).{0,20}dose.{0,20}(should i|for me)/i,
  /(能不能|可不可以|可以|该不该).{0,6}(停药|减药|换药|调药|加量|减量)/,
  /(can|should)\s+i\s+stop\s+(taking\s+)?(my\s+)?medication/i,
  /(我|本人).{0,10}(患|得).{0,10}(概率|几率|可能性)/,
  /probability\s+(that\s+)?i\s+have/i,
  /(保证|一定|肯定|百分百|100%).{0,6}(治愈|治好|痊愈|根治)/,
  /guarantee[sd]?\s+(a\s+)?cure/i,
];

// Minimum evidence availability below which a topic is treated as having no
// verifiable evidence base.
export const MINIMUM_EVIDENCE_AVAILABILITY = 0.2;

export function computeTopicFingerprint(title: string): string {
  return stableFingerprint(normalizeTopicText(title));
}

export function evaluateTopicSafety(topic: CandidateTopic): TopicSafetyResult {
  if (topic.containsPatientData) {
    return {
      allowed: false,
      blockReason: "privacy",
      detail: "topic contains identifiable patient data",
    };
  }
  const text = `${topic.title} ${topic.normalizedQuestion}`;
  for (const pattern of HIGH_RISK_TOPIC_PATTERNS) {
    if (pattern.test(text)) {
      return {
        allowed: false,
        blockReason: "high_risk",
        detail: "individual-case medical request cannot become a roundtable topic",
      };
    }
  }
  if (topic.riskLevel === "high") {
    return {
      allowed: false,
      blockReason: "high_risk",
      detail: "topic risk level is high",
    };
  }
  if (topic.evidenceAvailabilityScore < MINIMUM_EVIDENCE_AVAILABILITY) {
    return {
      allowed: false,
      blockReason: "no_verifiable_evidence",
      detail: "topic has no verifiable evidence base",
    };
  }
  if (!(ALLOWED_TOPIC_CATEGORIES as readonly string[]).includes(topic.category)) {
    return {
      allowed: false,
      blockReason: "out_of_scope",
      detail: `category ${topic.category} is outside medical knowledge / health management scope`,
    };
  }
  return { allowed: true, blockReason: null, detail: null };
}

export function scoreTopic(topic: CandidateTopic): number {
  const priorityBoost = (PRIORITY_TOPIC_CATEGORIES as readonly string[]).includes(topic.category) ? 0.2 : 0;
  return (
    topic.freshnessScore * 0.3 +
    topic.evidenceAvailabilityScore * 0.4 +
    topic.publicInterestScore * 0.3 +
    priorityBoost
  );
}

export interface RejectedTopic {
  topic: CandidateTopic;
  reason: TopicBlockReason;
  detail: string;
}

export interface TopicSelection {
  selected: CandidateTopic | null;
  rejected: RejectedTopic[];
}

/**
 * Deterministic selection: same candidates + same history always select the
 * same topic (score, tie-broken by id). Topics whose fingerprint (provided or
 * recomputed from the normalized title) appears in the history — which must
 * include published and currently-in-review topics — are duplicates.
 */
export function selectDailyTopic(
  candidates: readonly CandidateTopic[],
  previousTopicFingerprints: readonly string[]
): TopicSelection {
  const previous = new Set(previousTopicFingerprints);
  const rejected: RejectedTopic[] = [];
  const viable: CandidateTopic[] = [];

  for (const topic of candidates) {
    if (previous.has(topic.duplicateFingerprint) || previous.has(computeTopicFingerprint(topic.title))) {
      rejected.push({ topic, reason: "duplicate", detail: "topic duplicates a previous, published or in-review topic" });
      continue;
    }
    const safety = evaluateTopicSafety(topic);
    if (!safety.allowed) {
      rejected.push({ topic, reason: safety.blockReason as TopicBlockReason, detail: safety.detail ?? "blocked" });
      continue;
    }
    viable.push(topic);
  }

  if (viable.length === 0) {
    return { selected: null, rejected };
  }
  const sorted = [...viable].sort((a, b) => {
    const diff = scoreTopic(b) - scoreTopic(a);
    if (diff !== 0) return diff;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return { selected: sorted[0], rejected };
}
