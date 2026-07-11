// Growth analytics v1 — tests that execute the REAL implementation.
//
// The real lib/analytics/v1 sources are compiled (project tsc -> CommonJS in a
// repo-local temp dir) and required. Assertions run against the actual builder,
// strict schema, denylist, and TTL deduper — no mirrored logic.

import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";

const SRC = "lib/analytics/v1";
const outDir = mkdtempSync(join(process.cwd(), ".tmp-analytics-"));
const requireCjs = createRequire(import.meta.url);
const tsFiles = readdirSync(SRC).filter((f) => f.endsWith(".ts")).map((f) => join(SRC, f));
execFileSync(
  process.execPath,
  ["node_modules/typescript/bin/tsc", ...tsFiles, "--outDir", outDir, "--rootDir", SRC,
   "--module", "commonjs", "--target", "es2020", "--moduleResolution", "node", "--esModuleInterop", "--skipLibCheck"],
  { stdio: "pipe" }
);
const A = requireCjs(resolve(outDir, "index.js"));
test.after(() => rmSync(outDir, { recursive: true, force: true }));

const validEvent = {
  eventName: "landing_view",
  eventId: "id-1",
  occurredAt: "2026-07-10T00:00:00Z",
  source: "web",
  shortLivedSessionKey: "s_abc",
  locale: "en",
  pageKey: "home"
};

test("a legal client event passes the real strict schema", () => {
  const e = A.buildClientEvent(validEvent);
  assert.equal(e.eventName, "landing_view");
  assert.equal(e.schemaVersion, 1);
});

test("server-authoritative events are rejected at runtime", () => {
  for (const name of ["payment_success", "report_unlocked", "refund", "signup_complete", "email_verified", "assessment_complete"]) {
    assert.throws(() => A.buildClientEvent({ ...validEvent, eventName: name }), /server-authoritative/);
  }
});

test("unknown / wrapper fields fail explicitly (not silently dropped)", () => {
  assert.throws(() => A.buildClientEvent({ eventName: "landing_view", metadata: { cookie: "secret" } }), A.AnalyticsValidationError);
  assert.throws(() => A.buildClientEvent({ eventName: "premium_click", properties: { reportContent: "health content" } }), A.AnalyticsValidationError);
  assert.throws(() => A.buildClientEvent({ eventName: "assessment_start", extra: { authorization: "Bearer secret" } }), A.AnalyticsValidationError);
  for (const wrapper of ["extra", "metadata", "properties", "context", "payload"]) {
    assert.throws(() => A.buildClientEvent({ ...validEvent, [wrapper]: {} }), A.AnalyticsValidationError, wrapper);
  }
});

test("cookie / token / report content top-level fields are rejected", () => {
  for (const bad of ["cookie", "accessToken", "refreshToken", "authorization", "reportContent", "email", "userId", "paymentId"]) {
    assert.throws(() => A.buildClientEvent({ ...validEvent, [bad]: "x" }), A.AnalyticsValidationError, bad);
  }
});

test("denylist documents cookie/token/report content", () => {
  const src = readFileSync("lib/analytics/v1/denylist.ts", "utf8").toLowerCase();
  for (const f of ["cookie", "accesstoken", "refreshtoken", "authorization", "reportcontent"]) {
    assert.ok(src.includes(f), `denylist missing ${f}`);
  }
});

// ---- TTL deduper (real) ----
function makeDeduper(now, ttlMs = 1000, maxEntries = 3) {
  let n = 0;
  const clock = { t: now };
  const d = new A.TtlEventDeduper({ uuid: () => `uuid-${++n}`, clock: () => clock.t, ttlMs, maxEntries });
  return { d, clock };
}

test("retry + remount reuse the same eventId within TTL; expiry mints a new one", () => {
  const { d, clock } = makeDeduper(0, 1000);
  const first = d.eventId("landing_view", "home");
  assert.equal(d.eventId("landing_view", "home"), first, "retry reuse");
  clock.t = 500;
  assert.equal(d.eventId("landing_view", "home"), first, "remount within TTL reuse");
  clock.t = 1500; // past TTL
  assert.notEqual(d.eventId("landing_view", "home"), first, "new id after TTL");
});

test("markEmittedOnce dedups within TTL and resets after expiry", () => {
  const { d, clock } = makeDeduper(0, 1000);
  assert.equal(d.markEmittedOnce("landing_view", "home"), true);
  assert.equal(d.markEmittedOnce("landing_view", "home"), false); // re-render
  clock.t = 1500;
  assert.equal(d.markEmittedOnce("landing_view", "home"), true); // after TTL
});

test("capacity is bounded (old entries evicted)", () => {
  const { d } = makeDeduper(0, 1_000_000, 3);
  for (let i = 0; i < 10; i++) d.eventId(`e${i}`);
  assert.ok(d.size() <= 3, `size should be capped, got ${d.size()}`);
});

test("no HMAC secret usage / no persistent storage in client analytics code", () => {
  const all = ["events.ts", "dedupe.ts", "denylist.ts", "index.ts"].map((f) => readFileSync(`lib/analytics/v1/${f}`, "utf8")).join("\n");
  // actual usage (not prohibition comments) must be absent
  assert.doesNotMatch(all, /createHmac|EVENT_SECRET|process\.env\.[A-Z_]*SECRET/);
  assert.doesNotMatch(all, /localStorage\.[a-z]|window\.localStorage|sessionStorage\.[a-z]/i);
  assert.doesNotMatch(all, /\bsk-[A-Za-z0-9]|sk_live|whsec_/);
});
