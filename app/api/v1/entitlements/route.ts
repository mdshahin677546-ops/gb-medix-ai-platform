import { prisma } from "@/lib/prisma";
import { createEntitlementsHandler, type EntitlementQueryArgs } from "@/lib/api-v1";
import { requireActiveVerifiedUser } from "@/lib/api-v1/session";
import { toNextResponse } from "@/lib/api-v1/http";

/**
 * GET /api/v1/entitlements — paginated, user-scoped entitlement summary.
 * Active+verified. Ownership scope, safe projection, and pagination live in the
 * tested handler; this adapter injects the real Prisma query.
 */
const handler = createEntitlementsHandler({
  requireUser: requireActiveVerifiedUser,
  queryEntitlements: (args: EntitlementQueryArgs) =>
    prisma.entitlement.findMany(args as Parameters<typeof prisma.entitlement.findMany>[0])
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  return toNextResponse(
    await handler({
      query: { limit: url.searchParams.get("limit"), cursor: url.searchParams.get("cursor") }
    })
  );
}
