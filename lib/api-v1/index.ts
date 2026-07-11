/**
 * GB MEDIX AI — /api/v1 read-foundation shared logic (batch 2.1).
 *
 * PURE barrel: request context, pagination, safe failure/success builders, and
 * DTO mappers. It imports NOTHING from next/server, @/lib/prisma, or the auth
 * cookie layer, so the real implementation compiles and runs under node:test.
 * The Next.js glue (NextResponse wrapper + session lookup) lives in ./http and
 * ./session and is intentionally excluded from this barrel.
 */
export * from "./request-context";
export * from "./pagination";
export * from "./failure";
export * from "./mappers/user";
export * from "./mappers/consent";
export * from "./mappers/report";
export * from "./mappers/entitlement";
