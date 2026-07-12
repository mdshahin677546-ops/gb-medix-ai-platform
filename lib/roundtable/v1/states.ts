// Medical roundtable daily-run state machine.
//
// Hard rules encoded here:
// - only `scheduled` may enter `topic_selected`
// - consensus must flow through `awaiting_medical_review`
// - `published` is reachable ONLY from `approved`
// - `review_rejected` can never reach `published`
// - `superseded` can never become current again
// - `cancelled` / `privacy_blocked` / `high_risk_blocked` are terminal
// - illegal transitions fail loudly (throw), never silently succeed

export const NORMAL_STATES = [
  "scheduled",
  "topic_selected",
  "safety_precheck",
  "agents_assigned",
  "independent_analysis",
  "cross_examination",
  "adversarial_review",
  "evidence_verification",
  "consensus_drafting",
  "translation_generation",
  "awaiting_medical_review",
  "approved",
  "published",
  "monitoring",
  "revision_triggered",
  "superseded",
] as const;

export const BLOCKED_STATES = [
  "duplicate_blocked",
  "privacy_blocked",
  "high_risk_blocked",
  "budget_exceeded",
  "provider_failed",
  "evidence_invalid",
  "review_rejected",
  "cancelled",
] as const;

export type RoundtableNormalState = (typeof NORMAL_STATES)[number];
export type RoundtableBlockedState = (typeof BLOCKED_STATES)[number];
export type RoundtableState = RoundtableNormalState | RoundtableBlockedState;

export const ALL_STATES: readonly RoundtableState[] = [...NORMAL_STATES, ...BLOCKED_STATES];

const TRANSITIONS: Record<RoundtableState, readonly RoundtableState[]> = {
  scheduled: ["topic_selected", "duplicate_blocked", "privacy_blocked", "high_risk_blocked", "cancelled"],
  topic_selected: ["safety_precheck", "cancelled"],
  safety_precheck: ["agents_assigned", "privacy_blocked", "high_risk_blocked", "cancelled"],
  agents_assigned: ["independent_analysis", "provider_failed", "budget_exceeded", "cancelled"],
  independent_analysis: ["cross_examination", "provider_failed", "budget_exceeded", "cancelled"],
  cross_examination: ["adversarial_review", "provider_failed", "budget_exceeded", "cancelled"],
  adversarial_review: ["evidence_verification", "provider_failed", "budget_exceeded", "cancelled"],
  evidence_verification: ["consensus_drafting", "evidence_invalid", "provider_failed", "budget_exceeded", "cancelled"],
  consensus_drafting: ["translation_generation", "budget_exceeded", "cancelled"],
  translation_generation: ["awaiting_medical_review", "provider_failed", "budget_exceeded", "cancelled"],
  awaiting_medical_review: ["approved", "review_rejected", "high_risk_blocked", "cancelled"],
  approved: ["published", "cancelled"],
  published: ["monitoring"],
  monitoring: ["revision_triggered", "superseded"],
  revision_triggered: ["superseded", "monitoring"],
  superseded: [],
  duplicate_blocked: [],
  privacy_blocked: [],
  high_risk_blocked: [],
  budget_exceeded: [],
  // provider_failed is the only retryable blocked state: a retry resumes the
  // stage that failed (same operationId, retry counted against the budget).
  provider_failed: [
    "independent_analysis",
    "cross_examination",
    "adversarial_review",
    "evidence_verification",
    "translation_generation",
    "budget_exceeded",
    "cancelled",
  ],
  evidence_invalid: [],
  review_rejected: [],
  cancelled: [],
};

export const TERMINAL_STATES: readonly RoundtableState[] = [
  "cancelled",
  "privacy_blocked",
  "high_risk_blocked",
  "duplicate_blocked",
  "budget_exceeded",
  "evidence_invalid",
  "review_rejected",
  "superseded",
];

export function isRoundtableState(value: string): value is RoundtableState {
  return (ALL_STATES as readonly string[]).includes(value);
}

export function canTransition(from: RoundtableState, to: RoundtableState): boolean {
  const allowed = TRANSITIONS[from];
  return allowed !== undefined && allowed.includes(to);
}

export function transition(from: RoundtableState, to: RoundtableState): RoundtableState {
  if (!isRoundtableState(from) || !isRoundtableState(to)) {
    throw new Error(`Invalid roundtable transition: unknown state ${from} -> ${to}`);
  }
  if (!canTransition(from, to)) {
    throw new Error(`Invalid roundtable transition: ${from} -> ${to}`);
  }
  return to;
}

export function isTerminal(state: RoundtableState): boolean {
  return TERMINAL_STATES.includes(state);
}

export function isBlockedState(state: RoundtableState): boolean {
  return (BLOCKED_STATES as readonly string[]).includes(state);
}
