const blockedKeys = new Set([
  "email",
  "userid",
  "user",
  "paymentid",
  "payment",
  "stripeid",
  "stripesessionid",
  "sessionid",
  "entitlementid",
  "entitlement",
  "ip",
  "ipaddress",
  "authsession",
  "session",
  "admin",
  "adminnotes",
  "internalnotes",
  "internal",
  "rawdatabaseobject",
  "databaseobject",
  "password",
  "secret",
  "token",
  "apikey",
  "license",
  "licensenumber",
  "dob",
  "dateofbirth",
  "birthdate"
]);

function normalizeKey(key: string) {
  return key.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function isBlockedKey(key: string) {
  const normalized = normalizeKey(key);
  return blockedKeys.has(normalized);
}

export function sanitizeAIInput(value: unknown): unknown {
  if (value === null || value === undefined) return value;

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAIInput(item));
  }

  if (typeof value === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      if (isBlockedKey(key)) continue;
      sanitized[key] = sanitizeAIInput(nestedValue);
    }
    return sanitized;
  }

  return value;
}

export function buildMinimalHealthPayload(value: unknown) {
  return sanitizeAIInput(value);
}
