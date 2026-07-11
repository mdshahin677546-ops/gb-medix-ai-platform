/**
 * GB MEDIX AI consultation agent — types + policies foundation (v1, batch 1).
 *
 * Pure state machine, safe-output schema, medical boundary + safety
 * classification, product recommendation boundary, and provider safety policy.
 * No Prisma, no migration, no real provider call, no health-text storage.
 */
export * from "./state-machine";
export * from "./safe-output";
export * from "./medical-policy";
export * from "./product-boundary";
export * from "./provider-policy";

export const AGENT_CONTRACT_VERSION = "v1" as const;
