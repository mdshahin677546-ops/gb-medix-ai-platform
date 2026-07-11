import {
  entitlementSchema,
  entitlementStatusSchema,
  type Entitlement,
  type EntitlementStatus
} from "../../api-contract/v1/entitlement";

/**
 * Map an Entitlement row to the safe entitlement DTO.
 *
 * Payment facts are never entitlement facts: paymentId, Stripe session /
 * payment-intent ids, userId, and internal audit fields are dropped. `source`
 * is a PLANNED contract enum with no DB column yet, so it is intentionally NOT
 * emitted (never fabricated). Output is validated by the real shared schema.
 */
export type EntitlementInput = {
  id: string;
  productId: string;
  resourceType: string | null;
  resourceId: string | null;
  status: string;
  expiresAt: Date | string | null;
};

/**
 * Map the free-form DB status string to the shared enum. A status the contract
 * does not model is surfaced as a conservative, non-unlocking "expired" rather
 * than being invented — it must never read as "active".
 */
function toEntitlementStatus(raw: string): EntitlementStatus {
  const parsed = entitlementStatusSchema.safeParse(raw);
  return parsed.success ? parsed.data : "expired";
}

function toIso(value: Date | string | null): string | null {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : value;
}

export function toEntitlementDTO(row: EntitlementInput): Entitlement {
  return entitlementSchema.parse({
    id: row.id,
    productCode: row.productId,
    resourceType: row.resourceType ?? null,
    resourceId: row.resourceId ?? null,
    status: toEntitlementStatus(row.status),
    expiresAt: toIso(row.expiresAt)
  });
}
