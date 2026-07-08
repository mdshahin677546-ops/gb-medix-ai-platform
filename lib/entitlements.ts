import { prisma } from "@/lib/prisma";

export const PRODUCT_BODY_RESET_PLAN = "body_reset_plan";
export const PRODUCT_CONSULT_PACK = "consult_pack";

export async function hasActiveEntitlement(userId: string, productId: string) {
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

export async function grantEntitlementForPayment(paymentId: string) {
  const payment = await prisma.paymentRecord.findUnique({
    where: { id: paymentId }
  });

  if (!payment?.userId || payment.status !== "paid") {
    return null;
  }

  return prisma.entitlement.upsert({
    where: {
      paymentId_productId: {
        paymentId: payment.id,
        productId: payment.product
      }
    },
    update: {
      status: "active"
    },
    create: {
      userId: payment.userId,
      productId: payment.product,
      paymentId: payment.id,
      status: "active"
    }
  });
}

