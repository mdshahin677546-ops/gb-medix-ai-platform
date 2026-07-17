// BETA-0A — Immutable admin audit append helper.
//
// Rows are INSERTed by trusted server code only; a database trigger (see the
// BETA-0A migration) rejects every UPDATE and DELETE, so this module intentionally
// exposes NO update/delete helper. Metadata is server-built and defensively
// sanitized: no secrets, tokens, cookies, Authorization, connection strings, full
// IPs, emails, health free-text, patient, or payment data may ever be stored.

// Fixed, enumerated admin actions — never free text from a client.
export const ADMIN_AUDIT_ACTIONS = {
  AI_USAGE_READ: "ADMIN_AI_USAGE_READ"
} as const;
export type AdminAuditAction =
  (typeof ADMIN_AUDIT_ACTIONS)[keyof typeof ADMIN_AUDIT_ACTIONS];

// Key fragments that must never appear in audit metadata (defense in depth even
// though the server, not the client, constructs metadata). Keys are canonicalized
// before matching so variants such as access_token, access-token, or
// authorization\r cannot hide sensitive fields behind separators/casing.
const FORBIDDEN_METADATA_KEY_FRAGMENTS = [
  "password",
  "token",
  "accesstoken",
  "refreshtoken",
  "cookie",
  "authorization",
  "secret",
  "apikey",
  "api_key",
  "connectionstring",
  "databaseurl",
  "database_url",
  "ip",
  "ipaddress",
  "email",
  "health",
  "healthdata",
  "medical",
  "diagnosis",
  "symptom",
  "prompt",
  "response",
  "note",
  "notes",
  "mrn",
  "phone",
  "contact",
  "patient",
  "payment",
  "paymentinfo",
  "card"
];

const FORBIDDEN_METADATA_EXACT_KEYS = new Set([
  "__proto__",
  "constructor",
  "prototype"
]);

const MAX_METADATA_BYTES = 2048;

export class AdminAuditValidationError extends Error {}

function canonicalizeMetadataKey(key: string): string {
  if (!key || /[\x00-\x1f\x7f]/.test(key)) {
    throw new AdminAuditValidationError("metadata contains a forbidden key");
  }
  const exactKey = key.trim().toLowerCase();
  if (FORBIDDEN_METADATA_EXACT_KEYS.has(exactKey)) {
    throw new AdminAuditValidationError("metadata contains a forbidden key");
  }
  const canonical = exactKey.replace(/[^a-z0-9]/g, "");
  if (!canonical) {
    throw new AdminAuditValidationError("metadata contains a forbidden key");
  }
  return canonical;
}

// Returns safe metadata (a shallow, primitive-only object) or throws
// AdminAuditValidationError. Rejects forbidden keys, nested objects/arrays, and
// oversized payloads rather than silently storing sensitive or unbounded data.
export function sanitizeAuditMetadata(
  metadata: unknown
): Record<string, string | number | boolean> | undefined {
  if (metadata === undefined || metadata === null) return undefined;
  if (
    typeof metadata !== "object" ||
    Array.isArray(metadata) ||
    (Object.getPrototypeOf(metadata) !== Object.prototype &&
      Object.getPrototypeOf(metadata) !== null)
  ) {
    throw new AdminAuditValidationError("metadata must be a plain object");
  }
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(metadata as Record<string, unknown>)) {
    const canonicalKey = canonicalizeMetadataKey(key);
    if (FORBIDDEN_METADATA_KEY_FRAGMENTS.some((part) => canonicalKey.includes(part))) {
      throw new AdminAuditValidationError("metadata contains a forbidden key");
    }
    if (value === null) continue;
    const t = typeof value;
    if (t !== "string" && t !== "number" && t !== "boolean") {
      throw new AdminAuditValidationError("metadata values must be primitive");
    }
    if (t === "number" && !Number.isFinite(value)) {
      throw new AdminAuditValidationError("metadata values must be finite");
    }
    out[key] = value as string | number | boolean;
  }
  if (Buffer.byteLength(JSON.stringify(out), "utf8") > MAX_METADATA_BYTES) {
    throw new AdminAuditValidationError("metadata too large");
  }
  return Object.keys(out).length ? out : undefined;
}

export type AdminAuditInput = {
  actorUserId: string;
  action: AdminAuditAction;
  targetType?: string;
  targetId?: string;
  requestId: string;
  outcome: string;
  metadata?: unknown;
};

// Minimal structural writer so this composes with both a PrismaClient and an
// interactive transaction client, and compiles/runs in node:test without pulling
// in the Next/@prisma app wiring.
export type AdminAuditWriter = {
  adminAuditLog: {
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
  };
};

// Append exactly one immutable audit row. In-transaction composable: pass the tx
// client to bind the audit to the surrounding server-side boundary.
export async function insertAdminAudit(
  client: AdminAuditWriter,
  input: AdminAuditInput
): Promise<{ id: string }> {
  const metadata = sanitizeAuditMetadata(input.metadata);
  return client.adminAuditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      requestId: input.requestId,
      outcome: input.outcome,
      metadata: metadata ?? null
    }
  });
}
