// GB MEDIX AI Medical Roundtable — Batch 2.2B offline orchestration types.
//
// Deterministic, idempotent, database-free, provider-free orchestration that
// drives a single manual run through the 2.2A safety foundation and STOPS at
// `awaiting_medical_review`. It never calls a real AI provider, never touches
// a database, never triggers a real PublicationPlan or publish path, and is
// not a cron/timer. All external capabilities are expressed as adapter
// interfaces; only in-memory doubles are provided (see ./adapters).

import { CandidateTopic } from "../topic-policy";
import { DailyRunBudget, BudgetUsage } from "../budget";
import { EvidenceSource } from "../evidence";
import { EvidenceClaim } from "../claims";
import { ConsensusDraft } from "../consensus";
import { DraftDistributionAsset, AssetContentInput } from "../distribution";
import { AuditEvent } from "../audit";
import { AgentOutcome } from "../roles";
import { RetryPlan } from "../retry";

/** Stages this coordinator advances through — never past awaiting review. */
export const ORCHESTRATION_STAGES = [
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
] as const;

export type OrchestrationStage = (typeof ORCHESTRATION_STAGES)[number];

// --- adapter interfaces (in-memory doubles only in this batch) -------------

/** Supplies candidate topics for a run date. Mock only. */
export interface TopicSource {
  fetchCandidates(runDate: string): CandidateTopic[];
}

export interface ExpertAnalysis extends AgentOutcome {
  /** Simulated token cost of this expert's independent analysis. */
  tokens: number;
}

/**
 * Runs each assigned expert role's independent analysis. Mock only. May throw
 * a transient provider error (simulated) so retry/recovery can be exercised.
 */
export interface ExpertPanel {
  roles(): string[];
  runIndependentAnalysis(role: string, attempt: number): ExpertAnalysis;
}

/** Gathers evidence sources and claims for the selected topic. Mock only. */
export interface EvidenceService {
  gather(topicId: string, attempt: number): { sources: EvidenceSource[]; claims: EvidenceClaim[] };
}

/**
 * Composes the AI consensus DRAFT INPUT. Mock only. Returns `unknown` on
 * purpose: the coordinator hands it straight to the trusted
 * parseConsensusDraft, so a composer that tries to inject review/approval
 * fields (self-approval attack) is rejected by the real safety schema.
 */
export interface ConsensusComposer {
  compose(topicId: string): unknown;
}

/** Produces per-language draft distribution asset content. Mock only. */
export interface TranslationService {
  translate(language: string, sourceClaimIds: string[]): AssetContentInput;
}

// --- idempotent / recoverable run store ------------------------------------

export interface StoredRun {
  operationId: string;
  /** Retries already consumed for this operation. */
  retriesUsed: number;
  /** True once the run reached a terminal outcome (awaiting review OR blocked). */
  terminal: boolean;
  /** Cached terminal result, replayed verbatim on idempotent re-entry. */
  result: OrchestrationResult | null;
}

/**
 * Persists per-operation run state for idempotent re-entry and recovery.
 *
 * PRODUCTION NOTE: the only implementation shipped here is in-memory and is
 * single-process. It does NOT guarantee cross-process concurrency, is NOT a
 * real cron, and is NOT a database unique constraint. Production must back
 * this with a DB unique constraint on the operation id plus lease + fencing.
 */
export interface OrchestrationRunStore {
  get(operationId: string): StoredRun | undefined;
  put(record: StoredRun): void;
}

// --- coordinator input / deps ----------------------------------------------

export interface FaultInjection {
  /** Expert roles that fail with a transient provider error up to this attempt. */
  expertFailUntilAttempt?: number;
  /** Evidence service fails with a transient error up to this attempt. */
  evidenceFailUntilAttempt?: number;
}

export interface OrchestrationInput {
  runDate: string;
  /** Candidate topics come from the TopicSource adapter, not this input. */
  previousTopicFingerprints: string[];
  budget: DailyRunBudget;
  availableAgentRoles: string[];
  requestedLanguages: string[];
  /** ISO timestamp — keeps audit events deterministic (no ambient clock). */
  timestamp: string;
  /** 1-based attempt number; a retry re-invokes with attempt+1. */
  attempt?: number;
}

export interface OrchestrationDeps {
  claimStore: import("../daily-run").RunClaimStore;
  runStore: OrchestrationRunStore;
  topicSource: TopicSource;
  expertPanel: ExpertPanel;
  evidenceService: EvidenceService;
  consensusComposer: ConsensusComposer;
  translationService: TranslationService;
}

// --- result union ----------------------------------------------------------

export type OrchestrationBlockedState =
  | "cancelled"
  | "duplicate_blocked"
  | "privacy_blocked"
  | "high_risk_blocked"
  | "budget_exceeded"
  | "provider_failed"
  | "evidence_invalid"
  | "schema_invalid";

export interface AwaitingReviewResult {
  status: "awaiting_medical_review";
  operationId: string;
  finalStage: "awaiting_medical_review";
  consensusDraft: ConsensusDraft;
  assets: DraftDistributionAsset[];
  budgetUsage: BudgetUsage;
  auditEvents: AuditEvent[];
  /** Always false — publication requires a trusted external review decision
   * that this offline coordinator never provides. */
  publicationAllowed: false;
  publicationBlockReason: string;
  resumedFromStore: boolean;
}

export interface BlockedResult {
  status: "blocked";
  blockedState: OrchestrationBlockedState;
  reason: string;
  operationId: string | null;
  budgetUsage: BudgetUsage;
  auditEvents: AuditEvent[];
  resumedFromStore: boolean;
}

export interface RetryScheduledResult {
  status: "retry_scheduled";
  operationId: string;
  /** Same operationId is reused on the next attempt — no second discussion. */
  retryPlan: RetryPlan;
  reason: string;
  budgetUsage: BudgetUsage;
  auditEvents: AuditEvent[];
  resumedFromStore: boolean;
}

export type OrchestrationResult = AwaitingReviewResult | BlockedResult | RetryScheduledResult;

/** Raised by adapters to signal a transient, retryable provider failure. */
export class TransientProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransientProviderError";
  }
}
