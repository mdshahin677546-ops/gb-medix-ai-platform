import type { Lang } from "@/lib/lang";
import type { FunnelCopy } from "./i18n";

/**
 * Safe roundtable → consultation context transfer (Batch 1.1).
 *
 * Only a small ALLOWLIST of non-sensitive, non-individualized context keys may be
 * carried from the public medical-roundtable pages to the consultation entry. This
 * module is the single authority for that allowlist. It NEVER forwards patient
 * privacy, symptom free-text, medical records, email, phone, tokens, cookies, or
 * Authorization data — such keys are dropped simply because they are not on the
 * allowlist. The context is always marked as non-individualized education.
 */

export const CONSULT_CONTEXT_ALLOWLIST = ["source", "topic", "context"] as const;
export type ConsultContextKey = (typeof CONSULT_CONTEXT_ALLOWLIST)[number];

/** The only permitted context value: a non-individualized, non-diagnostic educational marker. */
export const CONSULT_CONTEXT_MARKER = "education";

const SOURCE_RE = /^[a-z0-9_-]{1,40}$/;
const TOPIC_RE = /^[a-z0-9_-]{1,64}$/;

export type ConsultContextInput = Record<string, unknown>;

/**
 * Keep only allowlisted, well-formed, non-sensitive values; drop everything else.
 * `context` may ONLY ever be the educational marker.
 */
export function sanitizeConsultParams(input: ConsultContextInput = {}): Partial<Record<ConsultContextKey, string>> {
  const out: Partial<Record<ConsultContextKey, string>> = {};
  if (typeof input.source === "string" && SOURCE_RE.test(input.source)) out.source = input.source;
  if (typeof input.topic === "string" && TOPIC_RE.test(input.topic)) out.topic = input.topic;
  if (input.context === CONSULT_CONTEXT_MARKER) out.context = CONSULT_CONTEXT_MARKER;
  return out;
}

/**
 * Build a consultation-entry URL carrying only safe, sanitized context. The
 * educational marker is always enforced last so hostile input cannot remove it.
 */
export function buildConsultHref(lang: Lang, params: ConsultContextInput = {}): string {
  const safe = sanitizeConsultParams({ ...params, context: CONSULT_CONTEXT_MARKER });
  const qs = new URLSearchParams(safe as Record<string, string>).toString();
  return `/${lang}/consult${qs ? `?${qs}` : ""}`;
}

/** Consultation-specific page metadata (distinct from roundtable/shop/generic copy). */
export function consultMetadata(copy: FunnelCopy): { title: string; description: string } {
  return {
    title: `${copy.consult.metaTitle} · GB Medix AI`,
    description: copy.consult.metaDescription
  };
}
