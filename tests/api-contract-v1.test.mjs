// Shared API contract v1 — tests that execute the REAL implementation.
//
// node:test cannot import .ts directly and this repo has no TS loader, so the
// real lib/api-contract/v1 sources are compiled (with the project's own tsc) to
// CommonJS in a repo-local temp dir and required. Assertions run against the
// actual exported functions/schemas — no mirrored logic, no source-string checks.

import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { z } from "zod";

const SRC = "lib/api-contract/v1";
const outDir = mkdtempSync(join(process.cwd(), ".tmp-apicontract-"));
const requireCjs = createRequire(import.meta.url);

const tsFiles = readdirSync(SRC).filter((f) => f.endsWith(".ts")).map((f) => join(SRC, f));
execFileSync(
  process.execPath,
  [
    "node_modules/typescript/bin/tsc",
    ...tsFiles,
    "--outDir", outDir,
    "--rootDir", SRC,
    "--module", "commonjs",
    "--target", "es2020",
    "--moduleResolution", "node",
    "--esModuleInterop",
    "--skipLibCheck"
  ],
  { stdio: "pipe" }
);
const api = requireCjs(resolve(outDir, "index.js"));

test.after(() => rmSync(outDir, { recursive: true, force: true }));

// 1. all error codes exist; invalid rejected
test("error codes: all present, invalid rejected (real)", () => {
  const expected = [
    "AUTH_REQUIRED", "TOKEN_EXPIRED", "EMAIL_VERIFICATION_REQUIRED", "AI_CONSENT_REQUIRED",
    "ENTITLEMENT_REQUIRED", "RATE_LIMITED", "AI_PROVIDER_ERROR", "AI_OUTPUT_INVALID",
    "SAFETY_ESCALATION_REQUIRED", "RESOURCE_NOT_FOUND", "ACCESS_DENIED", "VALIDATION_ERROR",
    "CONFLICT", "INTERNAL_ERROR"
  ];
  assert.deepEqual([...api.API_ERROR_CODES].sort(), [...expected].sort());
  for (const c of expected) assert.equal(api.isApiErrorCode(c), true);
  assert.equal(api.isApiErrorCode("NOPE"), false);
  assert.equal(api.apiErrorCodeSchema.safeParse("NOPE").success, false);
});

// 2. HTTP/retryable mapping (real functions)
test("http + retryable mapping run the real functions", () => {
  assert.equal(api.API_ERROR_HTTP_STATUS.ENTITLEMENT_REQUIRED, 402);
  assert.equal(api.errorCodeForStatus(402), "ENTITLEMENT_REQUIRED");
  assert.equal(api.errorCodeForStatus(999), "INTERNAL_ERROR");
  assert.equal(api.fail("RATE_LIMITED", "x").error.retryable, true);
  assert.equal(api.fail("ACCESS_DENIED", "x").error.retryable, false);
});

// 3. success/error Zod (real)
test("success + error envelope schemas validate (real Zod)", () => {
  const success = api.apiSuccessSchema(z.object({ id: z.string() }).strict());
  assert.equal(success.safeParse({ ok: true, data: { id: "abc" } }).success, true);
  assert.equal(success.safeParse({ ok: true, data: { id: 1 } }).success, false);
  assert.equal(api.apiErrorResponseSchema.safeParse({ ok: false, error: { code: "RATE_LIMITED", message: "x", retryable: true } }).success, true);
  assert.equal(api.apiErrorResponseSchema.safeParse({ ok: false, error: { code: "NOPE", message: "x", retryable: true } }).success, false);
});

// 4. .strict() rejects stack/cause/body/rawError/unknown
test("error envelope .strict() rejects leaked fields", () => {
  for (const extra of [{ stack: "s" }, { cause: "c" }, { body: "b" }, { rawError: "r" }, { anything: 1 }]) {
    const payload = { ok: false, error: { code: "INTERNAL_ERROR", message: "x", retryable: false, ...extra } };
    assert.equal(api.apiErrorResponseSchema.safeParse(payload).success, false);
  }
});

// 5. Auth DTOs reject passwordHash / cookie / token / provider key
test("auth DTOs reject sensitive/unknown fields (real strict)", () => {
  assert.equal(api.loginRequestSchema.safeParse({ email: "a@b.com", passwordHash: "x" }).success, false);
  assert.equal(api.meSchema.safeParse({ id: "u", status: "active", emailVerified: true, cookie: "x" }).success, false);
  assert.equal(api.authTokensSchema.safeParse({ accessToken: "a", refreshToken: "r", expiresInSeconds: 1, deepseekApiKey: "k" }).success, false);
  assert.equal(api.meSchema.safeParse({ id: "u", status: "active", emailVerified: true }).success, true);
});

// 6. Consent accept request cannot fabricate a server authorization fact
test("consent accept request cannot inject server-fact fields", () => {
  assert.equal(api.consentAcceptRequestSchema.safeParse({ consentVersion: "v1", providerScope: ["deepseek"] }).success, true);
  assert.equal(api.consentAcceptRequestSchema.safeParse({ consentVersion: "v1", providerScope: ["deepseek"], accepted: true }).success, false);
  assert.equal(api.consentAcceptRequestSchema.safeParse({ consentVersion: "v1", providerScope: ["deepseek"], acceptedAt: "2026-01-01T00:00:00Z" }).success, false);
});

// 7. Entitlement DTO cannot let a client self-declare activation
test("entitlement DTO is strict; no client activation request exists", () => {
  const valid = { id: "e1", productCode: "premium_report", resourceType: null, resourceId: null, status: "active", expiresAt: null };
  assert.equal(api.entitlementSchema.safeParse(valid).success, true);
  assert.equal(api.entitlementSchema.safeParse({ ...valid, grantedByClient: true }).success, false);
  const exported = Object.keys(api);
  assert.equal(exported.some((k) => /activate|grantEntitlement/i.test(k)), false);
});

// 8. Client safe error mapping never echoes raw error / message / body / token
test("toSafeApiError returns fixed safe messages, never raw input", () => {
  const mapped = api.toSafeApiError({ code: "AI_PROVIDER_ERROR", status: 502, requestId: "r1" });
  assert.equal(mapped.ok, false);
  assert.equal(mapped.error.code, "AI_PROVIDER_ERROR");
  assert.equal(mapped.error.retryable, true);
  assert.doesNotMatch(mapped.error.message, /secret|sk-|stacktrace|line 42/i);
  const raw = "UPSTREAM SECRET sk-leak stacktrace at line 42";
  const mapped2 = api.toSafeApiError({ status: 500, code: raw });
  assert.equal(mapped2.error.code, "INTERNAL_ERROR");
  assert.doesNotMatch(mapped2.error.message, /secret|sk-|stacktrace/i);
});
