/**
 * Medical boundary policy + safety classification (pure, no model calls).
 * Planning: AI_AGENT_CONSULTATION_PLAN.md §2, §safety.
 */

/** Things the agent must never do. */
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

export type SafetyClassification = "normal" | "escalate" | "refuse_and_redirect";

/** Emergency-risk signals that must stop the normal flow and escalate. */
const EMERGENCY_SIGNALS: ReadonlyArray<{ id: string; patterns: RegExp }> = [
  { id: "chest_pain", patterns: /chest pain|胸痛|胸口痛/i },
  { id: "breathing_difficulty", patterns: /can'?t breathe|shortness of breath|呼吸困难|喘不上气/i },
  { id: "altered_consciousness", patterns: /unconscious|fainted|passing out|意识不清|昏迷/i },
  { id: "severe_allergy", patterns: /anaphyla|severe allergic|严重过敏/i },
  { id: "severe_bleeding", patterns: /severe bleeding|won'?t stop bleeding|大出血|严重出血/i },
  { id: "self_harm", patterns: /suicid|self[- ]?harm|kill myself|自杀|自残/i }
];

/** Requests for clinical actions the agent must refuse and redirect. */
const CLINICAL_REQUEST_SIGNALS: ReadonlyArray<{ id: string; patterns: RegExp }> = [
  { id: "wants_diagnosis", patterns: /diagnos|am i sick|what disease|确诊|我得了什么病/i },
  { id: "wants_prescription", patterns: /prescri|what medicine should i take|开药|吃什么药/i },
  { id: "wants_stop_medication", patterns: /stop taking|should i quit my medication|停药|要不要停药/i },
  { id: "wants_probability", patterns: /probability|chance i have|多大概率|得病概率/i }
];

/**
 * Classify a user utterance for safety routing. Emergency signals take
 * precedence and escalate. Clinical requests are refused and redirected.
 * This never emits a diagnosis and never calls a model.
 */
export function classifySafety(text: string): { classification: SafetyClassification; signalId?: string } {
  for (const s of EMERGENCY_SIGNALS) {
    if (s.patterns.test(text)) return { classification: "escalate", signalId: s.id };
  }
  for (const s of CLINICAL_REQUEST_SIGNALS) {
    if (s.patterns.test(text)) return { classification: "refuse_and_redirect", signalId: s.id };
  }
  return { classification: "normal" };
}
