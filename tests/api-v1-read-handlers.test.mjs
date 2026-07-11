// API v1 read handlers — execute the REAL handler factories with injected mocks.
//
// The pure lib/api-v1 barrel (guards + handler factories + mappers) plus
// lib/api-contract/v1 are compiled to CommonJS and required. Each test builds a
// real handler via createXHandler({...deps}) with spy dependencies and asserts
// the real status / headers / body and the exact Prisma-arg / entitlement-scope
// the handler produces. No handler/gate/query logic is re-implemented here.

import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";

const API_V1 = "lib/api-v1";
const CONTRACT = "lib/api-contract/v1";
const EXCLUDE = new Set(["http.ts", "session.ts"]);

function collectTs(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectTs(p));
    else if (entry.name.endsWith(".ts") && !EXCLUDE.has(entry.name)) out.push(p);
  }
  return out;
}

const outDir = mkdtempSync(join(process.cwd(), ".tmp-apiv1h-"));
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
test.after(() => rmSync(outDir, { recursive: true, force: true }));

const LEAK = /database secret|PrismaClient|\bat \/|node_modules|stack|sessionVersion/i;

const activeVerified = { id: "u_active", status: "active", emailVerifiedAt: new Date("2026-01-01T00:00:00Z") };
const pending = { id: "u_pending", status: "pending", emailVerifiedAt: null };
const activeUnverified = { id: "u_unverified", status: "active", emailVerifiedAt: null };

const authOnly = (user) => M.makeRequireAuthenticatedUser(async () => user);
const activeVerifiedGuard = (user) => M.makeRequireActiveVerifiedUser(async () => user);

function assertStandardHeaders(res) {
  assert.equal(res.headers["X-API-Version"], "1");
  assert.equal(res.headers["Cache-Control"], "private, no-store");
  assert.equal(res.headers["Content-Type"], "application/json");
  assert.match(res.headers["X-Request-Id"], /^[0-9a-f-]{36}$/i);
  const rid = res.headers["X-Request-Id"];
  if (res.body.ok) assert.equal(res.body.requestId, rid);
  else assert.equal(res.body.error.requestId, rid);
}

// ============================ /me (auth-only) ============================
test("me: unauthenticated -> 401 with full headers", async () => {
  const res = await M.createMeHandler({ requireUser: authOnly(null) })();
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, "AUTH_REQUIRED");
  assertStandardHeaders(res);
});

test("me: pending user -> 200 (not mapped to active)", async () => {
  const res = await M.createMeHandler({ requireUser: authOnly(pending) })();
  assert.equal(res.status, 200);
  assert.equal(res.body.data.user.status, "pending");
  assert.equal(res.body.data.user.emailVerified, false);
  assertStandardHeaders(res);
});

test("me: active user -> 200 active", async () => {
  const res = await M.createMeHandler({ requireUser: authOnly(activeVerified) })();
  assert.equal(res.status, 200);
  assert.equal(res.body.data.user.status, "active");
  assert.ok(!("email" in res.body.data.user));
});

// =================== active+verified gate (4 endpoints) ===================
test("sensitive endpoints: 401 unauth, 403 pending, 403 active-unverified; deps NOT called", async () => {
  for (const [user, expected] of [[null, 401], [pending, 403], [activeUnverified, 403]]) {
    let called = 0;
    const res = await M.createEntitlementsHandler({
      requireUser: activeVerifiedGuard(user),
      queryEntitlements: async () => { called++; return []; }
    })({ query: {} });
    assert.equal(res.status, expected);
    assert.equal(res.body.error.code, expected === 401 ? "AUTH_REQUIRED" : "EMAIL_VERIFICATION_REQUIRED");
    assert.equal(called, 0, "DB must not be queried before the gate passes");
    assertStandardHeaders(res);
  }
});

// ============================ /ai-consent ============================
test("ai-consent: pending -> 403 and consent service not called", async () => {
  let consent = 0;
  const res = await M.createAiConsentHandler({
    requireUser: activeVerifiedGuard(pending),
    getProviderName: () => "deepseek",
    getConsentStatus: async () => { consent++; return {}; }
  })();
  assert.equal(res.status, 403);
  assert.equal(consent, 0);
});

test("ai-consent: active+verified -> provider resolved server-side; scope mapped", async () => {
  const res = await M.createAiConsentHandler({
    requireUser: activeVerifiedGuard(activeVerified),
    getProviderName: () => "deepseek",
    getConsentStatus: async (userId, provider) => {
      assert.equal(userId, "u_active");
      assert.equal(provider, "deepseek");
      return { provider, required: true, accepted: true, consentVersion: "2026-07-09-v1", acceptedAt: "2026-07-09T00:00:00.000Z", revokedAt: null };
    }
  })();
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.data.providerScope, ["deepseek"]);
  assert.ok(!("provider" in res.body.data));
  assertStandardHeaders(res);
});

test("ai-consent: service throws -> safe 500 (no leak)", async () => {
  const res = await M.createAiConsentHandler({
    requireUser: activeVerifiedGuard(activeVerified),
    getProviderName: () => "deepseek",
    getConsentStatus: async () => { throw new Error("database secret error"); }
  })();
  assert.equal(res.status, 500);
  assert.equal(res.body.error.code, "INTERNAL_ERROR");
  assert.doesNotMatch(JSON.stringify(res.body), LEAK);
  assertStandardHeaders(res);
});

// ============================ /reports (list) ============================
function reportsRow(id, i) {
  return { id, type: "free_health_report", status: "free_ready", score: 80, summary: "s", createdAt: new Date(`2026-07-${10 + (i % 15)}T00:00:00Z`) };
}

test("reports list: userId-scoped, summary-only select, take=limit+1", async () => {
  let args;
  const res = await M.createReportsListHandler({
    requireUser: activeVerifiedGuard(activeVerified),
    queryReports: async (a) => { args = a; return [reportsRow("r1", 1)]; }
  })({ query: {} });
  assert.equal(res.status, 200);
  assert.equal(args.where.userId, "u_active");
  assert.deepEqual(args.where.type, { in: ["free_health_report", "premium_health_report"] });
  assert.equal(args.take, 21); // default 20 + 1
  for (const forbidden of ["analysis", "recommendations", "lifestylePlan", "productSuggestions", "followUpPlan"]) {
    assert.ok(!(forbidden in args.select), `select must not include ${forbidden}`);
  }
  for (const req of ["id", "type", "status", "score", "summary", "createdAt"]) {
    assert.equal(args.select[req], true);
  }
  assert.equal(res.body.data.items.length, 1);
  assert.equal(res.body.data.nextCursor, null);
});

test("reports list: limit bounds and invalid params -> 400 (no query)", async () => {
  for (const limit of ["51", "-1", "1.5", "abc"]) {
    let called = 0;
    const res = await M.createReportsListHandler({
      requireUser: activeVerifiedGuard(activeVerified),
      queryReports: async () => { called++; return []; }
    })({ query: { limit } });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
    assert.equal(called, 0);
  }
  // limit 50 accepted -> take 51
  let args;
  await M.createReportsListHandler({
    requireUser: activeVerifiedGuard(activeVerified),
    queryReports: async (a) => { args = a; return []; }
  })({ query: { limit: "50" } });
  assert.equal(args.take, 51);
});

test("reports list: nextCursor emitted only when a full extra page exists", async () => {
  const rows = Array.from({ length: 21 }, (_, i) => reportsRow(`r${i}`, i));
  const res = await M.createReportsListHandler({
    requireUser: activeVerifiedGuard(activeVerified),
    queryReports: async () => rows
  })({ query: {} });
  assert.equal(res.body.data.items.length, 20);
  assert.equal(typeof res.body.data.nextCursor, "string");
  // the emitted cursor is a valid, decodable opaque token
  assert.equal(M.parsePagination({ cursor: res.body.data.nextCursor }).ok, true);
});

// ============================ /reports/:id ============================
const freeMeta = { id: "r_free", type: "free_health_report", status: "free_ready", assessmentId: "as_free", score: 80, summary: "s", createdAt: new Date("2026-07-10T00:00:00Z") };
const premiumMetaReady = { id: "r_prem", type: "premium_health_report", status: "premium_ready", assessmentId: "as_prem", score: 90, summary: "p", createdAt: new Date("2026-07-11T00:00:00Z") };
const freeDetail = { ...freeMeta, analysis: { constitution: "balanced", riskLevel: "LOW" }, recommendations: [{ category: "sleep", content: "rest" }], lifestylePlan: [], followUpPlan: [] };
const premiumDetail = { ...premiumMetaReady, analysis: { constitution: "qi", riskLevel: "MEDIUM" }, recommendations: [{ category: "diet", content: "warm" }], lifestylePlan: ["walk"], followUpPlan: ["recheck"] };

function detailHandler(opts) {
  const cap = { meta: 0, detail: 0, ent: 0, scope: null, metaArgs: null, detailArgs: null };
  const h = M.createReportDetailHandler({
    requireUser: activeVerifiedGuard(opts.user ?? activeVerified),
    queryReportMetadata: async (a) => { cap.meta++; cap.metaArgs = a; if (opts.metaThrow) throw new Error("database secret error"); return opts.meta ?? null; },
    checkEntitlement: async (scope) => { cap.ent++; cap.scope = scope; return Boolean(opts.entitled); },
    queryReportDetail: async (a) => { cap.detail++; cap.detailArgs = a; return opts.detail ?? null; },
    premiumProductCode: "premium_report",
    assessmentResourceType: "assessment"
  });
  return { h, cap };
}

test("report detail: invalid id -> 400 and metadata query NOT called", async () => {
  for (const id of ["", "has space", "bad/slash", "a".repeat(129), "ctrl"]) {
    const { h, cap } = detailHandler({});
    const res = await h({ id });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
    assert.equal(cap.meta, 0);
  }
});

test("report detail: non-owner / missing -> identical 404, detail query not run", async () => {
  const { h, cap } = detailHandler({ meta: null });
  const res = await h({ id: "r_missing" });
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, "RESOURCE_NOT_FOUND");
  assert.deepEqual(cap.metaArgs.where, { id: "r_missing", userId: "u_active" });
  assert.ok(!("analysis" in cap.metaArgs.select)); // metadata projection has no content
  assert.equal(cap.detail, 0);
});

test("report detail: free report reads detail without an entitlement check", async () => {
  const { h, cap } = detailHandler({ meta: freeMeta, detail: freeDetail });
  const res = await h({ id: "r_free" });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.report.type, "free_health_report");
  assert.equal(cap.ent, 0, "free reports never call checkEntitlement");
  assert.deepEqual(cap.detailArgs.where, { id: "r_free", userId: "u_active" });
});

test("report detail: locked premium -> 402 and full detail query is NOT run", async () => {
  const { h, cap } = detailHandler({ meta: premiumMetaReady, entitled: false, detail: premiumDetail });
  const res = await h({ id: "r_prem" });
  assert.equal(res.status, 402);
  assert.equal(res.body.error.code, "ENTITLEMENT_REQUIRED");
  assert.equal(cap.detail, 0, "premium JSON must not be read when locked");
  // entitlement scope is bound to THIS report's assessment
  assert.deepEqual(cap.scope, { userId: "u_active", productId: "premium_report", resourceType: "assessment", resourceId: "as_prem" });
});

test("report detail: entitled premium -> reads detail with correct scope", async () => {
  const { h, cap } = detailHandler({ meta: premiumMetaReady, entitled: true, detail: premiumDetail });
  const res = await h({ id: "r_prem" });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.report.type, "premium_health_report");
  assert.equal(res.body.data.report.lifestylePlan.length, 1);
  assert.equal(cap.scope.resourceId, "as_prem");
  assert.equal(cap.detail, 1);
  assert.deepEqual(cap.detailArgs.where, { id: "r_prem", userId: "u_active" });
});

test("report detail: refunded/revoked/expired entitlement (entitled=false) -> 402, no detail read", async () => {
  // Any non-active entitlement makes the real checkEntitlement return false.
  const { h, cap } = detailHandler({ meta: premiumMetaReady, entitled: false });
  const res = await h({ id: "r_prem" });
  assert.equal(res.status, 402);
  assert.equal(cap.detail, 0);
});

test("report detail: premium generating + entitled -> summary only, no content read", async () => {
  const { h, cap } = detailHandler({ meta: { ...premiumMetaReady, status: "premium_generating" }, entitled: true });
  const res = await h({ id: "r_prem" });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.report.status, "premium_generating");
  assert.equal(cap.detail, 0, "content columns are not read for a not-ready report");
});

test("report detail: metadata query throws -> safe 500", async () => {
  const { h } = detailHandler({ metaThrow: true });
  const res = await h({ id: "r_prem" });
  assert.equal(res.status, 500);
  assert.equal(res.body.error.code, "INTERNAL_ERROR");
  assert.doesNotMatch(JSON.stringify(res.body), LEAK);
});

// ============================ /entitlements ============================
function entRow(id, i) {
  return { id, productId: "premium_report", resourceType: "assessment", resourceId: `a${i}`, status: "active", expiresAt: null, createdAt: new Date(`2026-07-${10 + (i % 15)}T00:00:00Z`) };
}

test("entitlements: pending -> 403, prisma not called", async () => {
  let called = 0;
  const res = await M.createEntitlementsHandler({
    requireUser: activeVerifiedGuard(pending),
    queryEntitlements: async () => { called++; return []; }
  })({ query: {} });
  assert.equal(res.status, 403);
  assert.equal(called, 0);
});

test("entitlements: active -> userId scope, safe select (no paymentId), take=limit+1", async () => {
  let args;
  const res = await M.createEntitlementsHandler({
    requireUser: activeVerifiedGuard(activeVerified),
    queryEntitlements: async (a) => { args = a; return [entRow("e1", 1)]; }
  })({ query: {} });
  assert.equal(res.status, 200);
  assert.equal(args.where.userId, "u_active");
  assert.equal(args.take, 21);
  assert.ok(!("paymentId" in args.select));
  assert.ok(!("userId" in args.select));
  assert.equal(res.body.data.entitlements[0].productCode, "premium_report");
  assert.ok(!("paymentId" in res.body.data.entitlements[0]));
});

test("entitlements: invalid limit -> 400 (not called); limit=50 -> take 51", async () => {
  for (const limit of ["51", "-2", "3.3", "xyz"]) {
    let called = 0;
    const res = await M.createEntitlementsHandler({
      requireUser: activeVerifiedGuard(activeVerified),
      queryEntitlements: async () => { called++; return []; }
    })({ query: { limit } });
    assert.equal(res.status, 400);
    assert.equal(called, 0);
  }
  let args;
  await M.createEntitlementsHandler({
    requireUser: activeVerifiedGuard(activeVerified),
    queryEntitlements: async (a) => { args = a; return []; }
  })({ query: { limit: "50" } });
  assert.equal(args.take, 51);
});

test("entitlements: nextCursor emitted for a full extra page", async () => {
  const rows = Array.from({ length: 21 }, (_, i) => entRow(`e${i}`, i));
  const res = await M.createEntitlementsHandler({
    requireUser: activeVerifiedGuard(activeVerified),
    queryEntitlements: async () => rows
  })({ query: {} });
  assert.equal(res.body.data.entitlements.length, 20);
  assert.equal(typeof res.body.data.nextCursor, "string");
});

test("entitlements: unmodelled status -> safe 500 (never leaks, never active)", async () => {
  const res = await M.createEntitlementsHandler({
    requireUser: activeVerifiedGuard(activeVerified),
    queryEntitlements: async () => [{ ...entRow("e1", 1), status: "mystery" }]
  })({ query: {} });
  assert.equal(res.status, 500);
  assert.equal(res.body.error.code, "INTERNAL_ERROR");
  assert.doesNotMatch(JSON.stringify(res.body), LEAK);
});
