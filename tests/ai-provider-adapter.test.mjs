import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("provider factory selects OpenAI and DeepSeek with provider-specific keys", () => {
  const source = read("lib/ai/provider-factory.ts");

  assert.match(source, /env\.AI_PROVIDER \|\| "openai"/);
  assert.match(source, /OPENAI_API_KEY is required when AI_PROVIDER=openai/);
  assert.match(source, /DEEPSEEK_API_KEY is required when AI_PROVIDER=deepseek/);
  assert.match(source, /env\.DEEPSEEK_BASE_URL \|\| defaultDeepSeekBaseURL/);
  assert.match(source, /env\.DEEPSEEK_MODEL \|\| env\.AI_MODEL \|\| defaultDeepSeekModel/);
});

test("AI routes no longer construct OpenAI clients directly", () => {
  for (const path of [
    "app/api/assistant/route.ts",
    "app/api/consult/route.ts",
    "app/api/tcm/route.ts",
    "app/api/reports/generate/route.ts"
  ]) {
    const source = read(path);
    assert.doesNotMatch(source, /import OpenAI from "openai"/, path);
    assert.doesNotMatch(source, /new OpenAI\(/, path);
    assert.match(source, /getAIProvider\(\)/, path);
  }
});

test("structured provider output keeps JSON parsing and Zod validation gates", () => {
  const source = read("lib/ai/providers/openai-compatible.ts");

  assert.match(source, /response_format:\s*\{\s*type:\s*"json_object"\s*\}/);
  assert.match(source, /JSON\.parse\(content\)/);
  assert.match(source, /schema\.safeParse\(rawJson\)/);
  assert.match(source, /AI report output was not valid JSON\./);
  assert.match(source, /AI report output failed schema validation\./);
});

test("provider payloads are minimized before model calls", () => {
  const sanitize = read("lib/ai/sanitize.ts");
  const provider = read("lib/ai/providers/openai-compatible.ts");

  for (const key of ["email", "userid", "paymentid", "entitlementid", "ip"]) {
    assert.match(sanitize, new RegExp(`"${key}"`));
  }
  assert.match(provider, /buildMinimalHealthPayload\(input\.payload\)/);
  assert.match(provider, /sanitizeAIInput\(message\.content\)/);
});

test("medical safety prompt remains centralized for all providers", () => {
  const prompts = read("lib/ai/prompts.ts");

  assert.match(prompts, /Never diagnose diseases\./);
  assert.match(prompts, /Never treat conditions\./);
  assert.match(prompts, /Never prescribe medicine/);
  assert.match(prompts, /Never provide disease probability\./);
  assert.match(prompts, /Never provide clinical triage direction\./);
});

test("AIUsage records provider and model without breaking premium guards", () => {
  const schema = read("prisma/schema.prisma");
  const aiSecurity = read("lib/ai-security.ts");
  const reportGenerate = read("app/api/reports/generate/route.ts");

  assert.match(schema, /provider\s+String\s+@default\("openai"\)/);
  assert.match(schema, /@@index\(\[provider, model\]\)/);
  assert.match(aiSecurity, /provider:\s*string/);
  assert.match(aiSecurity, /estimateCost\(\{\s*provider,\s*model,\s*tokens\s*\}\)/);
  assert.match(reportGenerate, /checkEntitlement/);
  assert.match(reportGenerate, /premium_health_report/);
});
