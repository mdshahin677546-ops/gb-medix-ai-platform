import { prisma } from "@/lib/prisma";
import {
  PRODUCT_PREMIUM_REPORT,
  RESOURCE_ASSESSMENT,
  checkEntitlement
} from "@/lib/entitlements";
import {
  newRequestId,
  internalFailure,
  success,
  toReportDetailDTO
} from "@/lib/api-v1";
import { failure } from "@/lib/api-v1/failure";
import { requireApiUser } from "@/lib/api-v1/session";
import { respond } from "@/lib/api-v1/http";

/**
 * GET /api/v1/reports/:id — a single report owned by the current user.
 *
 * IDOR-safe: queried by { id, userId } together, so another user's report id and
 * a non-existent id return the SAME 404 (no existence enumeration). Premium
 * content is gated by the existing resource-scoped Entitlement service (402 when
 * absent). Consent is not entitlement; a client cannot self-declare "unlocked".
 * Refunded/revoked entitlements are non-"active" and therefore never unlock.
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const requestId = newRequestId();
  try {
    const auth = await requireApiUser(requestId);
    if (!auth.ok) return respond(requestId, auth.failure);

    const report = await prisma.aIReport.findFirst({
      where: { id: params.id, userId: auth.user.id },
      select: {
        id: true,
        type: true,
        status: true,
        score: true,
        summary: true,
        assessmentId: true,
        analysis: true,
        recommendations: true,
        lifestylePlan: true,
        followUpPlan: true,
        createdAt: true
      }
    });
    if (!report) return respond(requestId, failure("RESOURCE_NOT_FOUND", requestId));

    const entitled =
      report.type === "premium_health_report"
        ? await checkEntitlement({
            userId: auth.user.id,
            productId: PRODUCT_PREMIUM_REPORT,
            resourceType: RESOURCE_ASSESSMENT,
            resourceId: report.assessmentId
          })
        : false;

    const detail = toReportDetailDTO(report, entitled);
    switch (detail.kind) {
      case "not_serviceable":
        return respond(requestId, failure("RESOURCE_NOT_FOUND", requestId));
      case "locked":
        return respond(requestId, failure("ENTITLEMENT_REQUIRED", requestId));
      default:
        return respond(requestId, success({ report: detail.data }, requestId));
    }
  } catch {
    return respond(requestId, internalFailure(requestId));
  }
}
