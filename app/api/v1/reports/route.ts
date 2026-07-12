import { prisma } from "@/lib/prisma";
import { createReportsListHandler, type ReportQueryArgs } from "@/lib/api-v1";
import { requireActiveVerifiedUser } from "@/lib/api-v1/session";
import { toNextResponse } from "@/lib/api-v1/http";

/**
 * GET /api/v1/reports — summary list of the current user's reports.
 * Active+verified. Ownership + summary-only projection + pagination live in the
 * tested handler; this adapter only injects the real Prisma query and parses the
 * query string.
 */
const handler = createReportsListHandler({
  requireUser: requireActiveVerifiedUser,
  // The handler builds where/select/orderBy/take; Prisma's generated types are
  // stricter than the handler's structural args, so cast at this boundary only.
  queryReports: (args: ReportQueryArgs) =>
    prisma.aIReport.findMany(args as Parameters<typeof prisma.aIReport.findMany>[0])
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  return toNextResponse(
    await handler({
      query: { limit: url.searchParams.get("limit"), cursor: url.searchParams.get("cursor") }
    })
  );
}
