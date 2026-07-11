/**
 * Product recommendation boundary (pure types; no database query in this batch).
 * A model must never invent SKU, price, stock, or efficacy. When no real product
 * fits, the result is an explicit noRecommendation.
 * Planning: AI_AGENT_CONSULTATION_PLAN.md §Product Recommendation.
 */

/** A recommendation MUST reference a real productId supplied by the server. */
export type AgentProductRecommendation = {
  productId: string;
  category: string;
  reason: string;
};

export type AgentProductResult =
  | { kind: "recommendations"; items: AgentProductRecommendation[] }
  | { kind: "noRecommendation" };

/** Fields a model must NEVER fabricate for a product. */
export const FORBIDDEN_PRODUCT_FIELDS = ["sku", "price", "stock", "efficacy", "cures"] as const;

/**
 * Build a product result from server-provided real products only. If no real
 * product ids are provided, returns noRecommendation. Any item missing a real
 * productId, or carrying a fabricated/forbidden field, is dropped.
 */
export function buildProductResult(input: {
  candidates: Array<Record<string, unknown>>;
  realProductIds: ReadonlySet<string>;
}): AgentProductResult {
  const forbidden = new Set(FORBIDDEN_PRODUCT_FIELDS.map((f) => f.toLowerCase()));
  const items: AgentProductRecommendation[] = [];
  for (const c of input.candidates) {
    const productId = typeof c.productId === "string" ? c.productId : "";
    if (!productId || !input.realProductIds.has(productId)) continue;
    if (Object.keys(c).some((k) => forbidden.has(k.toLowerCase()))) continue;
    const category = typeof c.category === "string" ? c.category : "general";
    const reason = typeof c.reason === "string" ? c.reason : "";
    if (!reason) continue;
    items.push({ productId, category, reason });
  }
  return items.length > 0 ? { kind: "recommendations", items } : { kind: "noRecommendation" };
}
