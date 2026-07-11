/**
 * GB MEDIX AI — Analytics upload denylist (v1).
 *
 * These fields must NEVER enter an analytics event payload. Enforced by the
 * event builder + tests. Planning: PARALLEL_DEVELOPMENT_ROADMAP.md §9.
 */
export const ANALYTICS_DENYLIST_FIELDS = [
  "email",
  "userId",
  "userName",
  "name",
  "ip",
  "cookie",
  "sessionCookie",
  "session",
  "accessToken",
  "refreshToken",
  "authorization",
  "apiKey",
  "paymentId",
  "stripeSessionId",
  "stripePaymentIntentId",
  "refundReference",
  "reportId",
  "entitlementId",
  "conversationId",
  "assessmentId",
  "dbId",
  "healthAnswer",
  "healthAnswers",
  "symptom",
  "bodySensation",
  "prompt",
  "providerOutput",
  "reportContent",
  "reportSummary",
  "healthPlan",
  "safetyDescription",
  "conversationContent",
  "requestBody",
  "responseBody",
  "record"
] as const;

const DENYSET: ReadonlySet<string> = new Set(
  ANALYTICS_DENYLIST_FIELDS.map((f) => f.toLowerCase())
);

/** True if a field name is denied (case-insensitive). */
export function isDeniedAnalyticsField(field: string): boolean {
  return DENYSET.has(field.toLowerCase());
}

/**
 * Returns the list of denied keys present in an object (empty = clean).
 * Used to hard-fail any event carrying forbidden data.
 */
export function findDeniedFields(payload: Record<string, unknown>): string[] {
  return Object.keys(payload).filter((k) => isDeniedAnalyticsField(k));
}
