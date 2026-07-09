import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("v1 gates third-party AI providers but not OpenAI", () => {
  const policy = read("lib/ai-consent/consent-policy.ts");

  for (const provider of ["deepseek", "qwen", "kimi", "glm", "doubao"]) {
    assert.match(policy, new RegExp(`"${provider}"`));
  }
  assert.doesNotMatch(policy, /"openai"/);
  assert.match(policy, /AI_CONSENT_VERSION = "2026-07-09-v1"/);
});

test("consent model supports revoke and versioned active consent", () => {
  const schema = read("prisma/schema.prisma");
  const migration = read("prisma/migrations/20260709130000_ai_processing_consent/migration.sql");

  assert.match(schema, /model AIProcessingConsent/);
  assert.match(schema, /revokedAt\s+DateTime\?/);
  assert.match(schema, /updatedAt\s+DateTime\s+@updatedAt/);
  assert.match(schema, /@@index\(\[userId, provider, consentVersion, revokedAt\]\)/);
  assert.match(migration, /CREATE TABLE "AIProcessingConsent"/);
  assert.match(migration, /"revokedAt" TIMESTAMP\(3\)/);
});

test("consent APIs use current authenticated user and server-side provider", () => {
  for (const path of [
    "app/api/ai-consent/status/route.ts",
    "app/api/ai-consent/accept/route.ts",
    "app/api/ai-consent/revoke/route.ts"
  ]) {
    const source = read(path);
    assert.match(source, /getCurrentUser\(\)/, path);
    assert.match(source, /getConfiguredAIProviderName\(\)/, path);
    assert.doesNotMatch(source, /userId.*request|provider.*request/i, path);
  }

  const accept = read("app/api/ai-consent/accept/route.ts");
  assert.match(accept, /accepted:\s*z\.literal\(true\)/);
});

test("AI routes enforce consent before provider calls", () => {
  for (const path of [
    "app/api/assistant/route.ts",
    "app/api/consult/route.ts",
    "app/api/tcm/route.ts",
    "app/api/reports/generate/route.ts"
  ]) {
    const source = read(path);
    assert.match(source, /ensureAIConsentForProvider\(user\.id, providerName\)/, path);
    assert.match(source, /AI_CONSENT_REQUIRED/, path);
    assert.match(source, /getAIProvider\(\)/, path);
  }
});

test("premium report still requires entitlement separately from consent", () => {
  const source = read("app/api/reports/generate/route.ts");

  assert.match(source, /checkEntitlement/);
  assert.match(source, /Premium report access requires a completed payment\./);
  assert.match(source, /ensureAIConsentForProvider/);
});

test("tcm-check and dashboard expose minimal consent UI", () => {
  const form = read("app/[lang]/tcm-check/tcm-check-form.tsx");
  const dashboard = read("app/[lang]/dashboard/ai-consent-manager.tsx");

  assert.match(form, /\/api\/ai-consent\/status/);
  assert.match(form, /\/api\/ai-consent\/accept/);
  assert.match(form, /consentRequired/);
  assert.match(form, /I agree that GB Medix may use third-party AI services/);
  assert.match(dashboard, /\/api\/ai-consent\/revoke/);
  assert.match(dashboard, /Manage AI Processing Consent/);
});
