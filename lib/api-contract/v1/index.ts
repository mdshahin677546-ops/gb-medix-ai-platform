/**
 * GB MEDIX AI — Shared API contract v1 (batch 1).
 *
 * Pure types, Zod schemas, error codes, and a client skeleton shared across
 * Web / Mobile / Agent. No `/api/v1` routes, no Prisma, no auth/token/consent/
 * entitlement/Stripe implementation are introduced in this batch.
 */
export * from "./error-codes";
export * from "./result";
export * from "./common";
export * from "./auth";
export * from "./consent";
export * from "./conversation";
export * from "./report";
export * from "./entitlement";
export * from "./product";
export * from "./client";
export * from "./mobile-auth";

export const API_CONTRACT_VERSION = "v1" as const;
