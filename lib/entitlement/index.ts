import { prisma } from "@/lib/prisma";

export const PRODUCT_BODY_RESET_PLAN = "body_reset_plan";
export const PRODUCT_CONSULT_PACK = "consult_pack";
export const PRODUCT_PREMIUM_REPORT = "premium_report";
export const RESOURCE_ASSESSMENT = "assessment";

type EntitlementScope = {
  userId: string;
  productId: string;
  resourceType?: string | null;
  resourceId?: string | null;
};

function scopedWhere(scope: EntitlementScope) {
  return {
    userId: scope.userId,
    productId: scope.productId,
    status: "active",
    resourceType: scope.resourceType ?? null,
    resourceId: scope.resourceId ?? null,
    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
  };
}

export async function checkEntitlement(
  scopeOrUserId: EntitlementScope | string,
  maybeProductId?: string
) {
  const scope =
    typeof scopeOrUserId === "string"
      ? { userId: scopeOrUserId, productId: maybeProductId || "" }
      : scopeOrUserId;

  if (!scope.userId || !scope.productId) return false;

  const entitlement = await prisma.entitlement.findFirst({
    where: scopedWhere(scope)
  });

  return Boolean(entitlement);
}

export const hasActiveEntitlement = checkEntitlement;

export async function grantEntitlement(params: EntitlementScope & {
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
      resourceType: params.resourceType ?? null,
      resourceId: params.resourceId ?? null,
      expiresAt: params.expiresAt ?? null
    },
    create: {
      userId: params.userId,
      productId: params.productId,
      paymentId: params.paymentId,
      resourceType: params.resourceType ?? null,
      resourceId: params.resourceId ?? null,
      status: "active",
      expiresAt: params.expiresAt ?? null
    }
  });
}

export async function revokeEntitlement(
  scopeOrUserId: (Partial<EntitlementScope> & { paymentId?: string }) | string,
  maybeProductId?: string
) {
  const scope =
    typeof scopeOrUserId === "string"
      ? { userId: scopeOrUserId, productId: maybeProductId }
      : scopeOrUserId;

  const result = await prisma.entitlement.updateMany({
    where: {
      ...(scope.paymentId ? { paymentId: scope.paymentId } : {}),
      ...(scope.userId ? { userId: scope.userId } : {}),
      ...(scope.productId ? { productId: scope.productId } : {}),
      ...(scope.resourceType !== undefined ? { resourceType: scope.resourceType } : {}),
      ...(scope.resourceId !== undefined ? { resourceId: scope.resourceId } : {}),
      status: "active"
    },
    data: { status: "revoked" }
  });

  return result.count;
}

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
    paymentId: payment.id,
    resourceType: payment.resourceType,
    resourceId: payment.resourceId
  });
}
