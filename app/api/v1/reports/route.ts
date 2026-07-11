import { prisma } from "@/lib/prisma";
import {
  newRequestId,
  internalFailure,
  success,
  parsePagination,
  encodeCursor,
  toReportSummaryDTO
} from "@/lib/api-v1";
import { failure } from "@/lib/api-v1/failure";
import { requireApiUser } from "@/lib/api-v1/session";
import { respond } from "@/lib/api-v1/http";

// This API version models free/premium health reports only.
const SERVICEABLE_TYPES = ["free_health_report", "premium_health_report"];

/**
 * GET /api/v1/reports — summary list of the current user's reports.
 * Ownership is enforced by scoping the query to the authenticated userId; a
 * client cannot override it. Summary-only (no analysis / recommendations /
 * prompts / assessment answers). Keyset pagination over (createdAt DESC, id DESC).
 */
export async function GET(request: Request) {
  const requestId = newRequestId();
  try {
    const auth = await requireApiUser(requestId);
    if (!auth.ok) return respond(requestId, auth.failure);

    const url = new URL(request.url);
    const page = parsePagination({
      limit: url.searchParams.get("limit"),
      cursor: url.searchParams.get("cursor")
    });
    if (!page.ok) return respond(requestId, failure("VALIDATION_ERROR", requestId));

    const cursorFilter = page.cursor
      ? {
          OR: [
            { createdAt: { lt: new Date(page.cursor.createdAt) } },
            { createdAt: new Date(page.cursor.createdAt), id: { lt: page.cursor.id } }
          ]
        }
      : {};

    const rows = await prisma.aIReport.findMany({
      where: {
        userId: auth.user.id,
        type: { in: SERVICEABLE_TYPES },
        ...cursorFilter
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: page.limit + 1,
      select: {
        id: true,
        type: true,
        status: true,
        score: true,
        summary: true,
        createdAt: true
      }
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
        ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
        : null;

    return respond(requestId, success({ items, nextCursor }, requestId));
  } catch {
    return respond(requestId, internalFailure(requestId));
  }
}
