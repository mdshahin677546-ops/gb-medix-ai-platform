// DeepSeek 502 fix v2 — strict top-level JSON object extraction.
//
// The provider (lib/ai/providers/openai-compatible.ts) must extract EXACTLY ONE
// top-level JSON object from model output, then still enforce JSON.parse +
// ReportSchema.safeParse. It uses a string/escape/brace-aware scan (no naive
// indexOf('{')/lastIndexOf('}')), and rejects: top-level arrays (incl. single
// element), multiple parallel objects, an object followed by another value,
// truncated/unbalanced input, and empty input. Invalid output -> safe 502, and
// the model's raw text is never stored (the route marks the placeholder report
// "failed" as an audit record).
//
// Behavioral tests mirror the extractor; source assertions verify the shipped
// code implements it without relaxing validation or adding a fallback.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { z } from "zod";

const providerSource = readFileSync("lib/ai/providers/openai-compatible.ts", "utf8");
const promptsSource = readFileSync("lib/ai/prompts.ts", "utf8");
const schemaSource = readFileSync("lib/report-schema.ts", "utf8");

// ---- Mirror of extractTopLevelJsonObject + scanBalancedObjectEnd ----
function scanBalancedObjectEnd(s, start) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function extractTopLevelJsonObject(text) {
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const body = (fenced ? fenced[1] : trimmed).trim();
  if (!body) return null;
  if (body[0] === "[") return null;
  const start = body.indexOf("{");
  if (start === -1) return null;
  if (body.slice(0, start).includes("[")) return null;
  const end = scanBalancedObjectEnd(body, start);
  if (end === -1) return null;
  const after = body.slice(end + 1);
  if (after.includes("{") || after.includes("[")) return null;
  return body.slice(start, end + 1);
}

const MiniReportSchema = z.object({
  healthScore: z.number().int().min(0).max(100),
  constitution: z.string().min(1),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH"]),
  summary: z.string().min(1)
});

// Full provider pipeline: extract -> JSON.parse -> Zod safeParse.
function runPipeline(content) {
  const candidate = extractTopLevelJsonObject(content);
  if (candidate === null) return { ok: false, stage: "extract" };
  let rawJson;
  try {
    rawJson = JSON.parse(candidate);
  } catch {
    return { ok: false, stage: "json" };
  }
  const parsed = MiniReportSchema.safeParse(rawJson);
  if (!parsed.success) return { ok: false, stage: "schema" };
  return { ok: true, data: parsed.data };
}

const VALID = JSON.stringify({
  healthScore: 82,
  constitution: "balanced",
  riskLevel: "LOW",
  summary: "steady wellness pattern"
});

// ---------------- required behavioral coverage ----------------

test("top-level array is rejected", () => {
  assert.equal(extractTopLevelJsonObject("[1, 2, 3]"), null);
});

test("single-element array is rejected (even with a valid inner object)", () => {
  assert.equal(extractTopLevelJsonObject('[{"healthScore":82}]'), null);
  // ...including with leading prose before the array.
  assert.equal(extractTopLevelJsonObject('result: [{"healthScore":82}]'), null);
});

test("nested object passes and preserves nesting", () => {
  const candidate = extractTopLevelJsonObject('{"a":{"b":{"c":1}}}');
  assert.notEqual(candidate, null);
  assert.deepEqual(JSON.parse(candidate), { a: { b: { c: 1 } } });
});

test("braces inside string values do not break extraction", () => {
  const src = '{"summary":"score is } odd { and nested \\" quote","healthScore":50}';
  const candidate = extractTopLevelJsonObject(src);
  assert.notEqual(candidate, null);
  const obj = JSON.parse(candidate);
  assert.equal(obj.summary, 'score is } odd { and nested " quote');
  assert.equal(obj.healthScore, 50);
});

test("multiple parallel objects are rejected", () => {
  assert.equal(extractTopLevelJsonObject('{"a":1}{"b":2}'), null);
  assert.equal(extractTopLevelJsonObject('{"a":1} {"b":2}'), null);
});

test("an object followed by a second object is rejected", () => {
  assert.equal(extractTopLevelJsonObject(VALID + "\n" + VALID), null);
});

test("truncated / unbalanced object is rejected", () => {
  assert.equal(extractTopLevelJsonObject('{"a":1'), null);
  assert.equal(extractTopLevelJsonObject('{"a":{"b":1}'), null);
});

test("```json code fence object passes", () => {
  const candidate = extractTopLevelJsonObject("```json\n" + VALID + "\n```");
  assert.notEqual(candidate, null);
  assert.equal(runPipeline("```json\n" + VALID + "\n```").ok, true);
});

test("a single object wrapped in prose passes", () => {
  const wrapped = "Here is your report:\n" + VALID + "\nThank you.";
  assert.notEqual(extractTopLevelJsonObject(wrapped), null);
  assert.equal(runPipeline(wrapped).ok, true);
});

test("valid JSON but schema-invalid is rejected at the schema stage", () => {
  const bad = JSON.stringify({
    healthScore: 200, // out of range
    constitution: "balanced",
    riskLevel: "LOW",
    summary: "x"
  });
  const r = runPipeline(bad);
  assert.equal(r.ok, false);
  assert.equal(r.stage, "schema");
});

test("empty content is rejected", () => {
  assert.equal(extractTopLevelJsonObject(""), null);
  assert.equal(extractTopLevelJsonObject("   \n  "), null);
  assert.equal(runPipeline("").stage, "extract");
});

test("a plain valid object passes end to end", () => {
  assert.equal(runPipeline(VALID).ok, true);
});

// ---------------- source assertions on the shipped code ----------------

test("provider extracts a single top-level object without naive indexOf/lastIndexOf", () => {
  assert.match(providerSource, /extractTopLevelJsonObject/);
  assert.match(providerSource, /scanBalancedObjectEnd/);
  // string/escape awareness present
  assert.match(providerSource, /inString/);
  assert.match(providerSource, /escaped/);
  // the naive lastIndexOf("}") extraction must be gone
  assert.doesNotMatch(providerSource, /lastIndexOf\(/);
});

test("provider still enforces json_object + JSON.parse + Zod, with safe errors", () => {
  assert.match(providerSource, /response_format:\s*\{\s*type:\s*"json_object"\s*\}/);
  assert.match(providerSource, /JSON\.parse\(candidate\)/);
  assert.match(providerSource, /input\.schema\.safeParse\(rawJson\)/);
  assert.match(providerSource, /throw new AIProviderOutputError\("AI report output was not valid JSON\.", "json_parse"\)/);
  assert.match(providerSource, /throw new AIProviderOutputError\("AI report output failed schema validation\.", "schema_validation"\)/);
});

test("no automatic provider fallback and no relaxed schema", () => {
  assert.doesNotMatch(providerSource, /getAIProvider|OpenAIProvider|fallbackProvider/i);
  assert.match(schemaSource, /healthScore:\s*z\.number\(\)\.int\(\)\.min\(0\)\.max\(100\)/);
  assert.match(schemaSource, /riskLevel:\s*z\.enum\(\["LOW", "MEDIUM", "HIGH"\]\)/);
  assert.match(schemaSource, /recommendations:\s*z\.array\(RecommendationSchema\)\.min\(1\)/);
});

test("medical-safety prompt is preserved", () => {
  assert.match(promptsSource, /Safety rules:/);
  assert.match(promptsSource, /Never diagnose diseases\./);
  assert.match(promptsSource, /medicalSafetyPrompt/);
});
