import { newRequestId } from "../request-context";
import { success, failure, internalFailure } from "../failure";
import { finalize, type HandlerResult } from "../handler-result";
import type { Guard } from "../guards";
import { parsePagination, encodeCursor } from "../pagination";
import { toEntitlementDTO, type EntitlementInput } from "../mappers/entitlement";

/** Safe projection — never selects paymentId / Stripe ids / audit fields. */
export const ENTITLEMENT_SELECT = {
  id: true,
  productId: true,
  resourceType: true,
  resourceId: true,
  status: true,
  expiresAt: true,
  createdAt: true
} as const;

export type EntitlementRow = EntitlementInput & { createdAt: Date | string };

export type EntitlementQueryArgs = {
  where: Record<string, unknown>;
  orderBy: unknown;
  take: number;
  select: typeof ENTITLEMENT_SELECT;
};

export type EntitlementsHandlerDeps = {
  requireUser: Guard;
  queryEntitlements: (args: EntitlementQueryArgs) => Promise<EntitlementRow[]>;
};

export type EntitlementsInput = { query: { limit?: string | null; cursor?: string | null } };

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

/**
 * GET /api/v1/entitlements handler factory. Active+verified guard. Ownership is
 * enforced by scoping to the authenticated userId; the result is paginated
 * (bounded page size) so history can never be dumped in one unbounded response.
 * An unmodeled DB status makes toEntitlementDTO throw -> safe INTERNAL_ERROR
 * (never fabricated / never "active").
 */
export function createEntitlementsHandler(deps: EntitlementsHandlerDeps) {
  return async function GET(input: EntitlementsInput): Promise<HandlerResult> {
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

      const rows = await deps.queryEntitlements({
        where: { userId: auth.user.id, ...cursorFilter },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: page.limit + 1,
        select: ENTITLEMENT_SELECT
      });

      const hasMore = rows.length > page.limit;
      const pageRows = hasMore ? rows.slice(0, page.limit) : rows;
      const entitlements = pageRows.map(toEntitlementDTO);
      const last = pageRows[pageRows.length - 1];
      const nextCursor =
        hasMore && last ? encodeCursor({ createdAt: toIso(last.createdAt), id: last.id }) : null;

      return finalize(requestId, success({ entitlements, nextCursor }, requestId));
    } catch {
      return finalize(requestId, internalFailure(requestId));
    }
  };
}
