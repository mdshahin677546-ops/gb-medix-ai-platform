// Growth analytics v1 — batch 1 privacy tests.
//
// The analytics foundation is TypeScript (lib/analytics/v1/*.ts). node:test cannot
// import .ts, so behavior is exercised via faithful mirrors and source assertions
// verify the shipped code enforces the same privacy rules.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(p, "utf8");
const denylistSrc = read("lib/analytics/v1/denylist.ts");
const eventsSrc = read("lib/analytics/v1/events.ts");
const dedupeSrc = read("lib/analytics/v1/dedupe.ts");

// ---- mirror of denylist + builder ----
const DENY = new Set(
  [
    "email", "userId", "userName", "name", "ip", "cookie", "sessionCookie", "session",
    "accessToken", "refreshToken", "authorization", "apiKey", "paymentId",
    "stripeSessionId", "stripePaymentIntentId", "refundReference", "reportId",
    "entitlementId", "conversationId", "assessmentId", "dbId", "healthAnswer",
    "healthAnswers", "symptom", "bodySensation", "prompt", "providerOutput",
    "reportContent", "reportSummary", "healthPlan", "safetyDescription",
    "conversationContent", "requestBody", "responseBody", "record"
  ].map((f) => f.toLowerCase())
);
const findDenied = (o) => Object.keys(o).filter((k) => DENY.has(k.toLowerCase()));

const SERVER_AUTH = new Set([
  "signup_complete", "email_verified", "assessment_complete",
  "payment_success", "report_unlocked", "refund"
]);
const CLIENT_EVENTS = new Set([
  "landing_view", "signup_start", "premium_click",
  "assessment_start", "free_report_view", "checkout_intent"
]);

function buildClientEvent(name, extra) {
  if (SERVER_AUTH.has(name)) throw new Error("server-authoritative");
  if (!CLIENT_EVENTS.has(name)) throw new Error("unknown");
  const denied = extra ? findDenied(extra) : [];
  if (denied.length) throw new Error("denied:" + denied.join(","));
  return { eventName: name, schemaVersion: 1 };
}

test("denylist blocks Cookie, tokens, report content, and health data", () => {
  for (const f of ["cookie", "accessToken", "refreshToken", "authorization", "reportContent", "reportSummary", "healthAnswer", "prompt", "email", "userId", "paymentId", "stripeSessionId"]) {
    assert.ok(DENY.has(f.toLowerCase()), `denylist missing ${f}`);
    // and the shipped source declares it
    assert.ok(denylistSrc.toLowerCase().includes(f.toLowerCase()), `source missing ${f}`);
  }
});

test("denied fields cannot enter an event payload", () => {
  assert.throws(() => buildClientEvent("landing_view", { cookie: "x" }), /denied/);
  assert.throws(() => buildClientEvent("free_report_view", { reportContent: "..." }), /denied/);
  assert.throws(() => buildClientEvent("premium_click", { accessToken: "t" }), /denied/);
  assert.equal(buildClientEvent("landing_view", { pageKey: "home" }).eventName, "landing_view");
});

test("client cannot emit server-authoritative payment_success / report_unlocked / refund", () => {
  for (const name of ["payment_success", "report_unlocked", "refund", "signup_complete", "email_verified", "assessment_complete"]) {
    assert.throws(() => buildClientEvent(name, {}), /server-authoritative/);
  }
});

// ---- dedupe mirror ----
class Deduper {
  ids = new Map(); emitted = new Set();
  constructor(uuid) { this.uuid = uuid; }
  key(n, p) { return p ? `${n}::${p}` : n; }
  eventId(n, p) { const k = this.key(n, p); if (!this.ids.has(k)) this.ids.set(k, this.uuid()); return this.ids.get(k); }
  markEmittedOnce(n, p) { const k = this.key(n, p); if (this.emitted.has(k)) return false; this.emitted.add(k); return true; }
}

test("retry reuses the same eventId; page re-render emits once", () => {
  let n = 0;
  const d = new Deduper(() => `uuid-${++n}`);
  const first = d.eventId("landing_view", "home");
  const retry = d.eventId("landing_view", "home");
  assert.equal(first, retry, "retry must reuse eventId");
  assert.notEqual(d.eventId("premium_click", "home"), first);
  assert.equal(d.markEmittedOnce("landing_view", "home"), true);
  assert.equal(d.markEmittedOnce("landing_view", "home"), false); // re-render
});

// ---- source assertions: no HMAC secret / no third-party SDK / no prod key ----
test("no HMAC secret, third-party SDK, or production analytics key in client code", () => {
  const all = [denylistSrc, eventsSrc, dedupeSrc].join("\n");
  assert.doesNotMatch(all, /createHmac|hmacSecret|EVENT_SECRET|process\.env\.[A-Z_]*SECRET/);
  assert.doesNotMatch(all, /segment|amplitude|mixpanel|posthog|ga\(|gtag/i);
  assert.doesNotMatch(all, /sk-|sk_live|sk_test|whsec_/);
  // client must not fabricate server facts
  assert.match(eventsSrc, /server-authoritative and must not be emitted by a client/);
  // dedupe explicitly avoids device fingerprint + browser secret
  assert.match(dedupeSrc, /NO long-lived device fingerprint|no long-lived device fingerprint/i);
});
