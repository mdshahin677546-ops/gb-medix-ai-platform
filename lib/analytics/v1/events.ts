import { z } from "zod";

/**
 * GB MEDIX AI — Analytics event types (v1), privacy-safe by construction.
 *
 * A client event must pass a STRICT runtime allowlist schema: only the
 * whitelisted fields are permitted, and ANY unknown / wrapper field (extra,
 * metadata, properties, context, payload, cookie, token, …) causes an explicit
 * failure — never a silent drop. Server-authoritative events cannot be emitted
 * by a client.
 * Planning: PARALLEL_DEVELOPMENT_ROADMAP.md §9.
 */

export const CLIENT_EVENTS = [
  "landing_view",
  "signup_start",
  "premium_click",
  "assessment_start",
  "free_report_view",
  "checkout_intent"
] as const;
export type ClientEventName = (typeof CLIENT_EVENTS)[number];

export const SERVER_AUTHORITATIVE_EVENTS = [
  "signup_complete",
  "email_verified",
  "assessment_complete",
  "payment_success",
  "report_unlocked",
  "refund"
] as const;
export type ServerAuthoritativeEventName = (typeof SERVER_AUTHORITATIVE_EVENTS)[number];

const CLIENT_SET: ReadonlySet<string> = new Set(CLIENT_EVENTS);
const SERVER_SET: ReadonlySet<string> = new Set(SERVER_AUTHORITATIVE_EVENTS);

export function isClientEmittable(name: string): name is ClientEventName {
  return CLIENT_SET.has(name);
}
export function isServerAuthoritative(name: string): name is ServerAuthoritativeEventName {
  return SERVER_SET.has(name);
}

/** Strict allowlist schema. `.strict()` rejects every field not listed here. */
export const clientEventInputSchema = z
  .object({
    eventName: z.enum(CLIENT_EVENTS),
    eventId: z.string().min(1).max(128),
    occurredAt: z.string().min(1),
    source: z.enum(["web", "mobile"]),
    shortLivedSessionKey: z.string().min(1).max(128),
    schemaVersion: z.literal(1).default(1),
    locale: z.enum(["en", "zh"]).optional(),
    pageKey: z.string().min(1).max(128).optional()
  })
  .strict();
export type AnalyticsEvent = z.infer<typeof clientEventInputSchema>;

export class AnalyticsValidationError extends Error {
  constructor(message: string, public readonly issues?: string[]) {
    super(message);
    this.name = "AnalyticsValidationError";
  }
}

/**
 * Build a privacy-safe client event. Throws AnalyticsValidationError if the
 * event is server-authoritative, an unknown/wrapper field is present, or the
 * payload otherwise fails the strict allowlist schema. Nothing is silently
 * dropped.
 */
export function buildClientEvent(input: unknown): AnalyticsEvent {
  if (input && typeof input === "object" && "eventName" in input) {
    const name = (input as { eventName?: unknown }).eventName;
    if (typeof name === "string" && isServerAuthoritative(name)) {
      throw new AnalyticsValidationError(
        `"${name}" is server-authoritative and must not be emitted by a client.`
      );
    }
  }
  const parsed = clientEventInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new AnalyticsValidationError(
      "Invalid or forbidden analytics event payload.",
      parsed.error.issues.map((i) => i.path.join("."))
    );
  }
  return parsed.data;
}
