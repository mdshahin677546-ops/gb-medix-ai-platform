/**
 * GB MEDIX AI — privacy-safe growth analytics foundation (v1, batch 1).
 *
 * Types, denylist, event builder, and client dedup skeleton only. No Stripe /
 * payment / entitlement changes, no health data upload, no third-party SDK, no
 * production analytics key in code, no server final-fact emission from clients.
 */
export * from "./denylist";
export * from "./events";
export * from "./dedupe";

export const ANALYTICS_SCHEMA_VERSION = 1 as const;
