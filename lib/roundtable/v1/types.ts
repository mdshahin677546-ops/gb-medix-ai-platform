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

/**
 * Normalize a topic title/question so近似标题 (spacing, punctuation,
 * full-width/half-width variants) collapse to the same fingerprint.
 */
export function normalizeTopicText(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[.,!?;:'"()[\]{}<>，。！？；：“”‘’（）【】《》、~·—…-]/g, "")
    .replace(/[\s　]+/g, "")
    .trim();
}
