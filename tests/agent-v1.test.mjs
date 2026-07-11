// AI consultation agent v1 — tests that execute the REAL implementation.
//
// The real lib/agent/v1 sources are compiled (project tsc -> CommonJS in a
// repo-local temp dir) and required. Assertions run against the actual exported
// classifier / state machine / Zod schemas / product + provider policy — no
// mirrored regex, state tables, or schemas.

import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";

const SRC = "lib/agent/v1";
const outDir = mkdtempSync(join(process.cwd(), ".tmp-agent-"));
const requireCjs = createRequire(import.meta.url);
const tsFiles = readdirSync(SRC).filter((f) => f.endsWith(".ts")).map((f) => join(SRC, f));
execFileSync(
  process.execPath,
  ["node_modules/typescript/bin/tsc", ...tsFiles, "--outDir", outDir, "--rootDir", SRC,
   "--module", "commonjs", "--target", "es2020", "--moduleResolution", "node", "--esModuleInterop", "--skipLibCheck"],
  { stdio: "pipe" }
);
const agent = requireCjs(resolve(outDir, "index.js"));
test.after(() => rmSync(outDir, { recursive: true, force: true }));

const cls = (t) => agent.classifySafety(t).classification;
const cat = (t) => agent.classifySafety(t).category;

// ---- Codex P1 examples: none may return "normal" ----
test("P1: 我是不是心脏病 -> diagnosis_request (not normal)", () => {
  assert.equal(cls("我是不是心脏病"), "refuse_and_redirect");
  assert.equal(cat("我是不是心脏病"), "diagnosis_request");
});
test("P1: 二甲双胍应该吃多少 -> medication request (not normal)", () => {
  assert.equal(cls("二甲双胍应该吃多少"), "refuse_and_redirect");
  assert.equal(cat("二甲双胍应该吃多少"), "medication_or_prescription_request");
});
test("P1: 保证能治好吗 -> guaranteed_outcome_request (not normal)", () => {
  assert.equal(cls("保证能治好吗"), "refuse_and_redirect");
  assert.equal(cat("保证能治好吗"), "guaranteed_outcome_request");
});

// ---- full CN/EN medical boundary matrix ----
test("diagnosis requests are refused and redirected", () => {
  for (const t of ["我得的是什么病", "帮我确诊", "这是癌症吗", "do I have heart disease", "diagnose me"]) {
    assert.equal(cls(t), "refuse_and_redirect", t);
    assert.equal(cat(t), "diagnosis_request", t);
  }
});
test("medication / prescription requests are refused", () => {
  for (const t of ["这个药一天吃几次", "给我开药", "what dose should I take", "what medicine should I take"]) {
    assert.equal(cls(t), "refuse_and_redirect", t);
    assert.equal(cat(t), "medication_or_prescription_request", t);
  }
});
test("medication change requests are refused", () => {
  for (const t of ["我可以停药吗", "帮我调整剂量", "can I stop taking this medication"]) {
    assert.equal(cls(t), "refuse_and_redirect", t);
    assert.equal(cat(t), "medication_change_request", t);
  }
});
test("disease probability requests are refused", () => {
  for (const t of ["我患癌概率多少", "有多大可能是心脏病", "what is the probability I have cancer"]) {
    assert.equal(cls(t), "refuse_and_redirect", t);
    assert.equal(cat(t), "disease_probability_request", t);
  }
});
test("guaranteed outcome requests are refused", () => {
  for (const t of ["一定会好吗", "can you guarantee a cure", "will this definitely cure me"]) {
    assert.equal(cls(t), "refuse_and_redirect", t);
    assert.equal(cat(t), "guaranteed_outcome_request", t);
  }
});

// ---- emergencies + self-harm escalate ----
test("emergencies and self-harm escalate", () => {
  for (const t of ["I have severe chest pain", "我呼吸困难", "他失去意识了", "严重过敏", "大出血", "thoughts of self-harm", "我想不开"]) {
    assert.equal(cls(t), "escalate", t);
  }
});

// ---- negation / quotation context ----
test("negation and quotation do not trigger false positives", () => {
  assert.equal(cls("我没有胸痛"), "normal"); // negated symptom
  assert.notEqual(cls('文章里写着“我是不是心脏病”'), "escalate"); // quoted
  assert.notEqual(cls('文章里写着“我是不是心脏病”'), "refuse_and_redirect");
  assert.equal(cls("医生已经告诉我不要自行停药"), "normal"); // report, not a request
  assert.equal(cls("我睡不好，感觉有点累"), "normal"); // benign
});

// ---- state machine (real) ----
test("state machine allows valid and rejects invalid transitions", () => {
  assert.ok(agent.canTransition("created", "intake"));
  assert.ok(agent.canTransition("safety_check", "safety_escalated"));
  assert.ok(agent.canTransition("plan_generation", "completed"));
  assert.equal(agent.canTransition("completed", "analysis"), false);
  assert.equal(agent.canTransition("safety_escalated", "plan_generation"), false);
  assert.equal(agent.canTransition("intake", "analysis"), false);
  assert.ok(agent.isTerminal("completed"));
  assert.ok(agent.isTerminal("cancelled"));
  assert.equal(agent.isTerminal("intake"), false);
  assert.throws(() => agent.transition("completed", "analysis"), /Invalid agent transition/);
  assert.equal(agent.transition("created", "intake"), "intake");
});

// ---- safe output schema (real Zod) ----
test("safe output rejects every forbidden clinical field", () => {
  assert.ok(agent.parseSafeOutput({ summary: "steady wellness pattern" }));
  for (const f of agent.FORBIDDEN_OUTPUT_FIELDS) {
    assert.equal(agent.parseSafeOutput({ summary: "x", [f]: "leak" }), null, `should reject ${f}`);
  }
  for (const f of ["diagnosis", "diseaseName", "prescription", "medicationDose", "diseaseProbability", "treatmentPlan", "triageConclusion", "stopMedication", "guaranteedOutcome"]) {
    assert.ok(agent.FORBIDDEN_OUTPUT_FIELDS.includes(f), `missing forbidden ${f}`);
  }
  assert.equal(agent.parseSafeOutput({ summary: "" }), null); // schema-invalid
});

// ---- product boundary: dangerous fields fail explicitly ----
test("product boundary fails on dangerous fields; noRecommendation only when genuinely empty", () => {
  const real = new Set(["p1", "p2"]);
  for (const bad of ["price", "inventory", "sku", "efficacy", "treatmentClaim", "diseaseClaim", "guaranteedOutcome"]) {
    const r = agent.buildProductResult({ candidates: [{ productId: "p1", reason: "x", [bad]: 1 }], realProductIds: real });
    assert.equal(r.kind, "invalid_input", `dangerous field ${bad} must be invalid_input`);
    assert.ok(r.offendingFields.includes(bad));
  }
  assert.equal(agent.buildProductResult({ candidates: [], realProductIds: real }).kind, "noRecommendation");
  assert.equal(agent.buildProductResult({ candidates: [{ productId: "fake", reason: "x" }], realProductIds: real }).kind, "noRecommendation");
  assert.equal(agent.buildProductResult({ candidates: [{ productId: "p1", reason: "supports sleep" }], realProductIds: real }).kind, "recommendations");
});

// ---- provider policy helpers (real) ----
test("provider policy: payload denylist + invariants", () => {
  assert.equal(agent.isProviderPayloadDenied("accessToken"), true);
  assert.equal(agent.isProviderPayloadDenied("email"), true);
  assert.equal(agent.isProviderPayloadDenied("sleep"), false);
  assert.ok(agent.PROVIDER_SAFETY_INVARIANTS.includes("no_automatic_cross_provider_fallback"));
  assert.ok(agent.PROVIDER_SAFETY_INVARIANTS.includes("zod_safeparse_required"));
});
