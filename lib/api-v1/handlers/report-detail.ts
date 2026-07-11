import { newRequestId } from "../request-context";
import { success, failure, internalFailure } from "../failure";
import { finalize, type HandlerResult } from "../handler-result";
import type { Guard } from "../guards";
import { routeIdSchema } from "../../api-contract/v1/common";
import { toReportDetailDTO, toReportSummaryDTO, type ReportRow } from "../mappers/report";

/** Minimal projection for the ownership + entitlement gate (no report content). */
export const REPORT_METADATA_SELECT = {
  id: true,
  type: true,
  status: true,
  assessmentId: true,
  score: true,
  summary: true,
  createdAt: true
} as const;

/** Full projection — only read AFTER ownership + entitlement pass. */
export const REPORT_DETAIL_SELECT = {
  id: true,
  type: true,
  status: true,
  score: true,
  summary: true,
  analysis: true,
  recommendations: true,
  lifestylePlan: true,
  followUpPlan: true,
  createdAt: true
} as const;

const PREMIUM_TYPE = "premium_health_report";
const SERVICEABLE_TYPES = new Set(["free_health_report", PREMIUM_TYPE]);
const READY_STATUS = new Set(["free_ready", "premium_ready"]);

export type ReportMetaRow = {
  id: string;
  type: string;
  status: string;
  assessmentId: string | null;
  score: number;
  summary: string;
  createdAt: Date | string;
};

export type EntitlementScope = {
  userId: string;
  productId: string;
  resourceType: string;
  resourceId: string | null;
};

export type ReportDetailHandlerDeps = {
  requireUser: Guard;
  queryReportMetadata: (args: {
    where: Record<string, unknown>;
    select: typeof REPORT_METADATA_SELECT;
  }) => Promise<ReportMetaRow | null>;
  checkEntitlement: (scope: EntitlementScope) => Promise<boolean>;
  queryReportDetail: (args: {
    where: Record<string, unknown>;
    select: typeof REPORT_DETAIL_SELECT;
  }) => Promise<ReportRow | null>;
  premiumProductCode: string;
  assessmentResourceType: string;
};

export type ReportDetailInput = { id: string };

/**
 * GET /api/v1/reports/:id handler factory.
 *
 * 1. Validate the route id (strict charset/length) BEFORE any DB call.
 * 2. Owner-scoped metadata query { id, userId } selecting NO report content.
 *    Missing / non-owner -> identical 404 (no enumeration).
 * 3. Premium + no active resource-scoped entitlement -> 402, and the full detail
 *    query is NEVER run (premium JSON is not read).
 * 4. Only a free owner, or a premium owner with a valid entitlement, reaches the
 *    full detail query (still scoped { id, userId }).
 */
export function createReportDetailHandler(deps: ReportDetailHandlerDeps) {
  return async function GET(input: ReportDetailInput): Promise<HandlerResult> {
    const requestId = newRequestId();
    try {
      const auth = await deps.requireUser(requestId);
      if (!auth.ok) return finalize(requestId, auth.failure);

      const idParse = routeIdSchema.safeParse(input.id);
      if (!idParse.success) {
        return finalize(requestId, failure("VALIDATION_ERROR", requestId));
      }
      const id = idParse.data;
      const userId = auth.user.id;

      const meta = await deps.queryReportMetadata({
        where: { id, userId },
        select: REPORT_METADATA_SELECT
      });
      if (!meta || !SERVICEABLE_TYPES.has(meta.type)) {
        return finalize(requestId, failure("RESOURCE_NOT_FOUND", requestId));
      }

      let entitled = false;
      if (meta.type === PREMIUM_TYPE) {
        entitled = await deps.checkEntitlement({
          userId,
          productId: deps.premiumProductCode,
          resourceType: deps.assessmentResourceType,
          resourceId: meta.assessmentId ?? null
        });
        // Gate BEFORE reading any premium content.
        if (!entitled) {
          return finalize(requestId, failure("ENTITLEMENT_REQUIRED", requestId));
        }
      }

      // Not yet ready: answer from metadata only — never read the content columns.
      if (!READY_STATUS.has(meta.status)) {
        return finalize(
          requestId,
          success(
            {
              report: toReportSummaryDTO({
                ...meta,
                analysis: null,
                recommendations: null,
                lifestylePlan: null,
                followUpPlan: null
              })
            },
            requestId
          )
        );
      }

      const detailRow = await deps.queryReportDetail({
        where: { id, userId },
        select: REPORT_DETAIL_SELECT
      });
      if (!detailRow) return finalize(requestId, failure("RESOURCE_NOT_FOUND", requestId));

      const detail = toReportDetailDTO(detailRow, entitled);
      switch (detail.kind) {
        case "not_serviceable":
          return finalize(requestId, failure("RESOURCE_NOT_FOUND", requestId));
        case "locked":
          return finalize(requestId, failure("ENTITLEMENT_REQUIRED", requestId));
        default:
          return finalize(requestId, success({ report: detail.data }, requestId));
      }
    } catch {
      return finalize(requestId, internalFailure(requestId));
    }
  };
}
