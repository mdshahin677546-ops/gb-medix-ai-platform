// Backward-compatible re-export. The entitlement logic now lives in
// `lib/entitlement`. Existing imports from `@/lib/entitlements` keep working.
export {
  PRODUCT_BODY_RESET_PLAN,
  PRODUCT_CONSULT_PACK,
  checkEntitlement,
  hasActiveEntitlement,
  grantEntitlement,
  revokeEntitlement,
  grantEntitlementForPayment
} from "@/lib/entitlement";
