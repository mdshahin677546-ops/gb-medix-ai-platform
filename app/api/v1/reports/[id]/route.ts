import { prisma } from "@/lib/prisma";
import {
  PRODUCT_PREMIUM_REPORT,
  RESOURCE_ASSESSMENT,
  checkEntitlement
} from "@/lib/entitlements";
import { createReportDetailHandler } from "@/lib/api-v1";
import { requireActiveVerifiedUser } from "@/lib/api-v1/session";
import { toNextResponse } from "@/lib/api-v1/http";

/**
 * GET /api/v1/reports/:id — a single owned report.
 * Active+verified. Route-id validation, IDOR { id, userId } scoping, the
 * two-stage (metadata -> entitlement gate -> detail) read, and premium gating
 * all live in the tested handler; this adapter injects real Prisma queries and
 * the real entitlement check.
 */
const handler = createReportDetailHandler({
  requireUser: requireActiveVerifiedUser,
  queryReportMetadata: (args) =>
    prisma.aIReport.findFirst(args as Parameters<typeof prisma.aIReport.findFirst>[0]),
  checkEntitlement,
  queryReportDetail: (args) =>
    prisma.aIReport.findFirst(args as Parameters<typeof prisma.aIReport.findFirst>[0]),
  premiumProductCode: PRODUCT_PREMIUM_REPORT,
  assessmentResourceType: RESOURCE_ASSESSMENT
});

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  return toNextResponse(await handler({ id: params.id }));
}
