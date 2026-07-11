import { newRequestId } from "../request-context";
import { success, failure, internalFailure } from "../failure";
import { finalize, type HandlerResult } from "../handler-result";
import type { Guard } from "../guards";
import { parsePagination, encodeCursor } from "../pagination";
import { toReportSummaryDTO } from "../mappers/report";

/** This API version models free/premium health reports only. */
export const SERVICEABLE_REPORT_TYPES = ["free_health_report", "premium_health_report"];

/** Summary-only projection — never selects analysis/recommendations/plans. */
export const REPORT_SUMMARY_SELECT = {
  id: true,
  type: true,
  status: true,
  score: true,
  summary: true,
  createdAt: true
} as const;

export type ReportSummaryRow = {
  id: string;
  type: string;
  status: string;
  score: number;
  summary: string;
  createdAt: Date | string;
};

export type ReportQueryArgs = {
  where: Record<string, unknown>;
  orderBy: unknown;
  take: number;
  select: typeof REPORT_SUMMARY_SELECT;
};

export type ReportsListHandlerDeps = {
  requireUser: Guard;
  queryReports: (args: ReportQueryArgs) => Promise<ReportSummaryRow[]>;
};

export type ReportsListInput = { query: { limit?: string | null; cursor?: string | null } };

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

/**
 * GET /api/v1/reports handler factory. Active+verified guard. Ownership is
 * enforced by scoping the query to the authenticated userId (never a client
 * value). Summary-only projection; keyset pagination over (createdAt, id) DESC.
 */
export function createReportsListHandler(deps: ReportsListHandlerDeps) {
  return async function GET(input: ReportsListInput): Promise<HandlerResult> {
    const requestId = newRequestId();
    try {
      const auth = await deps.requireUser(requestId);
      if (!auth.ok) return finalize(requestId, auth.failure);

      const page = parsePagination(input.query);
      if (!page.ok) return finalize(requestId, failure("VALIDATION_ERROR", requestId));

      const cursorFilter = page.cursor
        ? {
            OR: [
              { createdAt: { lt: new Date(page.cursor.createdAt) } },
              { createdAt: new Date(page.cursor.createdAt), id: { lt: page.cursor.id } }
            ]
          }
        : {};

      const rows = await deps.queryReports({
        where: {
          userId: auth.user.id,
          type: { in: SERVICEABLE_REPORT_TYPES },
          ...cursorFilter
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: page.limit + 1,
        select: REPORT_SUMMARY_SELECT
      });

      const hasMore = rows.length > page.limit;
      const pageRows = hasMore ? rows.slice(0, page.limit) : rows;
      const items = pageRows.map((row) =>
        toReportSummaryDTO({
          ...row,
          analysis: null,
          recommendations: null,
          lifestylePlan: null,
          followUpPlan: null
        })
      );
      const last = pageRows[pageRows.length - 1];
      const nextCursor =
        hasMore && last
          ? encodeCursor({ createdAt: toIso(last.createdAt), id: last.id })
          : null;

      return finalize(requestId, success({ items, nextCursor }, requestId));
    } catch {
      return finalize(requestId, internalFailure(requestId));
    }
  };
}
