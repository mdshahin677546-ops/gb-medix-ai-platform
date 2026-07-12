// Daily topic candidate schema, safety policy and selection scoring.
//
// Patient-identifiable topics, individual-case medical questions and
// unverifiable topics are always rejected. A patient's individual question
// must never be turned directly into a forum topic.
//
// P1-004: all risk/privacy matching runs on a unified normalization (NFKC,
// lowercase, zero-width stripped, whitespace/punctuation collapsed), so
// spacing, punctuation, zero-width and full-width tricks do not bypass the
// rules. `containsPatientData=false` and `riskLevel=low` can never override
// text detection. This is a RULE-LEVEL defense, not a production-grade PHI
// detector or medical-safety classifier.

import { z } from "zod";
import {
  CONTROL_CHARS_RE,
  normalizeForMatching,
  normalizeTopicText,
  stableFingerprint,
  stripZeroWidth,
} from "./types";

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

export const TOPIC_TITLE_MIN_LENGTH = 4;
export const TOPIC_TITLE_MAX_LENGTH = 200;

const TopicTitleSchema = z
  .string()
  .max(TOPIC_TITLE_MAX_LENGTH)
  .refine((t) => !CONTROL_CHARS_RE.test(t), "title must not contain control characters")
  .refine(
    (t) => stripZeroWidth(t.normalize("NFKC")).trim().length >= TOPIC_TITLE_MIN_LENGTH,
    `title must be at least ${TOPIC_TITLE_MIN_LENGTH} characters after trim`
  )
  .refine((t) => normalizeTopicText(t).length > 0, "title must not be punctuation-only");

export const CandidateTopicSchema = z
  .object({
    id: z.string().min(1).max(200),
    title: TopicTitleSchema,
    normalizedQuestion: z.string().min(1).max(1000),
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
  | "duplicate"
  | "fingerprint_mismatch";

export interface TopicSafetyResult {
  allowed: boolean;
  blockReason: TopicBlockReason | null;
  detail: string | null;
}

// ---- privacy text detection (runs on `normalized`, which keeps @ and .) --
const PRIVACY_NORMALIZED_PATTERNS: RegExp[] = [
  /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/, // email (NFKC folds full-width @)
];
// ---- privacy detection on `compact` (spaces/punctuation stripped) -------
const PRIVACY_COMPACT_PATTERNS: RegExp[] = [
  /\d{9,}/, // long digit run: phone / MRN / identity number (9+ so joined year ranges like 2010-2026 stay legal)
  /(mrn|medicalrecord|病历号|病案号|病历编号|住院号)/,
  /(patientname|患者姓名|病人姓名)/,
  /(我的(病例|病历|检查报告|化验单|体检报告|诊断书)|mymedicalrecord|mytestresults|mylabreport|mycasefile)/,
  /(身份证|idcardnumber|passportnumber)/,
];

// ---- individual-case / high-risk medical requests (compact matching) ----
// Individual diagnosis, prescriptions, dosing, medication changes, personal
// disease probability, guaranteed cures, emergencies, individual cancer
// treatment, child/pregnancy dosing, suicide/self-harm, and
// academically-wrapped individual directives.
const HIGH_RISK_COMPACT_PATTERNS: RegExp[] = [
  // Generalized personal-subject + illness-uncertainty / diagnosis-judgment
  // request (RR-P1-001, all rounds): 我/本人 followed within a short window
  // by a "suffer from" verb, an uncertainty marker (可能/疑似/是否/是不是),
  // or 疑似/确诊 directly — semantic shapes, not fixed sentences. The
  // negative lookahead (?!们|国|省|市|县|院|校) keeps population-level
  // phrasing (我们/我国/我省…) out of the individual rule.
  /(我(?!们|国|省|市|县|院|校)|本人).{0,6}(罹患|患有|患上|患了|得了|得上|得的是|染上)/,
  /(我(?!们|国|省|市|县|院|校)|本人).{0,4}(疑似|确诊)/,
  /(我(?!们|国|省|市|县|院|校)|本人).{0,4}(是不是|是否|会不会|有没有可能|有可能是?|可能是)/,
  /(患|得)了?(什么|啥)(病|症)/,
  // English personal / single-patient diagnosis shapes: modal + I + have,
  // modal + I + be, "am I <condition>", "whether/mean I am", and modal +
  // this/the patient + have/be. Population phrasing ("risk factors for
  // diabetes", "communicate uncertainty to patients") stays unmatched.
  /(might|could|do|can|will|would|does)i(likely|possibly|actually|really)?(to)?have/,
  /(could|might|can|would|will)i(be|become)/,
  /(whether|if|means?(that)?)iam/,
  /ami(a|an)?(likely|possibly|really|actually|now)?(pre)?(diabetic|hypertensive|anemic|anaemic|asthmatic|depressed|anxious|infected|positive|sick|ill)/,
  /ami(likely|possibly|atrisk)?(to)?have/,
  /(could|might|does|do|can|would|will)(this|that|the|my|a)patient(have|has|be|is|suffer)/,
  /(whether|if)(this|that|the|my|a)patient(has|have|is|suffers?)/,
  /(symptom|sign)s?(these)?(mean|suggest|indicate)(that)?i(might|could|may)?(have|had)/,
  /determine(whether|if)i(have|had|am)/,
  /我(是不是|得了|患了|有没有|到底是不是)/,
  /(帮我|给我|替我).{0,4}(确诊|诊断|看病|开药|处方)/,
  /diagnos(e|is|ing).{0,8}(me|my|him|her|thispatient|thepatient)/,
  /(确诊|诊断)(这个|该|这位|那个)?患者/,
  /(告诉|建议)(这个|该|这位|那位)患者/,
  /患者应该(用|吃|服用|接受|停)/,
  /(假设|假如)(这|它)?是(一个|一位)?(病例|患者)/,
  /请给(出)?具体(治疗|用药)?方案/,
  /学术(讨论|目的).{0,24}(患者|病例|方案|剂量|应该)/,
  /academic(purposes)?only.{0,24}(patient|dose|treat)/,
  /hypothetical(ly)?.{0,24}(patient|case|dose|treat)/,
  /prescri(be|ption|bing)/,
  /\d+(\.\d+)?(mg|毫克|微克|μg|iu)/,
  /(吃|服用|用)(多少|几)(mg|毫克|微克|片|粒|iu)/,
  /(dose|dosage|剂量|用量)/,
  /(加药|减药|换药|停药|调药|断药|加量|减量)/,
  /(stop|change|adjust|switch)(taking)?.{0,6}(medication|medicine|meds)/,
  /(给|为)(我|他|她|患者|病人|家人).{0,8}(治疗|用药|化疗)方案/,
  /具体(治疗|用药|化疗|手术)方案/,
  /(患|得|复发).{0,6}(概率|几率|可能性)/,
  /(概率|几率|风险)(是|大概)?多(少|大)/,
  /\d+(\.\d+)?%(的)?(风险|概率|几率|治愈率)/,
  /(风险|概率|几率|治愈率)(为|是|约|达)?\d+(\.\d+)?%/,
  /probabilit(y|ies)(that)?i(have|will|get)/,
  /chance(s)?(that)?i(have|will|get)/,
  /(保证|一定|肯定|百分百|100%)(能|可以)?(治愈|治好|痊愈|根治|有效)/,
  /无(任何)?副作用/,
  /guarantee[sd]?(a)?(cure|recovery)/,
  /willdefinitelycure/,
  /nosideeffects/,
  /(突发|急性|剧烈)(胸痛|腹痛|头痛|呼吸困难)/,
  /(胸痛|呼吸困难|昏迷|抽搐|大出血)(怎么办|如何处理|急救)/,
  /medicalemergency/,
  /(我|父亲|母亲|家人|爸爸|妈妈|老公|老婆|孩子)(的)?(癌|肿瘤).{0,10}(怎么治|怎么办|治疗|化疗|吃什么药|还能活)/,
  /(儿童|小孩|宝宝|婴儿|新生儿|孕妇|哺乳期).{0,10}(能不能|可不可以|可以|该)?(吃|服用|用).{0,4}药/,
  /pregnan(t|cy).{0,16}(take|taking|medication|drug|pill)/,
  /(child|children|baby|infant).{0,12}(dose|dosage|medication)/,
  /(自杀|自残|自伤|轻生|不想活|活不下去|结束(自己的)?生命)/,
  /(suicid|selfharm|killmyself|endmylife|hurtmyself)/,
];

// Minimum evidence availability below which a topic is treated as having no
// verifiable evidence base.
export const MINIMUM_EVIDENCE_AVAILABILITY = 0.2;

export function computeTopicFingerprint(title: string): string {
  return stableFingerprint(normalizeTopicText(title));
}

/**
 * Severity order: privacy > high_risk > everything else. Text detection can
 * never be overridden by `containsPatientData=false` or `riskLevel=low`,
 * and `riskLevel=high` always blocks.
 */
export function evaluateTopicSafety(topic: CandidateTopic): TopicSafetyResult {
  const { normalized, compact } = normalizeForMatching(`${topic.title} ${topic.normalizedQuestion}`);

  if (topic.containsPatientData) {
    return { allowed: false, blockReason: "privacy", detail: "topic contains identifiable patient data" };
  }
  for (const pattern of PRIVACY_NORMALIZED_PATTERNS) {
    if (pattern.test(normalized)) {
      return { allowed: false, blockReason: "privacy", detail: "topic text contains identifiable personal data" };
    }
  }
  for (const pattern of PRIVACY_COMPACT_PATTERNS) {
    if (pattern.test(compact)) {
      return { allowed: false, blockReason: "privacy", detail: "topic text contains identifiable personal data" };
    }
  }
  for (const pattern of HIGH_RISK_COMPACT_PATTERNS) {
    if (pattern.test(compact)) {
      return {
        allowed: false,
        blockReason: "high_risk",
        detail: "individual-case medical request cannot become a roundtable topic",
      };
    }
  }
  if (topic.riskLevel === "high") {
    return { allowed: false, blockReason: "high_risk", detail: "topic risk level is high" };
  }
  if (topic.evidenceAvailabilityScore < MINIMUM_EVIDENCE_AVAILABILITY) {
    return { allowed: false, blockReason: "no_verifiable_evidence", detail: "topic has no verifiable evidence base" };
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
 * same topic (score, tie-broken by id).
 *
 * Dedupe NEVER trusts the caller-provided duplicateFingerprint: the
 * fingerprint is always recomputed from the normalized title, and a
 * candidate whose provided fingerprint disagrees with the recomputation is
 * rejected outright (fingerprint forgery is not a bypass). The history set
 * must include published and currently-in-review topics.
 */
export function selectDailyTopic(
  candidates: readonly CandidateTopic[],
  previousTopicFingerprints: readonly string[]
): TopicSelection {
  const previous = new Set(previousTopicFingerprints);
  const rejected: RejectedTopic[] = [];
  const viable: CandidateTopic[] = [];

  for (const topic of candidates) {
    const safety = evaluateTopicSafety(topic);
    // Strictest verdict wins: privacy > high_risk > fingerprint/duplicate.
    if (!safety.allowed && (safety.blockReason === "privacy" || safety.blockReason === "high_risk")) {
      rejected.push({ topic, reason: safety.blockReason, detail: safety.detail ?? "blocked" });
      continue;
    }
    const computed = computeTopicFingerprint(topic.title);
    if (topic.duplicateFingerprint !== computed) {
      rejected.push({
        topic,
        reason: "fingerprint_mismatch",
        detail: "provided duplicateFingerprint does not match the recomputed fingerprint",
      });
      continue;
    }
    if (previous.has(computed)) {
      rejected.push({ topic, reason: "duplicate", detail: "topic duplicates a previous, published or in-review topic" });
      continue;
    }
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
