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
 * Thrown when a DB entitlement status is not modeled by the shared contract.
 * The mapper NEVER guesses a status (in particular never invents "active" or a
 * silent "expired"); the caller collapses this to a safe INTERNAL_ERROR.
 */
export class UnmappedEntitlementStatusError extends Error {
  constructor() {
    super("Entitlement status is not representable in the shared contract.");
    this.name = "UnmappedEntitlementStatusError";
  }
}

/**
 * Map the DB status string to the shared enum via an explicit, exhaustive check.
 * An unmodeled status fails loudly (caller -> INTERNAL_ERROR) rather than being
 * fabricated — it must never read as "active" or be silently downgraded.
 */
function toEntitlementStatus(raw: string): EntitlementStatus {
  const parsed = entitlementStatusSchema.safeParse(raw);
  if (!parsed.success) throw new UnmappedEntitlementStatusError();
  return parsed.data;
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
