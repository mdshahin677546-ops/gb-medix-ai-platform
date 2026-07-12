/**
 * GB MEDIX AI — /api/v1 read-foundation shared logic (batch 2.1).
 *
 * PURE barrel: request context, pagination, guards, safe failure/success
 * builders, DTO mappers, and dependency-injected handler factories. It imports
 * NOTHING from next/server, @/lib/prisma, or the auth cookie layer, so the real
 * implementation compiles and runs under node:test. The Next.js glue
 * (NextResponse adapter + real dependency wiring) lives in ./http and ./session
 * and is intentionally excluded from this barrel.
 */
export * from "./request-context";
export * from "./pagination";
export * from "./failure";
export * from "./handler-result";
export * from "./guards";
export * from "./mappers/user";
export * from "./mappers/consent";
export * from "./mappers/report";
export * from "./mappers/entitlement";
export * from "./handlers/me";
export * from "./handlers/ai-consent";
export * from "./handlers/reports-list";
export * from "./handlers/report-detail";
export * from "./handlers/entitlements";
