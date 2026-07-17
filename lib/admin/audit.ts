// BETA-0A — Immutable admin audit append helper.
//
// Rows are INSERTed by trusted server code only; a database trigger (see the
// BETA-0A migration) rejects every UPDATE and DELETE, so this module intentionally
// exposes NO update/delete helper. Metadata is server-built and defensively
// sanitized: no secrets, tokens, cookies, Authorization, connection strings, full
// IPs, emails, health free-text, patient, payment data, or model-generated free
// text may ever be stored.

// Fixed, enumerated admin actions — never free text from a client.
export const ADMIN_AUDIT_ACTIONS = {
  AI_USAGE_READ: "ADMIN_AI_USAGE_READ"
} as const;
export type AdminAuditAction =
  (typeof ADMIN_AUDIT_ACTIONS)[keyof typeof ADMIN_AUDIT_ACTIONS];

// Single-token sensitive words. A key is rejected if ANY of its canonical tokens
// equals one of these. Because keys are tokenized (camelCase/PascalCase, acronym,
// and separator boundaries — see canonicalizeMetadataKey), userMessage,
// user_message, USER-MESSAGE, and "user message" all yield a "message" token.
// Audit metadata must be strictly minimized, so the free-text/model-content family
// (message/content/text/prompt/response/note/comment/summary/…) is denied too.
const SENSITIVE_TOKENS = new Set<string>([
  // credentials / secrets
  "password", "passwd", "secret", "secrets", "token", "tokens", "cookie", "cookies",
  "authorization", "auth", "bearer", "jwt", "credential", "credentials",
  // contact / identifiers
  "email", "emails", "phone", "ip", "address", "contact", "mrn",
  // payment / financial
  "payment", "payments", "card", "cvv", "cvc", "bank", "stripe", "billing",
  "invoice", "transaction",
  // medical / patient
  "patient", "patients", "diagnosis", "diagnoses", "symptom", "symptoms", "health",
  "medical", "treatment", "medication", "prescription", "clinical", "consultation",
  // free-text / model-generated content
  "message", "messages", "content", "contents", "text", "prompt", "prompts",
  "response", "responses", "completion", "completions", "generation", "generated",
  "transcript", "transcription", "report", "reports", "note", "notes", "comment",
  "comments", "description", "descriptions", "detail", "details", "reason",
  "reasons", "summary", "summaries", "body", "payload"
]);

// Multi-token sensitive concepts, matched against the joined (separator-stripped)
// canonical key. These catch compound fields whose individual tokens are benign in
// isolation (model + output, api + key, database + url, connection + string).
const SENSITIVE_JOINED_CONCEPTS = [
  "modeloutput", "modelinput", "outputtext", "inputprompt", "generatedtext",
  "freetext", "freeform", "rawtext",
  "apikey", "accesstoken", "refreshtoken", "databaseurl", "connectionstring", "connstring",
  "cardnumber", "phonenumber", "emailaddress", "ipaddress",
  "patientid", "patientname", "medicalrecord",
  "requestbody", "responsebody", "requestpayload", "responsepayload",
  "requestcontent", "responsecontent", "requestmessage", "responsemessage",
  "usermessage", "eventcontent"
];

// Exact (case-insensitive) key names always rejected, incl. prototype-pollution
// vectors that must never be treated as ordinary tokens.
const FORBIDDEN_METADATA_EXACT_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const MAX_METADATA_BYTES = 2048;
const MAX_STRING_VALUE_LENGTH = 256;

export class AdminAuditValidationError extends Error {}

// Fixed, non-revealing rejection — never echoes the offending key or value into
// the error, a log, or the response.
function rejectKey(): never {
  throw new AdminAuditValidationError("metadata contains a forbidden key");
}

// Canonicalize a metadata key into lowercase tokens plus a joined form. Splits on
// camelCase/PascalCase boundaries, acronym→word boundaries, and the separators
// _ - space . : / \. Fails closed on non-strings, control characters (NUL/C0/DEL,
// incl. CR/LF/Tab), unpaired surrogates, or an empty token set — a key that cannot
// be safely canonicalized is never trusted.
function canonicalizeMetadataKey(key: string): { tokens: string[]; joined: string } {
  if (typeof key !== "string" || key.length === 0) rejectKey();
  let norm: string;
  try {
    norm = key.normalize("NFKC");
  } catch {
    rejectKey();
  }
  for (let i = 0; i < norm.length; i++) {
    const c = norm.charCodeAt(i);
    if (c <= 0x1f || c === 0x7f) rejectKey();
    if (c >= 0xd800 && c <= 0xdbff) {
      const n = norm.charCodeAt(i + 1);
      if (!(n >= 0xdc00 && n <= 0xdfff)) rejectKey();
      i++;
    } else if (c >= 0xdc00 && c <= 0xdfff) {
      rejectKey();
    }
  }
  const spaced = norm
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
  const tokens = spaced.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (tokens.length === 0) rejectKey();
  return { tokens, joined: tokens.join("") };
}

// Two-layer key check: exact-name denylist, single-token match, then multi-token
// joined-concept match. Throws (via canonicalizeMetadataKey) on unsanitizable keys.
function isForbiddenKey(key: string): boolean {
  if (FORBIDDEN_METADATA_EXACT_KEYS.has(key.trim().toLowerCase())) return true;
  const { tokens, joined } = canonicalizeMetadataKey(key);
  if (tokens.some((t) => SENSITIVE_TOKENS.has(t))) return true;
  if (SENSITIVE_JOINED_CONCEPTS.some((concept) => joined.includes(concept))) return true;
  return false;
}

// Returns safe metadata (a shallow, primitive-only object) or throws
// AdminAuditValidationError. Rejects forbidden keys, non-plain / nested / array
// shapes, non-finite numbers, oversized or multi-line string values, and oversized
// payloads — atomically: any offending entry rejects the WHOLE object so no partial
// metadata is ever produced or persisted.
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
    if (isForbiddenKey(key)) {
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
    if (t === "string") {
      const s = value as string;
      if (s.length > MAX_STRING_VALUE_LENGTH) {
        throw new AdminAuditValidationError("metadata value too long");
      }
      // Audit values are short and single-line: reject all control chars (incl.
      // CR/LF/Tab) so multi-line free-text bodies cannot ride in on a value.
      for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i);
        if (c <= 0x1f || c === 0x7f) {
          throw new AdminAuditValidationError("metadata value contains control characters");
        }
      }
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
