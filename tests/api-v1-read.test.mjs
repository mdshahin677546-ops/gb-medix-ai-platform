// API v1 read foundation — tests that execute the REAL pure implementation.
//
// The pure lib/api-v1 modules (request context, pagination, guards, safe
// failure/success builders, DTO mappers) plus lib/api-contract/v1 are compiled
// with the project tsc to CommonJS in a repo-local temp dir and required.
// Assertions run against the real mappers/validators — no mirrored logic. The
// Next.js glue (http.ts, session.ts) is excluded; the injected handler factories
// are exercised in tests/api-v1-read-handlers.test.mjs.

import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";

const API_V1 = "lib/api-v1";
const CONTRACT = "lib/api-contract/v1";
const EXCLUDE = new Set(["http.ts", "session.ts"]); // depend on next/server & @/lib/auth

function collectTs(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectTs(p));
    else if (entry.name.endsWith(".ts") && !EXCLUDE.has(entry.name)) out.push(p);
  }
  return out;
}

const outDir = mkdtempSync(join(process.cwd(), ".tmp-apiv1-"));
const requireCjs = createRequire(import.meta.url);
execFileSync(
  process.execPath,
  [
    "node_modules/typescript/bin/tsc",
    ...collectTs(CONTRACT),
    ...collectTs(API_V1),
    "--outDir", outDir,
    "--rootDir", "lib",
    "--module", "commonjs",
    "--target", "es2020",
    "--moduleResolution", "node",
    "--esModuleInterop",
    "--strict",
    "--skipLibCheck"
  ],
  { stdio: "pipe" }
);
const M = requireCjs(resolve(outDir, "api-v1/index.js"));
const CONTRACTMOD = requireCjs(resolve(outDir, "api-contract/v1/index.js"));
test.after(() => rmSync(outDir, { recursive: true, force: true }));

const LEAK_MARKERS = /PrismaClient|SequelizeError|\bat \/|node_modules|password|sessionVersion|\n/;

// ---- request context & headers ----
test("newRequestId is random, unique, and carries no identifiers", () => {
  const a = M.newRequestId();
  const b = M.newRequestId();
  assert.equal(typeof a, "string");
  assert.notEqual(a, b);
  assert.match(a, /^[0-9a-f-]{36}$/i);
  assert.doesNotMatch(a, /@|password|user/i);
});

test("API headers are versioned, non-cacheable, JSON, no CORS", () => {
  const h = M.buildApiHeaders("req-1");
  assert.equal(h["X-Request-Id"], "req-1");
  assert.equal(h["X-API-Version"], "1");
  assert.equal(h["Cache-Control"], "private, no-store");
  assert.equal(h["Content-Type"], "application/json");
  assert.equal(M.API_VERSION, "1");
  assert.ok(!("Access-Control-Allow-Origin" in h));
});

// ---- safe failure / success builders ----
test("failure maps codes to HTTP status and safe messages (no leakage)", () => {
  const cases = [
    ["AUTH_REQUIRED", 401],
    ["EMAIL_VERIFICATION_REQUIRED", 403],
    ["ENTITLEMENT_REQUIRED", 402],
    ["RESOURCE_NOT_FOUND", 404],
    ["VALIDATION_ERROR", 400],
    ["INTERNAL_ERROR", 500]
  ];
  for (const [code, status] of cases) {
    const f = M.failure(code, "rid");
    assert.equal(f.status, status);
    assert.equal(f.body.ok, false);
    assert.equal(f.body.error.code, code);
    assert.equal(f.body.error.requestId, "rid");
    assert.equal(typeof f.body.error.retryable, "boolean");
    assert.ok(f.body.error.message.length > 0);
    assert.doesNotMatch(f.body.error.message, LEAK_MARKERS);
    CONTRACTMOD.apiErrorResponseSchema.parse(f.body);
  }
});

test("internalFailure never leaks and maps to 500", () => {
  const f = M.internalFailure("rid");
  assert.equal(f.status, 500);
  assert.equal(f.body.error.code, "INTERNAL_ERROR");
  assert.doesNotMatch(f.body.error.message, LEAK_MARKERS);
});

test("not-found and not-serviceable are the SAME 404 (no enumeration signal)", () => {
  const a = M.failure("RESOURCE_NOT_FOUND", "r1");
  const b = M.failure("RESOURCE_NOT_FOUND", "r2");
  assert.equal(a.status, b.status);
  assert.equal(a.body.error.code, b.body.error.code);
  assert.equal(a.body.error.message, b.body.error.message);
});

test("success wraps data with requestId and 200", () => {
  const s = M.success({ hello: "world" }, "rid");
  assert.equal(s.status, 200);
  assert.equal(s.body.ok, true);
  assert.deepEqual(s.body.data, { hello: "world" });
  assert.equal(s.body.requestId, "rid");
});

// ---- pagination ----
test("pagination defaults, bounds, and invalid inputs", () => {
  assert.deepEqual(M.parsePagination({}), { ok: true, limit: 20, cursor: null });
  assert.equal(M.parsePagination({ limit: "50" }).limit, 50);
  assert.equal(M.parsePagination({ limit: "1" }).limit, 1);
  assert.equal(M.parsePagination({ limit: "51" }).ok, false);
  assert.equal(M.parsePagination({ limit: "0" }).ok, false);
  assert.equal(M.parsePagination({ limit: "-1" }).ok, false);
  assert.equal(M.parsePagination({ limit: "abc" }).ok, false);
  assert.equal(M.parsePagination({ limit: "20.5" }).ok, false);
  assert.equal(M.MAX_PAGE_LIMIT, 50);
});

test("cursor round-trips and rejects malformed cursors", () => {
  const c = { createdAt: "2026-07-10T00:00:00.000Z", id: "rep_123" };
  const enc = M.encodeCursor(c);
  const page = M.parsePagination({ cursor: enc });
  assert.equal(page.ok, true);
  assert.deepEqual(page.cursor, c);
  // non-JSON payload
  assert.equal(M.parsePagination({ cursor: Buffer.from("nope", "utf8").toString("base64url") }).ok, false);
  // JSON but wrong/extra shape
  assert.equal(M.parsePagination({ cursor: Buffer.from(JSON.stringify({ c: "2026-07-10T00:00:00.000Z", i: "x", extra: 1 }), "utf8").toString("base64url") }).ok, false);
  // bad date
  assert.equal(M.parsePagination({ cursor: Buffer.from(JSON.stringify({ c: "not-a-date", i: "x" }), "utf8").toString("base64url") }).ok, false);
  // non base64url characters
  assert.equal(M.parsePagination({ cursor: "!!!not-base64!!!" }).ok, false);
});

test("cursor raw length is capped before decoding", () => {
  const huge = "A".repeat(M.MAX_CURSOR_LENGTH + 1);
  assert.equal(M.parsePagination({ cursor: huge }).ok, false);
  assert.equal(M.MAX_CURSOR_LENGTH, 512);
});

// ---- /me mapper ----
test("toMeDTO returns only allowlisted fields; drops sensitive input", () => {
  const me = M.toMeDTO({
    id: "u1",
    status: "active",
    emailVerifiedAt: new Date("2026-01-01T00:00:00Z"),
    email: "a@b.com",
    passwordHash: "x",
    sessionVersion: 7
  });
  assert.deepEqual(me, { id: "u1", status: "active", emailVerified: true });
  assert.ok(!("email" in me));
  assert.ok(!("sessionVersion" in me));
  assert.ok(!("passwordHash" in me));
  CONTRACTMOD.meSchema.parse(me);
});

test("toMeDTO pending user with no verification", () => {
  const me = M.toMeDTO({ id: "u2", status: "pending", emailVerifiedAt: null });
  assert.equal(me.status, "pending");
  assert.equal(me.emailVerified, false);
});

test("toMeDTO coerces unknown status to pending", () => {
  const me = M.toMeDTO({ id: "u3", status: "banned", emailVerifiedAt: null });
  assert.equal(me.status, "pending");
});

// ---- /ai-consent mapper ----
test("toAiConsentStatusDTO: server provider maps to scope; no raw provider leaked", () => {
  const dto = M.toAiConsentStatusDTO({
    provider: "deepseek",
    required: true,
    accepted: true,
    consentVersion: "2026-07-09-v1",
    acceptedAt: "2026-07-09T00:00:00.000Z",
    revokedAt: null
  });
  assert.equal(dto.required, true);
  assert.deepEqual(dto.providerScope, ["deepseek"]);
  assert.ok(!("provider" in dto));
  CONTRACTMOD.aiConsentStatusSchema.parse(dto);
});

test("toAiConsentStatusDTO: non-third-party provider -> empty scope, accepted", () => {
  const dto = M.toAiConsentStatusDTO({
    provider: "openai",
    required: false,
    accepted: true,
    consentVersion: "2026-07-09-v1",
    acceptedAt: null,
    revokedAt: null
  });
  assert.equal(dto.required, false);
  assert.deepEqual(dto.providerScope, []);
});

test("toAiConsentStatusDTO: revoked consent surfaces revokedAt", () => {
  const dto = M.toAiConsentStatusDTO({
    provider: "deepseek",
    required: true,
    accepted: false,
    consentVersion: "2026-07-09-v1",
    acceptedAt: "2026-07-09T00:00:00.000Z",
    revokedAt: "2026-07-10T00:00:00.000Z"
  });
  assert.equal(dto.accepted, false);
  assert.equal(dto.revokedAt, "2026-07-10T00:00:00.000Z");
});

// ---- /entitlements mapper ----
test("toEntitlementDTO drops payment/internal fields; maps status", () => {
  const dto = M.toEntitlementDTO({
    id: "e1",
    productId: "premium_report",
    resourceType: "assessment",
    resourceId: "a1",
    status: "active",
    expiresAt: null,
    userId: "u1",
    paymentId: "pay_1",
    sourceReferenceId: "cs_test_123"
  });
  assert.equal(dto.productCode, "premium_report");
  assert.equal(dto.status, "active");
  assert.ok(!("paymentId" in dto));
  assert.ok(!("userId" in dto));
  assert.ok(!("sourceReferenceId" in dto));
  assert.ok(!("source" in dto));
  CONTRACTMOD.entitlementSchema.parse(dto);
});

test("toEntitlementDTO maps revoked/refunded; unknown status fails loudly (never active)", () => {
  assert.equal(M.toEntitlementDTO({ id: "e", productId: "p", resourceType: null, resourceId: null, status: "revoked", expiresAt: null }).status, "revoked");
  assert.equal(M.toEntitlementDTO({ id: "e", productId: "p", resourceType: null, resourceId: null, status: "refunded", expiresAt: null }).status, "refunded");
  assert.throws(
    () => M.toEntitlementDTO({ id: "e", productId: "p", resourceType: null, resourceId: null, status: "mystery", expiresAt: null }),
    M.UnmappedEntitlementStatusError
  );
});

// ---- report summary + detail decision ----
const freeRow = {
  id: "r_free",
  type: "free_health_report",
  status: "free_ready",
  score: 82,
  summary: "Wellness summary.",
  analysis: { constitution: "balanced", riskLevel: "LOW", extra: "ignored" },
  recommendations: [{ category: "sleep", content: "Sleep earlier." }],
  lifestylePlan: [],
  followUpPlan: [],
  createdAt: new Date("2026-07-10T00:00:00Z")
};
const premiumRow = {
  id: "r_prem",
  type: "premium_health_report",
  status: "premium_ready",
  score: 90,
  summary: "Premium summary.",
  analysis: { constitution: "qi-def", riskLevel: "MEDIUM" },
  recommendations: [{ category: "diet", content: "Eat warm foods." }],
  lifestylePlan: ["Walk 20 min daily."],
  followUpPlan: ["Recheck in 7 days."],
  createdAt: new Date("2026-07-11T00:00:00Z")
};

test("toReportSummaryDTO is summary-only (no analysis/recommendations)", () => {
  const s = M.toReportSummaryDTO(freeRow);
  CONTRACTMOD.reportSummarySchema.parse(s);
  assert.ok(!("analysis" in s));
  assert.ok(!("recommendations" in s));
  assert.ok(!("userId" in s));
});

test("free ready report maps to a valid FreeReport", () => {
  const d = M.toReportDetailDTO(freeRow, false);
  assert.equal(d.kind, "free");
  CONTRACTMOD.freeReportSchema.parse(d.data);
  assert.equal(d.data.constitution, "balanced");
  assert.ok(!("lifestylePlan" in d.data));
});

test("premium ready + entitled maps to a valid PremiumReport", () => {
  const d = M.toReportDetailDTO(premiumRow, true);
  assert.equal(d.kind, "premium");
  CONTRACTMOD.premiumReportSchema.parse(d.data);
  assert.equal(d.data.lifestylePlan.length, 1);
});

test("premium WITHOUT entitlement is locked (never returns premium data)", () => {
  const d = M.toReportDetailDTO(premiumRow, false);
  assert.equal(d.kind, "locked");
  assert.ok(!("data" in d));
});

test("entitlement gate applies before readiness (generating premium, not entitled -> locked)", () => {
  const d = M.toReportDetailDTO({ ...premiumRow, status: "premium_generating" }, false);
  assert.equal(d.kind, "locked");
});

test("consent cannot substitute for entitlement (entitled=false always locks premium)", () => {
  assert.equal(M.toReportDetailDTO(premiumRow, false).kind, "locked");
  assert.equal(M.toReportDetailDTO(premiumRow, true).kind, "premium");
});

test("not-yet-ready free report falls back to summary", () => {
  const d = M.toReportDetailDTO({ ...freeRow, status: "free_generating", analysis: {} }, false);
  assert.equal(d.kind, "summary");
  CONTRACTMOD.reportSummarySchema.parse(d.data);
});

test("legacy/unknown report type is not serviceable (route -> 404)", () => {
  const d = M.toReportDetailDTO({ ...freeRow, type: "health_assessment" }, false);
  assert.equal(d.kind, "not_serviceable");
});

test("ready report without usable analysis falls back to summary (no fabrication)", () => {
  const d = M.toReportDetailDTO({ ...freeRow, analysis: { note: "no constitution" } }, false);
  assert.equal(d.kind, "summary");
});
