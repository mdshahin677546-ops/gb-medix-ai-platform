// GB MEDIX AI Medical Roundtable — Batch 2.2B offline run coordinator.
//
// A single, manually-triggered, deterministic and idempotent coordinator that
// drives one run through the 2.2A safety foundation and STOPS at
// `awaiting_medical_review`. Not a cron/timer. It reuses (never re-implements)
// the 2.2A modules for topic safety, agent-panel rules, budget, retry,
// evidence/claim binding, the AI trust boundary and distribution-asset
// integrity. Budget, retry and audit are fail-closed. It never advances to
// approved/published, never builds a real PublicationPlan, never calls a real
// provider/network/database.

import { planDailyRun, type DailyRunInput } from "../daily-run";
import { transition, type RoundtableState } from "../states";
import { validateAgentPanel, validateConsensusCompleteness, type AgentOutcome } from "../roles";
import { createEmptyUsage, recordBudgetUsage, canSpend, type BudgetUsage, type DailyRunBudget } from "../budget";
import { planRetry } from "../retry";
import { validateClaimsForMedicalReview } from "../claims";
import { parseConsensusDraft } from "../consensus";
import { createDraftDistributionAssets, type ConsensusSourceRef } from "../distribution";
import { createAuditEvent, type AuditEvent, type AuditEventType } from "../audit";
import {
  AwaitingReviewResult,
  BlockedResult,
  OrchestrationBlockedState,
  OrchestrationDeps,
  OrchestrationInput,
  OrchestrationResult,
  TransientProviderError,
} from "./types";

// Deterministic per-stage simulated costs (no ambient clock/RNG).
const COST = {
  agentTokens: 100,
  agentRuntimeMs: 500,
  evidenceRuntimeMs: 500,
  consensusTokens: 200,
  consensusRuntimeMs: 500,
  translationRuntimeMs: 300,
} as const;

class BudgetExceededError extends Error {
  constructor(public readonly dimension: keyof BudgetUsage) {
    super(`budget exceeded on ${dimension}`);
  }
}

function coarseReason(reason: string): string {
  // Drop id-bearing suffix so audit metadata stays a short safe enum-like value.
  return reason.split(":")[0].slice(0, 60);
}

function buildDailyRunInput(input: OrchestrationInput, candidateTopics: DailyRunInput["candidateTopics"]): DailyRunInput {
  return {
    runDate: input.runDate,
    candidateTopics,
    previousTopicFingerprints: input.previousTopicFingerprints,
    budget: input.budget,
    availableAgentRoles: input.availableAgentRoles,
    requestedLanguages: input.requestedLanguages,
  };
}

const PLANNED_BLOCK_MAP: Record<string, OrchestrationBlockedState> = {
  duplicate_blocked: "duplicate_blocked",
  privacy_blocked: "privacy_blocked",
  high_risk_blocked: "high_risk_blocked",
  budget_exceeded: "budget_exceeded",
  cancelled: "cancelled",
};

/**
 * Run one offline orchestration attempt. Returns awaiting_medical_review on
 * success, a terminal blocked result on a non-retryable failure, or a
 * retry_scheduled result on a transient provider failure (re-invoke with
 * attempt+1 and the SAME deps to resume — the operationId is reused, so no
 * second discussion is created).
 */
export function runOfflineOrchestration(input: OrchestrationInput, deps: OrchestrationDeps): OrchestrationResult {
  const attempt = input.attempt ?? 1;
  const budget: DailyRunBudget = input.budget;

  // 0. Panel pre-check: >=5 distinct roles, Evidence and Safety mandatory.
  const panel = validateAgentPanel(input.availableAgentRoles);
  if (!panel.valid) {
    return makeBlocked("cancelled", panel.errors.join("; "), null, createEmptyUsage(), []);
  }

  // 1. Topic selection + operationId + blocking, all via the reused planner.
  const candidates = deps.topicSource.fetchCandidates(input.runDate);
  let planned;
  try {
    planned = planDailyRun(buildDailyRunInput(input, candidates), deps.claimStore);
  } catch (error) {
    return makeBlocked("cancelled", `daily run planning failed: ${errText(error)}`, null, createEmptyUsage(), []);
  }
  if (planned.status === "blocked") {
    const state = PLANNED_BLOCK_MAP[planned.blockedState] ?? "cancelled";
    return makeBlocked(state, planned.reason, planned.operationId, createEmptyUsage(), planned.auditEvents);
  }

  const opId = planned.operationId;

  // Idempotent re-entry: a terminal cached run replays verbatim.
  const cached = deps.runStore.get(opId);
  if (cached?.terminal && cached.result) {
    return { ...cached.result, resumedFromStore: true };
  }
  const retriesUsed = cached?.retriesUsed ?? 0;

  // Mutable run context (closures below read the latest `usage`).
  let usage: BudgetUsage = planned.budgetPlan.usage;
  const audits: AuditEvent[] = [...planned.auditEvents];
  let seq = audits.length;
  const timestamp = input.timestamp;

  const audit = (eventType: AuditEventType, safeMetadata: Record<string, string | number | boolean>) => {
    audits.push(createAuditEvent({ operationId: opId, eventType, timestamp, safeMetadata, sequence: seq++ }));
  };
  const spend = (dimension: keyof BudgetUsage, amount: number) => {
    if (!canSpend(budget, usage, dimension, amount)) throw new BudgetExceededError(dimension);
    usage = recordBudgetUsage(usage, { [dimension]: amount });
  };

  const transientFailure = (
    errorType: "temporary_provider_error" | "temporary_evidence_service_error",
    where: string
  ): OrchestrationResult => {
    const plan = planRetry({ errorType, retriesUsed, maximumRetries: budget.maximumRetries, operationId: opId });
    if (plan.shouldRetry) {
      usage = recordBudgetUsage(usage, { retries: 1 }); // retries count against budget
      deps.runStore.put({ operationId: opId, retriesUsed: plan.nextRetryNumber ?? retriesUsed + 1, terminal: false, result: null });
      return {
        status: "retry_scheduled",
        operationId: opId,
        retryPlan: plan,
        reason: `${where} transient failure (attempt ${attempt})`,
        budgetUsage: usage,
        auditEvents: audits,
        resumedFromStore: false,
      };
    }
    audit("agent_failed", { errorType, state: "provider_failed" });
    const res = makeBlocked("provider_failed", `${where} failed after retries: ${plan.reason}`, opId, usage, audits);
    deps.runStore.put({ operationId: opId, retriesUsed, terminal: true, result: res });
    return res;
  };

  const terminalBlock = (state: OrchestrationBlockedState, reason: string): BlockedResult => {
    const res = makeBlocked(state, reason, opId, usage, audits);
    deps.runStore.put({ operationId: opId, retriesUsed, terminal: true, result: res });
    return res;
  };

  try {
    let state: RoundtableState = planned.initialState; // "topic_selected"
    state = transition(state, "safety_precheck");
    state = transition(state, "agents_assigned");
    audit("agents_invited", { count: planned.invitedAgents.length, state });

    // 2. Independent analysis per invited expert (budget: agentCalls, tokens, runtime).
    state = transition(state, "independent_analysis");
    const outcomes: AgentOutcome[] = [];
    for (const role of planned.invitedAgents) {
      spend("agentCalls", 1);
      let analysis;
      try {
        analysis = deps.expertPanel.runIndependentAnalysis(role, attempt);
      } catch (error) {
        if (error instanceof TransientProviderError) return transientFailure("temporary_provider_error", `expert ${role}`);
        throw error;
      }
      spend("tokens", analysis.tokens > 0 ? analysis.tokens : COST.agentTokens);
      spend("runtimeMs", COST.agentRuntimeMs);
      outcomes.push({ role: analysis.role, status: analysis.status });
      audit(analysis.status === "completed" ? "agent_completed" : "agent_failed", { agentRole: role });
    }
    // A single failed agent means no complete consensus can be claimed.
    const completeness = validateConsensusCompleteness(outcomes);
    if (!completeness.complete) {
      return terminalBlock("provider_failed", `incomplete consensus: ${completeness.errors.join("; ")}`);
    }

    // 3. Cross-examination + adversarial review.
    state = transition(state, "cross_examination");
    audit("cross_examination_completed", { state });
    state = transition(state, "adversarial_review");

    // 4. Evidence gather + verification (fail closed on invalid evidence).
    state = transition(state, "evidence_verification");
    spend("evidenceQueries", 1);
    let gathered;
    try {
      gathered = deps.evidenceService.gather(planned.selectedTopic.id, attempt);
    } catch (error) {
      if (error instanceof TransientProviderError) return transientFailure("temporary_evidence_service_error", "evidence service");
      throw error;
    }
    spend("runtimeMs", COST.evidenceRuntimeMs);
    for (const s of gathered.sources) audit("evidence_added", { evidenceId: s.id });
    const readiness = validateClaimsForMedicalReview(gathered.claims, gathered.sources);
    if (!readiness.ready) {
      for (const v of readiness.violations.slice(0, 3)) audit("evidence_rejected", { reason: coarseReason(v.reason) });
      return terminalBlock("evidence_invalid", `evidence not review-ready: ${readiness.violations.map((v) => v.reason).join("; ")}`);
    }
    for (const c of gathered.claims) if (c.verificationStatus === "verified") audit("evidence_verified", { claimId: c.id });

    // 5. Consensus draft — the AI trust boundary. parseConsensusDraft rejects
    //    any self-approval / forbidden-clinical-field smuggling and fixes
    //    medicalReviewStatus to "pending".
    state = transition(state, "consensus_drafting");
    spend("tokens", COST.consensusTokens);
    spend("runtimeMs", COST.consensusRuntimeMs);
    const composed = deps.consensusComposer.compose(planned.selectedTopic.id);
    const parsed = parseConsensusDraft(composed);
    if (!parsed.success || !parsed.draft) {
      return terminalBlock("schema_invalid", `consensus draft rejected: ${parsed.errors.join("; ")}`);
    }
    const draft = parsed.draft; // medicalReviewStatus === "pending" (guaranteed)
    audit("consensus_drafted", { version: draft.version, reviewStatus: draft.medicalReviewStatus });

    // 6. Multilingual draft assets (default pending); structural claim-id
    //    equality + forbidden-conclusion checks enforced by the reused module.
    state = transition(state, "translation_generation");
    const claimIds = gathered.claims.map((c) => c.id);
    const safetyClaimIds = gathered.claims.filter((c) => c.claimType === "safety_warning").map((c) => c.id);
    const source: ConsensusSourceRef = {
      id: opId,
      version: draft.version,
      claimIds,
      safetyWarningClaimIds: safetyClaimIds,
      lifecycleStatus: "active",
    };
    const contents = [];
    for (const lang of planned.languagePlan) {
      spend("translationLanguages", 1);
      spend("runtimeMs", COST.translationRuntimeMs);
      contents.push(deps.translationService.translate(lang, claimIds));
    }
    let assets;
    try {
      assets = createDraftDistributionAssets(source, contents);
    } catch (error) {
      return terminalBlock("schema_invalid", `distribution assets rejected: ${errText(error)}`);
    }
    for (const a of assets) audit("translation_drafted", { language: a.language, reviewStatus: a.medicalReviewStatus });

    // 7. STOP at awaiting_medical_review — no approval, no PublicationPlan.
    state = transition(state, "awaiting_medical_review");
    audit("medical_review_requested", { state, reviewStatus: "pending" });

    const result: AwaitingReviewResult = {
      status: "awaiting_medical_review",
      operationId: opId,
      finalStage: "awaiting_medical_review",
      consensusDraft: draft,
      assets,
      budgetUsage: usage,
      auditEvents: audits,
      publicationAllowed: false,
      publicationBlockReason:
        "offline orchestration stops at awaiting_medical_review; publication requires a trusted external MedicalReviewDecision not provided here",
      resumedFromStore: false,
    };
    deps.runStore.put({ operationId: opId, retriesUsed, terminal: true, result });
    return result;
  } catch (error) {
    if (error instanceof BudgetExceededError) {
      audit("budget_exceeded", { budgetDimension: String(error.dimension), state: "budget_exceeded" });
      return terminalBlock("budget_exceeded", `budget exceeded on ${error.dimension}`);
    }
    throw error;
  }
}

function makeBlocked(
  blockedState: OrchestrationBlockedState,
  reason: string,
  operationId: string | null,
  budgetUsage: BudgetUsage,
  auditEvents: AuditEvent[]
): BlockedResult {
  return { status: "blocked", blockedState, reason, operationId, budgetUsage, auditEvents, resumedFromStore: false };
}

function errText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
