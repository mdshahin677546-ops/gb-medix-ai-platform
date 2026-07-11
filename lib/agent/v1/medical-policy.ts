/**
 * Medical boundary policy + safety classification (pure, no model calls).
 * Handles Chinese + English, case, punctuation, extra whitespace, and basic
 * negation / quotation context. When uncertain, returns a safe clarification —
 * never a diagnosis or medication instruction.
 * Planning: AI_AGENT_CONSULTATION_PLAN.md §2, §safety.
 */

export const PROHIBITED_ACTIONS = [
  "diagnose_disease",
  "prescribe",
  "treatment_plan",
  "stop_or_change_medication",
  "disease_probability",
  "auto_triage_conclusion",
  "replace_doctor",
  "claim_cure"
] as const;
export type ProhibitedAction = (typeof PROHIBITED_ACTIONS)[number];

export type SafetyClassification =
  | "escalate"
  | "refuse_and_redirect"
  | "safe_clarify"
  | "normal";

export type ClinicalRequestCategory =
  | "diagnosis_request"
  | "medication_or_prescription_request"
  | "medication_change_request"
  | "disease_probability_request"
  | "guaranteed_outcome_request";

export type SafetyResult = {
  classification: SafetyClassification;
  category?: ClinicalRequestCategory;
  signalId?: string;
};

const EMERGENCY_SIGNALS: ReadonlyArray<{ id: string; pattern: RegExp }> = [
  { id: "chest_pain", pattern: /胸痛|胸口疼|胸口痛|chest pain/i },
  { id: "breathing_difficulty", pattern: /呼吸困难|喘不上气|喘不过气|can'?t breathe|shortness of breath|trouble breathing/i },
  { id: "altered_consciousness", pattern: /意识不清|昏迷|晕过去|失去意识|unconscious|passed out|fainting/i },
  { id: "severe_allergy", pattern: /严重过敏|过敏性休克|anaphylax|severe allergic reaction/i },
  { id: "severe_bleeding", pattern: /大出血|严重出血|止不住血|severe bleeding|heavy bleeding/i },
  { id: "self_harm", pattern: /自杀|自残|想不开|不想活|suicid|self[- ]?harm|kill myself|end my life/i }
];

const EMERGENCY_NEGATION = /没有|没|无|not |without|no /i;
const MED_CHANGE_NEGATION = /不要|别|不能|勿|请勿|do not|don'?t|not to/i;
const HAVE_NEGATION = /没有|没|无|don'?t have|do not have|without/i;

const CLINICAL_SIGNALS: ReadonlyArray<{ category: ClinicalRequestCategory; pattern: RegExp; negation?: RegExp }> = [
  {
    category: "guaranteed_outcome_request",
    pattern: /保证.{0,4}(治好|治愈|好)|一定(能|会)?(治好|治愈|好)|(能|会)治好吗|治得好吗|guarantee[ds]?\b.{0,20}(cure|heal|recover)|will .{0,20}(definitely|surely|for sure).{0,20}(cure|heal|recover)|definitely cure/i
  },
  {
    category: "diagnosis_request",
    pattern: /确诊|什么病|我是不是.{0,6}(病|癌|心脏病|糖尿病|高血压)|是不是得了|这是(不是)?.{0,4}癌症?吗|这是不是.{0,4}病|do i have\b|am i sick|what disease|diagnos/i,
    negation: HAVE_NEGATION
  },
  {
    category: "medication_or_prescription_request",
    pattern: /开药|给我开药|吃什么药|该吃什么药|(该|应该)?吃多少|一天吃几次|每天吃几次|一次吃几片|剂量(是)?多少|prescri|what medicine should i take|what (dose|dosage)|how (much|many).{0,20}(take|pill|dose)/i
  },
  {
    category: "medication_change_request",
    pattern: /可以停药吗?|要不要停药|停药|调整剂量|改药量|减药|加药|can i stop|stop taking|quit .{0,15}medication|adjust.{0,12}(dose|medication)/i,
    negation: MED_CHANGE_NEGATION
  },
  {
    category: "disease_probability_request",
    pattern: /概率|多大可能|多大概率|可能性(有)?多大|患.{0,4}概率|probability|how likely|chance (i|of).{0,20}(have|cancer|disease)/i
  }
];

/** Inner text ranges that sit inside quotation marks. */
function quotedRanges(text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const re = /[“"「『‘]([^”"」』’]*)[”"」』’]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    ranges.push([m.index + 1, m.index + m[0].length - 1]);
  }
  return ranges;
}

function isInside(index: number, ranges: Array<[number, number]>): boolean {
  return ranges.some(([a, b]) => index >= a && index < b);
}

function precededBy(text: string, index: number, neg: RegExp): boolean {
  return neg.test(text.slice(Math.max(0, index - 8), index));
}

/**
 * Classify a user utterance for safety routing. Emergencies escalate; clinical
 * requests (diagnosis / medication / dose change / probability / guaranteed
 * outcome) are refused and redirected. Negated symptoms and quoted phrases do
 * not trigger a false positive; ambiguous quoted clinical phrases return
 * safe_clarify. Never emits a diagnosis and never calls a model.
 */
export function classifySafety(rawText: string): SafetyResult {
  const text = (rawText ?? "").replace(/\s+/g, " ").trim();
  if (!text) return { classification: "normal" };
  const quotes = quotedRanges(text);

  // Emergencies first (highest priority), unless negated or quoted.
  for (const sig of EMERGENCY_SIGNALS) {
    const m = sig.pattern.exec(text);
    if (m && !isInside(m.index, quotes) && !precededBy(text, m.index, EMERGENCY_NEGATION)) {
      return { classification: "escalate", signalId: sig.id };
    }
  }

  let quotedClinicalSeen = false;
  for (const sig of CLINICAL_SIGNALS) {
    const m = sig.pattern.exec(text);
    if (!m) continue;
    if (isInside(m.index, quotes)) {
      quotedClinicalSeen = true;
      continue;
    }
    if (sig.negation && precededBy(text, m.index, sig.negation)) {
      continue; // e.g. "医生告诉我不要自行停药" — a report; "我没有什么病" — a denial
    }
    return { classification: "refuse_and_redirect", category: sig.category };
  }

  // A clinical phrase appeared only in quotes / uncertain context.
  if (quotedClinicalSeen) return { classification: "safe_clarify" };
  return { classification: "normal" };
}
