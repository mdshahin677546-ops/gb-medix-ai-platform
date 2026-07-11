/**
 * Product recommendation boundary (pure types; no database query in this batch).
 * A model must never invent SKU, price, stock, efficacy, or clinical claims. A
 * candidate carrying any such forbidden field is an EXPLICIT invalid_input — it
 * is NOT silently stripped into a noRecommendation. `noRecommendation` means
 * only: no candidates, no verified real productId, or genuinely no suitable
 * product.
 * Planning: AI_AGENT_CONSULTATION_PLAN.md §Product Recommendation.
 */

export type AgentProductRecommendation = {
  productId: string;
  category: string;
  reason: string;
};

export type AgentProductResult =
  | { kind: "recommendations"; items: AgentProductRecommendation[] }
  | { kind: "noRecommendation" }
  | { kind: "invalid_input"; offendingFields: string[] };

/** Fields a model must NEVER fabricate for a product. Their presence is invalid. */
export const FORBIDDEN_PRODUCT_FIELDS = [
  "price",
  "inventory",
  "stock",
  "sku",
  "efficacy",
  "treatmentClaim",
  "diseaseClaim",
  "guaranteedOutcome",
  "cures"
] as const;

const FORBIDDEN_SET: ReadonlySet<string> = new Set(
  FORBIDDEN_PRODUCT_FIELDS.map((f) => f.toLowerCase())
);

export function findForbiddenProductFields(obj: Record<string, unknown>): string[] {
  return Object.keys(obj).filter((k) => FORBIDDEN_SET.has(k.toLowerCase()));
}

/**
 * Build a product result from server-provided real products only.
 * - If ANY candidate carries a forbidden field -> invalid_input (explicit fail).
 * - Else keep only candidates with a real (server-verified) productId + reason.
 * - If none remain -> noRecommendation.
 */
export function buildProductResult(input: {
  candidates: Array<Record<string, unknown>>;
  realProductIds: ReadonlySet<string>;
}): AgentProductResult {
  const offending = new Set<string>();
  for (const c of input.candidates) {
    for (const f of findForbiddenProductFields(c)) offending.add(f);
  }
  if (offending.size > 0) {
    return { kind: "invalid_input", offendingFields: [...offending] };
  }

  const items: AgentProductRecommendation[] = [];
  for (const c of input.candidates) {
    const productId = typeof c.productId === "string" ? c.productId : "";
    if (!productId || !input.realProductIds.has(productId)) continue;
    const reason = typeof c.reason === "string" ? c.reason : "";
    if (!reason) continue;
    const category = typeof c.category === "string" ? c.category : "general";
    items.push({ productId, category, reason });
  }
  return items.length > 0 ? { kind: "recommendations", items } : { kind: "noRecommendation" };
}
