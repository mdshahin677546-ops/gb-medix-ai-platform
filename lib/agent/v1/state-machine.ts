/**
 * GB MEDIX AI consultation agent — pure state machine (no database).
 * Planning: AI_AGENT_CONSULTATION_PLAN.md §4.
 */

export const AGENT_STATES = [
  "created",
  "intake",
  "safety_check",
  "analysis",
  "plan_generation",
  "completed",
  "safety_escalated",
  "provider_failed",
  "invalid_output",
  "cancelled"
] as const;
export type AgentState = (typeof AGENT_STATES)[number];

const TERMINAL: ReadonlySet<AgentState> = new Set([
  "completed",
  "safety_escalated",
  "cancelled"
]);

/** Allowed transitions. Anything not listed is rejected. */
const TRANSITIONS: Record<AgentState, ReadonlySet<AgentState>> = {
  created: new Set(["intake", "cancelled"]),
  intake: new Set(["safety_check", "cancelled"]),
  safety_check: new Set(["analysis", "safety_escalated", "cancelled"]),
  analysis: new Set(["plan_generation", "provider_failed", "invalid_output", "cancelled"]),
  plan_generation: new Set(["completed", "provider_failed", "invalid_output", "cancelled"]),
  completed: new Set(),
  safety_escalated: new Set(),
  provider_failed: new Set(["analysis", "cancelled"]),
  invalid_output: new Set(["analysis", "cancelled"]),
  cancelled: new Set()
};

export function isTerminal(state: AgentState): boolean {
  return TERMINAL.has(state);
}

export function canTransition(from: AgentState, to: AgentState): boolean {
  return TRANSITIONS[from]?.has(to) ?? false;
}

export class InvalidAgentTransitionError extends Error {
  constructor(public readonly from: AgentState, public readonly to: AgentState) {
    super(`Invalid agent transition: ${from} -> ${to}`);
    this.name = "InvalidAgentTransitionError";
  }
}

/** Pure transition. Throws on an illegal transition; never mutates input. */
export function transition(from: AgentState, to: AgentState): AgentState {
  if (!canTransition(from, to)) {
    throw new InvalidAgentTransitionError(from, to);
  }
  return to;
}
