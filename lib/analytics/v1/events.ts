import { findDeniedFields } from "./denylist";

/**
 * GB MEDIX AI — Analytics event types (v1), privacy-safe by construction.
 *
 * Client-emittable events (this batch) vs server-authoritative events (types /
 * interfaces only — clients must NOT emit the final fact).
 * Planning: PARALLEL_DEVELOPMENT_ROADMAP.md §9.
 */

/** Events a client may emit directly in this batch. */
export const CLIENT_EVENTS = [
  "landing_view",
  "signup_start",
  "premium_click",
  "assessment_start",
  "free_report_view",
  "checkout_intent"
] as const;
export type ClientEventName = (typeof CLIENT_EVENTS)[number];

/**
 * Server-authoritative events — the CLIENT MUST NOT emit these as final facts.
 * Only their type/interface is defined here for downstream server work.
 */
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

/** Allowed public fields on any analytics event. Nothing else may be added. */
export type AnalyticsEvent = {
  eventName: ClientEventName;
  eventId: string;
  occurredAt: string;
  source: "web" | "mobile";
  shortLivedSessionKey: string;
  schemaVersion: number;
  locale?: "en" | "zh";
  pageKey?: string;
};

export class AnalyticsDenylistError extends Error {
  constructor(public readonly deniedFields: string[]) {
    super("Analytics payload contained denied fields.");
    this.name = "AnalyticsDenylistError";
  }
}

/**
 * Build a privacy-safe client event. Throws if:
 * - the event is server-authoritative (client may not emit the final fact), or
 * - the extra payload carries any denied field.
 */
export function buildClientEvent(input: {
  eventName: string;
  eventId: string;
  source: "web" | "mobile";
  shortLivedSessionKey: string;
  occurredAt: string;
  locale?: "en" | "zh";
  pageKey?: string;
  extra?: Record<string, unknown>;
}): AnalyticsEvent {
  if (isServerAuthoritative(input.eventName)) {
    throw new Error(
      `"${input.eventName}" is server-authoritative and must not be emitted by a client.`
    );
  }
  if (!isClientEmittable(input.eventName)) {
    throw new Error(`Unknown client event "${input.eventName}".`);
  }
  const denied = input.extra ? findDeniedFields(input.extra) : [];
  if (denied.length > 0) {
    throw new AnalyticsDenylistError(denied);
  }
  return {
    eventName: input.eventName,
    eventId: input.eventId,
    occurredAt: input.occurredAt,
    source: input.source,
    shortLivedSessionKey: input.shortLivedSessionKey,
    schemaVersion: 1,
    ...(input.locale ? { locale: input.locale } : {}),
    ...(input.pageKey ? { pageKey: input.pageKey } : {})
  };
}
