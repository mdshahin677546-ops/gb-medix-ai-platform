// DeepSeek 502 fix — provider-layer structured JSON robustness.
//
// The 502 root cause class addressed here: OpenAI-compatible providers such as
// DeepSeek may return the JSON wrapped in a markdown code fence or with prose
// around it (even in json_object mode). The prior parser did a bare
// JSON.parse(content) and threw AIProviderOutputError -> 502.
//
// The fix (lib/ai/providers/openai-compatible.ts) extracts the JSON object
// defensively but STILL enforces JSON.parse + Zod safeParse. Invalid JSON or
// schema still throws (safe 502) and is never persisted. Schema is not relaxed,
// there is no provider fallback, and the medical-safety prompt is untouched.
//
// Behavioral tests mirror the extraction+parse+validation algorithm; source
// assertions verify the shipped code implements it.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { z } from "zod";

const providerSource = readFileSync("lib/ai/providers/openai-compatible.ts", "utf8");
const promptsSource = readFileSync("lib/ai/prompts.ts", "utf8");
const schemaSource = readFileSync("lib/report-schema.ts", "utf8");

// ---- Mirror of extractJsonObject in openai-compatible.ts ----
function extractJsonObject(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const body = (fenced ? fenced[1] : trimmed).trim();
  if (body.startsWith("{") && body.endsWith("}")) return body;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start !== -1 && end > start) return body.slice(start, end + 1);
  return body;
}

// Minimal mirror of the strict validation the provider still enforces.
const MiniReportSchema = z.object({
  healthScore: z.number().int().min(0).max(100),
  constitution: z.string().min(1),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH"]),
  summary: z.string().min(1)
});

// Same pipeline as generateStructuredJSON: extract -> JSON.parse -> safeParse.
function runPipeline(content) {
  let rawJson;
  try {
    rawJson = JSON.parse(extractJsonObject(content));
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

test("plain JSON object is accepted", () => {
  assert.equal(runPipeline(VALID).ok, true);
});

test("markdown-fenced ```json block is accepted (DeepSeek-style)", () => {
  const r = runPipeline("```json\n" + VALID + "\n```");
  assert.equal(r.ok, true);
  assert.equal(r.data.riskLevel, "LOW");
});

test("bare ``` fenced block (no json label) is accepted", () => {
  assert.equal(runPipeline("```\n" + VALID + "\n```").ok, true);
});

test("JSON surrounded by prose is extracted and accepted", () => {
  assert.equal(runPipeline("Here is your report:\n" + VALID + "\nThank you.").ok, true);
});

test("invalid JSON is still rejected at the json stage (safe 502, no DB write)", () => {
  const r = runPipeline("```json\n{ oops not json \n```");
  assert.equal(r.ok, false);
  assert.equal(r.stage, "json");
});

test("empty content is rejected (no silent success)", () => {
  const r = runPipeline("");
  assert.equal(r.ok, false);
  assert.equal(r.stage, "json");
});

test("valid JSON but schema-invalid is still rejected at the schema stage", () => {
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

test("wrong enum value is still rejected (schema not relaxed)", () => {
  const bad = JSON.stringify({
    healthScore: 50,
    constitution: "balanced",
    riskLevel: "CRITICAL", // not in enum
    summary: "x"
  });
  assert.equal(runPipeline(bad).stage, "schema");
});

// ---- Source assertions: shipped code implements the fix without regressions ----

test("provider still requests json_object and enforces JSON + Zod", () => {
  assert.match(providerSource, /response_format:\s*\{\s*type:\s*"json_object"\s*\}/);
  assert.match(providerSource, /extractJsonObject\(content\)/);
  assert.match(providerSource, /JSON\.parse\(extractJsonObject\(content\)\)/);
  assert.match(providerSource, /input\.schema\.safeParse\(rawJson\)/);
  // Both failure paths still raise a safe error (-> 502), never return bad data.
  assert.match(providerSource, /throw new AIProviderOutputError\("AI report output was not valid JSON\."\)/);
  assert.match(providerSource, /throw new AIProviderOutputError\("AI report output failed schema validation\."\)/);
});

test("no automatic provider fallback in the provider layer", () => {
  // The base provider must not silently switch providers on failure.
  assert.doesNotMatch(providerSource, /getAIProvider|OpenAIProvider|fallbackProvider|catch\s*\{[^}]*generate/i);
});

test("medical-safety prompt is preserved", () => {
  assert.match(promptsSource, /Safety rules:/);
  assert.match(promptsSource, /Never diagnose diseases\./);
  assert.match(promptsSource, /medicalSafetyPrompt/);
});

test("ReportSchema is not relaxed", () => {
  assert.match(schemaSource, /healthScore:\s*z\.number\(\)\.int\(\)\.min\(0\)\.max\(100\)/);
  assert.match(schemaSource, /riskLevel:\s*z\.enum\(\["LOW", "MEDIUM", "HIGH"\]\)/);
  assert.match(schemaSource, /recommendations:\s*z\.array\(RecommendationSchema\)\.min\(1\)/);
});
