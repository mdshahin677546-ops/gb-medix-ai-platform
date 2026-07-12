// Roundtable agent roles and panel validation.
//
// A roundtable may not start unless the panel has at least five DISTINCT
// roles, all five default roles are present, and both the evidence agent and
// the safety agent are among them. Duplicate roles never count twice.

export const DEFAULT_AGENT_ROLES = [
  "moderator",
  "evidence_medicine",
  "clinical_perspective",
  "adversarial_reviewer",
  "medical_safety_compliance",
] as const;

export const OPTIONAL_AGENT_ROLES = [
  "cardiology",
  "oncology",
  "endocrinology",
  "pharmacy",
  "nutrition",
  "mental_health",
  "tcm_wellness",
  "public_health",
  "medical_ethics",
] as const;

export type DefaultAgentRole = (typeof DEFAULT_AGENT_ROLES)[number];
export type OptionalAgentRole = (typeof OPTIONAL_AGENT_ROLES)[number];
export type AgentRole = DefaultAgentRole | OptionalAgentRole;

export const KNOWN_AGENT_ROLES: readonly string[] = [...DEFAULT_AGENT_ROLES, ...OPTIONAL_AGENT_ROLES];

export const MINIMUM_AGENT_COUNT = 5;
export const EVIDENCE_AGENT_ROLE = "evidence_medicine";
export const SAFETY_AGENT_ROLE = "medical_safety_compliance";

export interface AgentPanelValidation {
  valid: boolean;
  errors: string[];
  uniqueRoles: string[];
}

export function validateAgentPanel(roles: readonly string[]): AgentPanelValidation {
  const errors: string[] = [];
  const uniqueRoles = [...new Set(roles)];

  for (const role of uniqueRoles) {
    if (!KNOWN_AGENT_ROLES.includes(role)) {
      errors.push(`unknown agent role: ${role}`);
    }
  }
  if (uniqueRoles.length < MINIMUM_AGENT_COUNT) {
    errors.push(
      `at least ${MINIMUM_AGENT_COUNT} distinct agent roles required, got ${uniqueRoles.length} (duplicates do not count)`
    );
  }
  for (const required of DEFAULT_AGENT_ROLES) {
    if (!uniqueRoles.includes(required)) {
      errors.push(`missing required default agent role: ${required}`);
    }
  }
  if (!uniqueRoles.includes(EVIDENCE_AGENT_ROLE)) {
    errors.push("roundtable cannot start without the evidence agent");
  }
  if (!uniqueRoles.includes(SAFETY_AGENT_ROLE)) {
    errors.push("roundtable cannot start without the safety agent");
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)], uniqueRoles };
}

export interface AgentOutcome {
  role: string;
  status: "completed" | "failed";
}

export interface ConsensusCompleteness {
  complete: boolean;
  errors: string[];
}

/**
 * A "complete" consensus requires a valid panel where EVERY agent completed.
 * If any single agent failed, the run must not claim a complete consensus.
 */
export function validateConsensusCompleteness(outcomes: readonly AgentOutcome[]): ConsensusCompleteness {
  const errors: string[] = [];
  const panel = validateAgentPanel(outcomes.map((o) => o.role));
  errors.push(...panel.errors);
  for (const outcome of outcomes) {
    if (outcome.status !== "completed") {
      errors.push(`agent ${outcome.role} did not complete; a complete consensus cannot be claimed`);
    }
  }
  return { complete: errors.length === 0, errors };
}
