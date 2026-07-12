// Security audit events with a strict safeMetadata allowlist.
//
// Policy (P1-003): audit metadata may only carry restricted enum-like
// strings, short ids, finite numbers and booleans. Free-form medical text,
// objects, arrays and stringified JSON are rejected. Never logged: prompt
// text, chain-of-thought, patient health text, names, email addresses,
// phone numbers, MRNs, plaintext user ids, cookies, tokens, API keys,
// provider request/response bodies, or real case identity data. Violations
// throw loudly — nothing is silently redacted.

import { z } from "zod";
import { CONTROL_CHARS_RE, ZERO_WIDTH_RE, stableFingerprint } from "./types";

export const AUDIT_EVENT_TYPES = [
  "run_scheduled",
  "topic_selected",
  "topic_blocked",
  "agents_invited",
  "agent_started",
  "agent_completed",
  "agent_failed",
  "cross_examination_completed",
  "evidence_added",
  "evidence_verified",
  "evidence_rejected",
  "consensus_drafted",
  "translation_drafted",
  "medical_review_requested",
  "medical_review_approved",
  "medical_review_rejected",
  "publication_planned",
  "published",
  "revision_triggered",
  "superseded",
  "budget_exceeded",
] as const;

export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

export const SAFE_METADATA_KEYS = [
  "runDate",
  "topicFingerprint",
  "topicId",
  "category",
  "state",
  "fromState",
  "toState",
  "agentRole",
  "evidenceId",
  "claimId",
  "version",
  "language",
  "blockReason",
  "errorType",
  "retryAttempt",
  "budgetDimension",
  "reviewStatus",
  "reason",
  "count",
  "triggerReason",
  "publicationIdempotencyKey",
  "auditReference",
] as const;

// Sensitive key stems: even if a key were ever added to the allowlist, a
// normalized key matching one of these is still rejected (defense in depth).
const FORBIDDEN_KEY_STEMS = [
  "patientname",
  "firstname",
  "lastname",
  "email",
  "phone",
  "mobile",
  "mrn",
  "medicalrecord",
  "prompt",
  "fullprompt",
  "healthtext",
  "symptom",
  "diagnosis",
  "accesstoken",
  "refreshtoken",
  "token",
  "secret",
  "apikey",
  "cookie",
  "authorization",
];
const FORBIDDEN_KEY_EXACT = ["name", "病历号", "病历", "病案号"];

export const AUDIT_METADATA_VALUE_MAX_LENGTH = 128;
export const AUDIT_METADATA_VALUE_MAX_TOKENS = 5;

// These allowlisted keys legitimately carry long hex/composed identifiers,
// so the "long digit run" phone/MRN heuristic is skipped for them (a hex
// fingerprint can rarely be all-decimal). All other value checks still run.
const DIGIT_RUN_EXEMPT_KEYS = new Set(["topicFingerprint", "publicationIdempotencyKey", "auditReference"]);

// Values that look like secrets, tokens, PII or connection strings are
// rejected even under allowlisted keys. (These literals exist ONLY to
// forbid such content from ever being logged.)
const FORBIDDEN_VALUE_PATTERNS: RegExp[] = [
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, // email (post-NFKC)
  /\(at\)|＠/i, // obfuscated @ (after NFKC ＠ folds to @, kept as belt & braces)
  /Bearer\s+/i,
  /\bey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{4,}\./, // JWT shape
  /sk-[A-Za-z0-9]/,
  /(api[_-]?key|secret|passwd|password|cookie|authorization)/i,
  /(access|refresh|session|auth)[_-]?token/i, // accessToken / refresh_token / … (case folded)
  /token\s*[=:]/i, // token assignment in any form
  /%(25)*(40|3d|20|5f|2d)/i, // percent-encoded @ = space _ - markers at any nesting depth
  /[?&](token|key|secret|password|auth|session|sig)=/i, // sensitive URL query params
  /postgres(ql)?:\/\//i,
  /(mrn|medical\s*record|病历号|病案号|病历编号)/i,
  /(patient\s*name|患者姓名|病人姓名)/i,
  /\b(prompt|diagnosis|symptom)\b/i,
  /(症状|主诉|病史|诊断|处方|用药记录)/, // zh medical free-text markers
  /\d{3,}[-\s.]\d{3,}[-\s.]\d{3,}/, // grouped phone-like digits
];

// CJK has no word spacing, so the token heuristic cannot catch zh
// free-form text — long consecutive CJK runs are rejected instead.
const CJK_RUN_RE = /[一-鿿]{12,}/;

const JSON_LIKE_RE = /^\s*[[{]|["'][a-zA-Z0-9_]+["']\s*:/;

/** Maximum bounded percent-decode depth for metadata scanning. */
export const AUDIT_MAX_DECODE_DEPTH = 5;

/**
 * Bounded LOOP percent-decoding for scanning (RR-P1-003): starting from the
 * raw value, decodeURIComponent is applied repeatedly — every layer is
 * returned for a full sensitive-content scan — until the value contains no
 * "%", a decode pass is a no-op, or AUDIT_MAX_DECODE_DEPTH layers were
 * produced. Fail closed on every abnormal path: invalid or truncated
 * percent-encoding at ANY layer throws, and a value that still carries
 * percent-encoding after the maximum depth throws instead of passing
 * through unscanned. The 128-char cap on the original value bounds every
 * layer (decoding never grows a string), so the loop always terminates.
 */
function collectScanVariants(key: string, value: string): string[] {
  const variants = [value];
  let current = value;
  for (let depth = 0; depth < AUDIT_MAX_DECODE_DEPTH; depth++) {
    if (!current.includes("%")) {
      return variants;
    }
    let decoded: string;
    try {
      decoded = decodeURIComponent(current);
    } catch {
      throw new Error(`Audit metadata value for ${key} contains invalid percent-encoding`);
    }
    if (decoded === current) {
      return variants;
    }
    variants.push(decoded);
    current = decoded;
  }
  if (current.includes("%")) {
    throw new Error(
      `Audit metadata value for ${key} still contains percent-encoding after ${AUDIT_MAX_DECODE_DEPTH} decode layers`
    );
  }
  return variants;
}

function checkStringVariant(key: string, variant: string): void {
  if (ZERO_WIDTH_RE.test(variant)) {
    throw new Error(`Audit metadata value for ${key} contains zero-width characters`);
  }
  const normalized = variant.normalize("NFKC").trim();
  if (CONTROL_CHARS_RE.test(normalized)) {
    throw new Error(`Audit metadata value for ${key} contains control characters`);
  }
  if (normalized.split(/\s+/).length > AUDIT_METADATA_VALUE_MAX_TOKENS) {
    throw new Error(`Audit metadata value for ${key} looks like free-form text (too many words)`);
  }
  if (CJK_RUN_RE.test(normalized)) {
    throw new Error(`Audit metadata value for ${key} looks like free-form CJK text`);
  }
  if (JSON_LIKE_RE.test(normalized)) {
    throw new Error(`Audit metadata value for ${key} looks like stringified JSON`);
  }
  for (const pattern of FORBIDDEN_VALUE_PATTERNS) {
    if (pattern.test(normalized)) {
      throw new Error(`Audit metadata value for ${key} matches a forbidden sensitive pattern`);
    }
  }
  // Contiguous 8+ digit runs look like phones/MRNs/ids. Dates like
  // 2026-07-11 stay legal (separators break the run); grouped phone digits
  // are caught by the grouped pattern above.
  if (!DIGIT_RUN_EXEMPT_KEYS.has(key) && /\d{8,}/.test(normalized)) {
    throw new Error(`Audit metadata value for ${key} contains a long digit run (possible phone/MRN/id)`);
  }
}

function assertSafeMetadataString(key: string, value: string): string {
  const normalized = value.normalize("NFKC").trim();
  if (normalized.length === 0) {
    throw new Error(`Audit metadata value for ${key} is empty after trim`);
  }
  if (normalized.length > AUDIT_METADATA_VALUE_MAX_LENGTH) {
    throw new Error(`Audit metadata value for ${key} exceeds ${AUDIT_METADATA_VALUE_MAX_LENGTH} characters`);
  }
  // Every check runs on the raw value AND its percent-decoded variants —
  // encoding is never a way around the scan.
  for (const variant of collectScanVariants(key, value)) {
    checkStringVariant(key, variant);
  }
  return normalized;
}

function normalizeKeyForPolicy(key: string): string {
  return key.normalize("NFKC").toLowerCase().replace(/[^a-z0-9一-鿿]/g, "");
}

const MetadataValueSchema = z.union([
  z.string().max(AUDIT_METADATA_VALUE_MAX_LENGTH),
  z.number().finite(),
  z.boolean(),
]);

export const AuditEventSchema = z
  .object({
    eventId: z.string().min(1),
    operationId: z.string().min(1),
    eventType: z.enum(AUDIT_EVENT_TYPES),
    timestamp: z.string().min(1),
    safeMetadata: z.record(MetadataValueSchema),
  })
  .strict();

export type AuditEvent = z.infer<typeof AuditEventSchema>;

export interface CreateAuditEventInput {
  operationId: string;
  eventType: AuditEventType;
  /** Caller-supplied ISO timestamp — keeps event creation deterministic. */
  timestamp: string;
  safeMetadata?: Record<string, string | number | boolean>;
  /** Sequence number for deterministic, idempotent event ids. */
  sequence?: number;
}

export function createAuditEvent(input: CreateAuditEventInput): AuditEvent {
  if (!(AUDIT_EVENT_TYPES as readonly string[]).includes(input.eventType)) {
    throw new Error(`Unknown audit event type: ${String(input.eventType)}`);
  }
  const metadata = input.safeMetadata ?? {};
  const sanitized: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!(SAFE_METADATA_KEYS as readonly string[]).includes(key)) {
      throw new Error(`Audit metadata key is not allowlisted: ${key}`);
    }
    const policyKey = normalizeKeyForPolicy(key);
    if (
      FORBIDDEN_KEY_EXACT.includes(policyKey) ||
      FORBIDDEN_KEY_STEMS.some((stem) => policyKey.includes(stem))
    ) {
      throw new Error(`Audit metadata key is forbidden: ${key}`);
    }
    if (typeof value === "string") {
      sanitized[key] = assertSafeMetadataString(key, value);
    } else if (typeof value === "number") {
      if (Number.isNaN(value) || !Number.isFinite(value)) {
        throw new Error(`Audit metadata value for ${key} must be a finite number`);
      }
      sanitized[key] = value;
    } else if (typeof value === "boolean") {
      sanitized[key] = value;
    } else {
      // objects, arrays, null, undefined, functions, symbols, bigint
      throw new Error(`Audit metadata value for ${key} must be a string, finite number or boolean`);
    }
  }
  const sequence = input.sequence ?? 0;
  if (!Number.isInteger(sequence) || sequence < 0) {
    throw new Error(`Invalid audit event sequence: ${String(input.sequence)}`);
  }
  // Deterministic id bound to the logical event AND a stable digest of the
  // key-sorted metadata: same event + same metadata => same eventId, key
  // order never matters, different metadata => different eventId. The digest
  // never embeds raw values and the eventId is not an auth credential.
  const canonical = JSON.stringify(
    Object.keys(sanitized)
      .sort()
      .map((k) => [k, sanitized[k]])
  );
  const digest = stableFingerprint(canonical);
  return AuditEventSchema.parse({
    eventId: `${input.operationId}:${input.eventType}:${sequence}:${digest}`,
    operationId: input.operationId,
    eventType: input.eventType,
    timestamp: input.timestamp,
    safeMetadata: sanitized,
  });
}
