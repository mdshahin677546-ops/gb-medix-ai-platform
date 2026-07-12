// GB MEDIX AI Medical Roundtable — shared constants and pure helpers.
//
// This module is a database-free, provider-free foundation. Nothing in
// lib/roundtable/v1 may perform network calls, touch Prisma, or publish
// content. All external capabilities are expressed as interfaces so tests
// can exercise the real logic with test doubles.

export const MODULE_NAME_ZH = "GB MEDIX AI 医学圆桌";
export const MODULE_NAME_EN = "GB MEDIX AI Medical Roundtable";
export const MODULE_POSITIONING = "多智能体循证医学讨论平台";

/**
 * Core run mode: drafts are produced autonomously (AUTO_DRAFT) but nothing
 * can ever be published without passing the mandatory medical review gate
 * (REVIEW_REQUIRED). High-risk medical content can never bypass review.
 */
export const RUN_MODES = ["AUTO_DRAFT", "REVIEW_REQUIRED"] as const;

/** Medical review statuses. Only trusted review code may set these — AI
 * draft input can never carry a review status (see consensus.ts). */
export const MEDICAL_REVIEW_STATUSES = [
  "pending",
  "approved",
  "revision_required",
  "rejected",
  "high_risk_blocked",
] as const;

export type MedicalReviewStatus = (typeof MEDICAL_REVIEW_STATUSES)[number];

/** Content lifecycle. Only `active` content may ever be published. */
export const CONTENT_LIFECYCLE_STATUSES = ["active", "withdrawn", "superseded"] as const;

export type ContentLifecycleStatus = (typeof CONTENT_LIFECYCLE_STATUSES)[number];

/** C0 control characters, DEL and C1 control characters. */
export const CONTROL_CHARS_RE = /[\u0000-\u001f\u007f-\u009f]/;

/**
 * Characters never allowed inside identifiers: ALL whitespace (\s already
 * covers NBSP, ideographic space U+3000 and U+FEFF) plus zero-width /
 * invisible characters. Checked on the RAW string, before any trim.
 */
export const ID_UNSAFE_CHARS_RE = /[\s\u200b-\u200f\u2060\ufeff\u00ad]/;

/** Zero-width and invisible characters used for text-matching evasion. */
export const ZERO_WIDTH_RE = /[\u200b-\u200f\u2060\ufeff\u00ad]/;
const ZERO_WIDTH_RE_G = /[\u200b-\u200f\u2060\ufeff\u00ad]/g;

export function stripZeroWidth(text: string): string {
  return text.replace(ZERO_WIDTH_RE_G, "");
}

function fnv1a32(input: string, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Deterministic 64-bit (hex) fingerprint. Same input always produces the
 * same output, which is what makes daily-run idempotency keys stable across
 * retries. Not cryptographic — used only for dedupe/idempotency, never as
 * an authorization credential.
 */
export function stableFingerprint(text: string): string {
  const a = fnv1a32(text, 0x811c9dc5);
  const b = fnv1a32(text, 0x7ee36237);
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
}

// NOTE: "%" is deliberately NOT stripped — percentage-based risk patterns
// (e.g. 治愈率100%) must survive compaction.
const PUNCTUATION_RE_G =
  /[.,!?;:'"()[\]{}<>，。！？；：“”‘’（）【】《》、~·—…‐-―\-_/\\|*#^&+=`@$]/g;

/**
 * Normalize a topic title/question so近似标题 (spacing, punctuation,
 * full-width/half-width variants, zero-width characters, Unicode
 * composition forms) collapse to the same fingerprint. A caller-provided
 * duplicateFingerprint must match the recomputation of this normalization
 * — it can never be used to bypass dedupe (see topic-policy.ts).
 */
export function normalizeTopicText(text: string): string {
  return stripZeroWidth(text.normalize("NFKC"))
    .toLowerCase()
    .replace(PUNCTUATION_RE_G, "")
    .replace(/[\s　]+/g, "")
    .trim();
}

export interface MatchableText {
  /** NFKC, zero-width stripped, lowercased, whitespace collapsed to single spaces. */
  normalized: string;
  /** `normalized` with ALL whitespace and common punctuation removed —
   * defeats "我 是 不 是"-style spacing/punctuation evasion. */
  compact: string;
}

/**
 * Unified normalization for risk/privacy text matching (P1-004). This is a
 * RULE-LEVEL defense only, not a production-grade PHI or medical-safety
 * classifier.
 */
export function normalizeForMatching(text: string): MatchableText {
  const normalized = stripZeroWidth(text.normalize("NFKC"))
    .toLowerCase()
    .replace(/[\s　]+/g, " ")
    .trim();
  const compact = normalized.replace(PUNCTUATION_RE_G, "").replace(/\s+/g, "");
  return { normalized, compact };
}

/**
 * True only for a real proleptic-Gregorian calendar date in YYYY-MM-DD form,
 * within the supported range 0001-01-01 .. 9999-12-31 (year 0000 rejected).
 * Pure arithmetic — no Date object, no local-timezone conversion.
 */
export function isValidCalendarDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (year < 1) return false;
  if (month < 1 || month > 12 || day < 1) return false;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonth[month - 1];
}

/** ISO-8601 timestamp with a real calendar date part and in-range time. */
export function isValidIsoDateTime(value: string): boolean {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!m) return false;
  if (!isValidCalendarDate(m[1])) return false;
  return Number(m[2]) < 24 && Number(m[3]) < 60 && Number(m[4]) < 60;
}
