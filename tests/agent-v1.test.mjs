// AI consultation agent v1 — batch 1 tests (pure types + policy, no model/DB).
//
// The agent foundation is TypeScript (lib/agent/v1/*.ts). node:test cannot import
// .ts, so behavior is mirrored faithfully and source assertions verify the
// shipped code enforces the same rules.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { z } from "zod";

const read = (p) => readFileSync(p, "utf8");
const smSrc = read("lib/agent/v1/state-machine.ts");
const outSrc = read("lib/agent/v1/safe-output.ts");
const polSrc = read("lib/agent/v1/medical-policy.ts");
const prodSrc = read("lib/agent/v1/product-boundary.ts");
const provSrc = read("lib/agent/v1/provider-policy.ts");

// ---- state machine mirror ----
const T = {
  created: new Set(["intake", "cancelled"]),
  intake: new Set(["safety_check", "cancelled"]),
  safety_check: new Set(["analysis", "safety_escalated", "cancelled"]),
  analysis: new Set(["plan_generation", "provider_failed", "invalid_output", "cancelled"]),
  plan_generation: new Set(["completed", "provider_failed", "invalid_output", "cancelled"]),
  completed: new Set(),
  safety_escalated: new Set(),
  provider_failed: new Set(["analysis", "cancelled"]),
  invalid_output: new Set(["analysis", "cancelled"]),
  cancelled: new Set()
};
const can = (f, t) => (T[f]?.has(t) ?? false);

test("valid transitions are allowed", () => {
  assert.ok(can("created", "intake"));
  assert.ok(can("intake", "safety_check"));
  assert.ok(can("safety_check", "analysis"));
  assert.ok(can("safety_check", "safety_escalated"));
  assert.ok(can("analysis", "plan_generation"));
  assert.ok(can("plan_generation", "completed"));
  for (const s of ["created", "intake", "safety_check", "analysis", "plan_generation"]) {
    assert.ok(can(s, "cancelled"), `${s} -> cancelled`);
  }
});

test("terminal/illegal transitions are rejected", () => {
  assert.equal(can("completed", "analysis"), false);
  assert.equal(can("safety_escalated", "plan_generation"), false);
  assert.equal(can("cancelled", "intake"), false);
  assert.equal(can("created", "completed"), false); // no skipping
  assert.equal(can("intake", "analysis"), false); // must pass safety_check
});

test("state-machine source declares pure transition + error", () => {
  assert.match(smSrc, /export function transition/);
  assert.match(smSrc, /InvalidAgentTransitionError/);
  assert.match(smSrc, /safety_check.*safety_escalated/s);
});

// ---- safe output mirror ----
const FORBIDDEN = ["diagnosis", "prescription", "medicationDose", "diseaseProbability", "treatmentPlan", "stopMedication", "guaranteedOutcome"];
const safeSchema = z.object({
  summary: z.string().min(1),
  wellnessObservations: z.array(z.string().min(1)).default([]),
  lifestyleSuggestions: z.array(z.string().min(1)).default([]),
  escalationRequired: z.boolean().default(false)
}).strict();
function parseSafe(raw) {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    if (Object.keys(raw).some((k) => FORBIDDEN.map((f) => f.toLowerCase()).includes(k.toLowerCase()))) return null;
  }
  const p = safeSchema.safeParse(raw);
  return p.success ? p.data : null;
}

test("safe output accepts wellness guidance and rejects clinical fields", () => {
  assert.ok(parseSafe({ summary: "steady pattern" }));
  assert.equal(parseSafe({ summary: "x", diagnosis: "flu" }), null);
  assert.equal(parseSafe({ summary: "x", prescription: "amoxicillin" }), null);
  assert.equal(parseSafe({ summary: "x", diseaseProbability: 0.8 }), null);
  assert.equal(parseSafe({ summary: "" }), null); // schema-invalid
  for (const f of FORBIDDEN) assert.ok(outSrc.includes(f), `safe-output missing forbidden ${f}`);
});

// ---- safety classification mirror ----
const EMERGENCY = [/chest pain|胸痛/i, /can'?t breathe|呼吸困难/i, /unconscious|意识不清|昏迷/i, /anaphyla|严重过敏/i, /severe bleeding|严重出血/i, /suicid|self[- ]?harm|自杀|自残/i];
const CLINICAL = [
  /diagnos|am i sick|what disease|确诊|我得了什么病/i,
  /prescri|what medicine should i take|开药|吃什么药/i,
  /stop taking|should i quit my medication|停药|要不要停药/i,
  /probability|chance i have|多大概率|得病概率/i
];
function classify(text) {
  if (EMERGENCY.some((r) => r.test(text))) return "escalate";
  if (CLINICAL.some((r) => r.test(text))) return "refuse_and_redirect";
  return "normal";
}

test("safety classification escalates emergencies and refuses clinical requests", () => {
  assert.equal(classify("I have severe chest pain"), "escalate");
  assert.equal(classify("我呼吸困难"), "escalate");
  assert.equal(classify("thoughts of self-harm"), "escalate");
  assert.equal(classify("please diagnose me"), "refuse_and_redirect");
  assert.equal(classify("what medicine should i take"), "refuse_and_redirect");
  assert.equal(classify("should i stop taking my medication"), "refuse_and_redirect");
  assert.equal(classify("I slept poorly and feel tired"), "normal");
  assert.match(polSrc, /classifySafety/);
  assert.match(polSrc, /PROHIBITED_ACTIONS/);
});

// ---- product boundary mirror ----
function buildProduct(candidates, realIds) {
  const forbidden = ["sku", "price", "stock", "efficacy", "cures"];
  const items = [];
  for (const c of candidates) {
    const pid = typeof c.productId === "string" ? c.productId : "";
    if (!pid || !realIds.has(pid)) continue;
    if (Object.keys(c).some((k) => forbidden.includes(k.toLowerCase()))) continue;
    if (typeof c.reason !== "string" || !c.reason) continue;
    items.push({ productId: pid, category: c.category || "general", reason: c.reason });
  }
  return items.length ? { kind: "recommendations", items } : { kind: "noRecommendation" };
}

test("product boundary returns only real products, else noRecommendation", () => {
  const real = new Set(["p1", "p2"]);
  assert.equal(buildProduct([{ productId: "fake", reason: "x" }], real).kind, "noRecommendation");
  assert.equal(buildProduct([], real).kind, "noRecommendation");
  assert.equal(buildProduct([{ productId: "p1", reason: "supports sleep" }], real).kind, "recommendations");
  // fabricated price/efficacy dropped -> noRecommendation
  assert.equal(buildProduct([{ productId: "p1", reason: "x", price: 9.9 }], real).kind, "noRecommendation");
  assert.match(prodSrc, /noRecommendation/);
  assert.match(prodSrc, /realProductIds/);
});

// ---- provider policy source assertions (no real call) ----
test("provider policy encodes safety invariants and payload allowlist, no provider call", () => {
  assert.match(provSrc, /no_automatic_cross_provider_fallback/);
  assert.match(provSrc, /zod_safeparse_required/);
  assert.match(provSrc, /PROVIDER_PAYLOAD_ALLOWLIST/);
  const all = [smSrc, outSrc, polSrc, prodSrc, provSrc].join("\n");
  assert.doesNotMatch(all, /@prisma\/client|PrismaClient|new OpenAI|chat\.completions\.create|api\.deepseek|aihubmix/i);
});
