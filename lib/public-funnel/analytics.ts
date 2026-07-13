/**
 * Type-safe funnel analytics adapter (Roundtable UI Batch 1).
 *
 * No new external SDK is added. This is a thin, allowlisted client-side emitter:
 * only enumerated event names and a small set of SAFE, non-sensitive properties
 * (slug, category, locale, risk tier) are permitted. It NEVER captures symptom
 * free-text, medical detail, tokens, cookies, Authorization headers, account
 * identifiers, or medical query parameters. When no host analytics sink is
 * present it is a safe no-op (a dev-only debug log).
 */

export type FunnelEventName =
  | "homepage_roundtable_view"
  | "homepage_featured_roundtable_click"
  | "roundtable_search"
  | "roundtable_filter_change"
  | "roundtable_card_open"
  | "roundtable_detail_view"
  | "roundtable_claim_expand"
  | "roundtable_evidence_expand"
  | "roundtable_risk_signal_view"
  | "roundtable_to_consult_click"
  | "service_to_consult_click"
  | "roundtable_related_product_click"
  | "language_change";

/** Only these safe, non-sensitive property keys may be attached. */
export type FunnelEventProps = {
  slug?: string;
  category?: string;
  locale?: "en" | "zh";
  riskTier?: "routine" | "info" | "attention" | "urgent";
  sort?: string;
  hasQuery?: boolean; // whether a search query was present — NEVER the query text
  source?: "web";
};

const ALLOWED_KEYS: (keyof FunnelEventProps)[] = ["slug", "category", "locale", "riskTier", "sort", "hasQuery", "source"];

function sanitize(props: FunnelEventProps = {}): FunnelEventProps {
  const out: FunnelEventProps = {};
  for (const key of ALLOWED_KEYS) {
    const value = props[key];
    if (value !== undefined) (out as Record<string, unknown>)[key] = value;
  }
  return out;
}

type FunnelSink = (name: FunnelEventName, props: FunnelEventProps) => void;

function resolveSink(): FunnelSink | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { __gbFunnelSink?: FunnelSink };
  return typeof w.__gbFunnelSink === "function" ? w.__gbFunnelSink : null;
}

export function emitFunnelEvent(name: FunnelEventName, props: FunnelEventProps = {}): void {
  const safe = sanitize(props);
  const sink = resolveSink();
  if (sink) {
    try { sink(name, safe); } catch { /* analytics must never break the UI */ }
    return;
  }
  // No host sink: dev-only no-op debug. Never in production output.
  if (typeof process !== "undefined" && process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.debug("[funnel]", name, safe);
  }
}
