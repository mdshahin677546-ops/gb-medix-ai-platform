import { prisma } from "@/lib/prisma";
import {
  newRequestId,
  internalFailure,
  success,
  toEntitlementDTO
} from "@/lib/api-v1";
import { requireApiUser } from "@/lib/api-v1/session";
import { respond } from "@/lib/api-v1/http";

/**
 * GET /api/v1/entitlements — safe entitlement summary for the current user.
 * Read-only. Scoped to the authenticated user; a client cannot request another
 * user's entitlements. Payment / Stripe ids and internal audit fields are never
 * emitted (see toEntitlementDTO).
 */
export async function GET() {
  const requestId = newRequestId();
  try {
    const auth = await requireApiUser(requestId);
    if (!auth.ok) return respond(requestId, auth.failure);

    const rows = await prisma.entitlement.findMany({
      where: { userId: auth.user.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        productId: true,
        resourceType: true,
        resourceId: true,
        status: true,
        expiresAt: true
      }
    });

    const entitlements = rows.map(toEntitlementDTO);
    return respond(requestId, success({ entitlements }, requestId));
  } catch {
    return respond(requestId, internalFailure(requestId));
  }
}
