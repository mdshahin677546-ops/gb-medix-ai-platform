// Security audit events with a strict safeMetadata allowlist.
//
// Never logged: prompt text, chain-of-thought, patient health text, email
// addresses, plaintext user ids, cookies, tokens, API keys, provider
// request/response bodies, or real case identity data. Metadata keys outside
// the allowlist and values that look like secrets/PII are rejected loudly.

import { z } from "zod";

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

// Values that look like secrets, connection strings or email addresses are
// rejected even under allowlisted keys. (These literals exist ONLY to forbid
// such content from ever being logged.)
const FORBIDDEN_VALUE_PATTERNS: RegExp[] = [
  /sk-[A-Za-z0-9]/,
  /Bearer\s+ey/,
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
  /postgres(ql)?:\/\//i,
  /(api[_-]?key|secret|password|cookie|token)\s*[=:]/i,
];

const MetadataValueSchema = z.union([z.string().max(300), z.number().finite(), z.boolean()]);

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
  for (const [key, value] of Object.entries(metadata)) {
    if (!(SAFE_METADATA_KEYS as readonly string[]).includes(key)) {
      throw new Error(`Audit metadata key is not allowlisted: ${key}`);
    }
    if (typeof value === "string") {
      for (const pattern of FORBIDDEN_VALUE_PATTERNS) {
        if (pattern.test(value)) {
          throw new Error(`Audit metadata value for ${key} matches a forbidden sensitive pattern`);
        }
      }
    }
  }
  const sequence = input.sequence ?? 0;
  if (!Number.isInteger(sequence) || sequence < 0) {
    throw new Error(`Invalid audit event sequence: ${String(input.sequence)}`);
  }
  return AuditEventSchema.parse({
    eventId: `${input.operationId}:${input.eventType}:${sequence}`,
    operationId: input.operationId,
    eventType: input.eventType,
    timestamp: input.timestamp,
    safeMetadata: metadata,
  });
}
