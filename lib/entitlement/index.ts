import { prisma } from "@/lib/prisma";

export const PRODUCT_BODY_RESET_PLAN = "body_reset_plan";
export const PRODUCT_CONSULT_PACK = "consult_pack";

/**
 * Whether the user currently holds an active, unexpired entitlement for a product.
 */
export async function checkEntitlement(userId: string, productId: string) {
  const now = new Date();
  const entitlement = await prisma.entitlement.findFirst({
    where: {
      userId,
      productId,
      status: "active",
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
    }
  });

  return Boolean(entitlement);
}

/**
 * Backward-compatible alias for {@link checkEntitlement}.
 */
export const hasActiveEntitlement = checkEntitlement;

/**
 * Grant an entitlement tied to a specific payment. The Entitlement model requires
 * a paymentId, so manual (payment-less) grants are intentionally not supported
 * here; that would need a schema change and is out of scope for this refactor.
 */
export async function grantEntitlement(params: {
  userId: string;
  productId: string;
  paymentId: string;
  expiresAt?: Date | null;
}) {
  return prisma.entitlement.upsert({
    where: {
      paymentId_productId: {
        paymentId: params.paymentId,
        productId: params.productId
      }
    },
    update: {
      status: "active",
      expiresAt: params.expiresAt ?? null
    },
    create: {
      userId: params.userId,
      productId: params.productId,
      paymentId: params.paymentId,
      status: "active",
      expiresAt: params.expiresAt ?? null
    }
  });
}

/**
 * Revoke all active entitlements a user holds for a product (e.g. refund/chargeback).
 */
export async function revokeEntitlement(userId: string, productId: string) {
  const result = await prisma.entitlement.updateMany({
    where: { userId, productId, status: "active" },
    data: { status: "revoked" }
  });

  return result.count;
}

/**
 * Grant the entitlement implied by a paid payment record. No-op unless the
 * payment exists, is attached to a user, and is marked paid.
 */
export async function grantEntitlementForPayment(paymentId: string) {
  const payment = await prisma.paymentRecord.findUnique({
    where: { id: paymentId }
  });

  if (!payment?.userId || payment.status !== "paid") {
    return null;
  }

  return grantEntitlement({
    userId: payment.userId,
    productId: payment.product,
    paymentId: payment.id
  });
}
