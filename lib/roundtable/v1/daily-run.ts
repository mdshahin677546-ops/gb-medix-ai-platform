// Daily autonomous run planner: one topic per day, idempotent, auditable.
//
// This foundation has NO database and NO cron. The RunClaimStore interface
// is where production concurrency safety will live; the in-memory
// implementation below exists only for tests and process-local prototyping.

import { z } from "zod";
import { AuditEvent, createAuditEvent } from "./audit";
import { isValidCalendarDate } from "./types";
import { createEmptyUsage, DailyRunBudget, DailyRunBudgetSchema, BudgetUsage } from "./budget";
import { DEFAULT_AGENT_ROLES, validateAgentPanel } from "./roles";
import {
  CandidateTopic,
  CandidateTopicSchema,
  computeTopicFingerprint,
  RejectedTopic,
  selectDailyTopic,
} from "./topic-policy";

export const DailyRunInputSchema = z
  .object({
    runDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "runDate must be YYYY-MM-DD")
      .refine(isValidCalendarDate, "runDate must be a real calendar date (leap years respected, no 2026-02-30)"),
    candidateTopics: z.array(CandidateTopicSchema).min(1),
    /** Fingerprints of past, published AND currently-in-review topics. */
    previousTopicFingerprints: z.array(z.string()),
    budget: DailyRunBudgetSchema,
    availableAgentRoles: z.array(z.string().min(1)),
    requestedLanguages: z.array(z.string().min(2)).min(1),
  })
  .strict();

export type DailyRunInput = z.infer<typeof DailyRunInputSchema>;

export interface RunClaimResult {
  acquired: boolean;
  existingOperationId: string | null;
}

/**
 * Claims the single daily run slot for a runDate.
 *
 * PRODUCTION CONCURRENCY NOTE: this foundation does NOT implement a
 * distributed lock, and an in-memory implementation CANNOT guarantee
 * concurrent uniqueness across processes or instances. The production
 * implementation of this interface MUST be backed by a database unique
 * constraint on the run date, a lease with expiry, and a monotonic fencing
 * token verified on every subsequent write.
 */
export interface RunClaimStore {
  claim(runDate: string, operationId: string): RunClaimResult;
}

/** Test/prototype double only — see RunClaimStore for the production plan. */
export class InMemoryRunClaimStore implements RunClaimStore {
  private readonly claims = new Map<string, string>();

  claim(runDate: string, operationId: string): RunClaimResult {
    const existing = this.claims.get(runDate);
    if (existing === undefined) {
      this.claims.set(runDate, operationId);
      return { acquired: true, existingOperationId: null };
    }
    return { acquired: false, existingOperationId: existing };
  }
}

/**
 * operationId contains only the run date and a content fingerprint — never
 * patient information — and is NOT an authorization credential.
 */
export function buildOperationId(runDate: string, topicFingerprint: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(runDate)) {
    throw new Error(`Invalid runDate for operationId: ${runDate}`);
  }
  if (!/^[0-9a-f]{16}$/.test(topicFingerprint)) {
    throw new Error("Invalid topic fingerprint for operationId");
  }
  return `roundtable:${runDate}:${topicFingerprint}:v1`;
}

export interface BudgetPlan {
  budget: DailyRunBudget;
  usage: BudgetUsage;
}

export interface PlannedDailyRun {
  status: "planned";
  operationId: string;
  selectedTopic: CandidateTopic;
  topicFingerprint: string;
  invitedAgents: string[];
  budgetPlan: BudgetPlan;
  languagePlan: string[];
  initialState: "topic_selected";
  auditEvents: AuditEvent[];
  /** True when a retry re-claimed an existing operation (same operationId). */
  reusedExistingOperation: boolean;
}

export type DailyRunBlockedState =
  | "duplicate_blocked"
  | "privacy_blocked"
  | "high_risk_blocked"
  | "budget_exceeded"
  | "cancelled";

export interface BlockedDailyRun {
  status: "blocked";
  blockedState: DailyRunBlockedState;
  reason: string;
  operationId: string | null;
  auditEvents: AuditEvent[];
}

export type DailyRunPlanResult = PlannedDailyRun | BlockedDailyRun;

function blockedStateForRejections(rejected: readonly RejectedTopic[]): { state: DailyRunBlockedState; reason: string } {
  if (rejected.some((r) => r.reason === "privacy")) {
    return { state: "privacy_blocked", reason: "all candidate topics blocked; privacy violation present" };
  }
  if (rejected.some((r) => r.reason === "high_risk")) {
    return { state: "high_risk_blocked", reason: "all candidate topics blocked; high-risk topic present" };
  }
  if (rejected.some((r) => r.reason === "duplicate")) {
    return { state: "duplicate_blocked", reason: "all candidate topics are duplicates" };
  }
  return { state: "cancelled", reason: "no viable topic available" };
}

/**
 * Plan (or idempotently re-plan) the single daily roundtable run.
 *
 * Deterministic: the same input always yields the same operationId and the
 * same audit events, so a retry after a transient failure reuses the same
 * operation instead of creating a second discussion.
 */
export function planDailyRun(rawInput: DailyRunInput, claimStore: RunClaimStore): DailyRunPlanResult {
  const input = DailyRunInputSchema.parse(rawInput);
  const timestamp = `${input.runDate}T00:00:00.000Z`;
  let sequence = 0;
  const auditEvents: AuditEvent[] = [];
  const audit = (
    eventType: Parameters<typeof createAuditEvent>[0]["eventType"],
    operationId: string,
    safeMetadata: Record<string, string | number | boolean>
  ) => {
    auditEvents.push(createAuditEvent({ operationId, eventType, timestamp, safeMetadata, sequence: sequence++ }));
  };

  const pendingOperationId = `roundtable:${input.runDate}:pending:v1`;
  audit("run_scheduled", pendingOperationId, { runDate: input.runDate, count: input.candidateTopics.length });

  const selection = selectDailyTopic(input.candidateTopics, input.previousTopicFingerprints);
  for (const rejection of selection.rejected) {
    audit("topic_blocked", pendingOperationId, {
      runDate: input.runDate,
      topicId: rejection.topic.id,
      blockReason: rejection.reason,
    });
  }
  if (!selection.selected) {
    const { state, reason } = blockedStateForRejections(selection.rejected);
    return { status: "blocked", blockedState: state, reason, operationId: null, auditEvents };
  }

  const selectedTopic = selection.selected;
  const topicFingerprint = computeTopicFingerprint(selectedTopic.title);
  const operationId = buildOperationId(input.runDate, topicFingerprint);

  const claim = claimStore.claim(input.runDate, operationId);
  if (!claim.acquired && claim.existingOperationId !== operationId) {
    return {
      status: "blocked",
      blockedState: "duplicate_blocked",
      reason: `daily run slot for ${input.runDate} already claimed by another operation`,
      operationId: claim.existingOperationId,
      auditEvents,
    };
  }
  const reusedExistingOperation = !claim.acquired;

  const invitedAgents = [...DEFAULT_AGENT_ROLES];
  const missingDefaults = invitedAgents.filter((role) => !input.availableAgentRoles.includes(role));
  if (missingDefaults.length > 0) {
    throw new Error(`Cannot start roundtable: missing default agent roles: ${missingDefaults.join(", ")}`);
  }
  const panel = validateAgentPanel(invitedAgents);
  if (!panel.valid) {
    throw new Error(`Cannot start roundtable: ${panel.errors.join("; ")}`);
  }

  const languagePlan = [...new Set(input.requestedLanguages)];
  if (languagePlan.length > input.budget.maximumTranslationLanguages) {
    return {
      status: "blocked",
      blockedState: "budget_exceeded",
      reason: `requested ${languagePlan.length} languages exceeds maximumTranslationLanguages ${input.budget.maximumTranslationLanguages}`,
      operationId,
      auditEvents,
    };
  }

  audit("topic_selected", operationId, {
    runDate: input.runDate,
    topicId: selectedTopic.id,
    topicFingerprint,
    category: selectedTopic.category,
  });
  audit("agents_invited", operationId, { runDate: input.runDate, count: invitedAgents.length });

  return {
    status: "planned",
    operationId,
    selectedTopic,
    topicFingerprint,
    invitedAgents,
    budgetPlan: { budget: input.budget, usage: createEmptyUsage() },
    languagePlan,
    initialState: "topic_selected",
    auditEvents,
    reusedExistingOperation,
  };
}
