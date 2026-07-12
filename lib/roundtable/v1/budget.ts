// Daily-run budget definition and enforcement.
//
// Every limit is a hard stop: retries, translations and evidence queries all
// consume budget. Negative, NaN or Infinity values are rejected loudly —
// budget errors are never silently ignored, and an over-budget run must
// enter `budget_exceeded` instead of producing a fake "completed" result.

import { z } from "zod";

const positiveInt = z.number().int().finite().positive();
const nonNegativeInt = z.number().int().finite().nonnegative();

export const DailyRunBudgetSchema = z
  .object({
    maximumAgentCalls: positiveInt,
    maximumEvidenceQueries: positiveInt,
    maximumTokens: positiveInt,
    maximumRetries: nonNegativeInt,
    maximumTranslationLanguages: positiveInt,
    maximumRuntimeMs: positiveInt,
  })
  .strict();

export type DailyRunBudget = z.infer<typeof DailyRunBudgetSchema>;

export const BudgetUsageSchema = z
  .object({
    agentCalls: nonNegativeInt,
    evidenceQueries: nonNegativeInt,
    tokens: nonNegativeInt,
    retries: nonNegativeInt,
    translationLanguages: nonNegativeInt,
    runtimeMs: nonNegativeInt,
  })
  .strict();

export type BudgetUsage = z.infer<typeof BudgetUsageSchema>;

export const BUDGET_DIMENSIONS: readonly (keyof BudgetUsage)[] = [
  "agentCalls",
  "evidenceQueries",
  "tokens",
  "retries",
  "translationLanguages",
  "runtimeMs",
];

const USAGE_TO_LIMIT: Record<keyof BudgetUsage, keyof DailyRunBudget> = {
  agentCalls: "maximumAgentCalls",
  evidenceQueries: "maximumEvidenceQueries",
  tokens: "maximumTokens",
  retries: "maximumRetries",
  translationLanguages: "maximumTranslationLanguages",
  runtimeMs: "maximumRuntimeMs",
};

export function createEmptyUsage(): BudgetUsage {
  return {
    agentCalls: 0,
    evidenceQueries: 0,
    tokens: 0,
    retries: 0,
    translationLanguages: 0,
    runtimeMs: 0,
  };
}

/**
 * Record additional usage immutably. Any non-finite, negative or
 * non-integer delta throws — invalid budget accounting must never be
 * silently ignored.
 */
export function recordBudgetUsage(usage: BudgetUsage, delta: Partial<BudgetUsage>): BudgetUsage {
  const current = BudgetUsageSchema.parse(usage);
  const next: BudgetUsage = { ...current };
  for (const dimension of BUDGET_DIMENSIONS) {
    const value = delta[dimension];
    if (value === undefined) continue;
    if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
      throw new Error(`Invalid budget usage delta for ${dimension}: ${String(value)}`);
    }
    next[dimension] = current[dimension] + value;
  }
  return next;
}

export interface BudgetEvaluation {
  withinBudget: boolean;
  exceededDimensions: (keyof BudgetUsage)[];
}

/** Usage above any maximum means the run must stop in `budget_exceeded`. */
export function evaluateBudget(budget: DailyRunBudget, usage: BudgetUsage): BudgetEvaluation {
  const parsedBudget = DailyRunBudgetSchema.parse(budget);
  const parsedUsage = BudgetUsageSchema.parse(usage);
  const exceededDimensions: (keyof BudgetUsage)[] = [];
  for (const dimension of BUDGET_DIMENSIONS) {
    if (parsedUsage[dimension] > parsedBudget[USAGE_TO_LIMIT[dimension]]) {
      exceededDimensions.push(dimension);
    }
  }
  return { withinBudget: exceededDimensions.length === 0, exceededDimensions };
}

/** True only if spending `amount` more on `dimension` stays within budget. */
export function canSpend(
  budget: DailyRunBudget,
  usage: BudgetUsage,
  dimension: keyof BudgetUsage,
  amount: number
): boolean {
  if (typeof amount !== "number" || Number.isNaN(amount) || !Number.isFinite(amount) || !Number.isInteger(amount) || amount < 0) {
    throw new Error(`Invalid budget spend amount for ${dimension}: ${String(amount)}`);
  }
  const parsedBudget = DailyRunBudgetSchema.parse(budget);
  const parsedUsage = BudgetUsageSchema.parse(usage);
  return parsedUsage[dimension] + amount <= parsedBudget[USAGE_TO_LIMIT[dimension]];
}
