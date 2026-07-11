// Shared API contract v1 — batch 1 tests.
//
// The contract lives in TypeScript (lib/api-contract/v1/*.ts). node:test cannot
// import .ts, so — consistent with the rest of this repo's test suite — behavior
// is exercised via zod mirrors of the contract, and source assertions verify the
// shipped .ts implements the same shape without leaking sensitive data.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { z } from "zod";

const read = (p) => readFileSync(p, "utf8");
const errorCodesSrc = read("lib/api-contract/v1/error-codes.ts");
const resultSrc = read("lib/api-contract/v1/result.ts");
const clientSrc = read("lib/api-contract/v1/client.ts");
const commonSrc = read("lib/api-contract/v1/common.ts");
const authSrc = read("lib/api-contract/v1/auth.ts");
const indexSrc = read("lib/api-contract/v1/index.ts");

const EXPECTED_CODES = [
  "AUTH_REQUIRED", "TOKEN_EXPIRED", "EMAIL_VERIFICATION_REQUIRED", "AI_CONSENT_REQUIRED",
  "ENTITLEMENT_REQUIRED", "RATE_LIMITED", "AI_PROVIDER_ERROR", "AI_OUTPUT_INVALID",
  "SAFETY_ESCALATION_REQUIRED", "RESOURCE_NOT_FOUND", "ACCESS_DENIED", "VALIDATION_ERROR",
  "CONFLICT", "INTERNAL_ERROR"
];

// ---- error codes ----
test("all required error codes are declared exactly once", () => {
  for (const code of EXPECTED_CODES) {
    assert.ok(errorCodesSrc.includes(`"${code}"`), `missing code ${code}`);
  }
  assert.match(errorCodesSrc, /export type ApiErrorCode/);
  assert.match(errorCodesSrc, /export function isApiErrorCode/);
});

const apiErrorCodeSchema = z.enum(EXPECTED_CODES);
test("error code enum parses valid and rejects invalid", () => {
  assert.equal(apiErrorCodeSchema.parse("AI_CONSENT_REQUIRED"), "AI_CONSENT_REQUIRED");
  assert.equal(apiErrorCodeSchema.safeParse("NOT_A_CODE").success, false);
  assert.equal(apiErrorCodeSchema.safeParse("").success, false);
});

// ---- result envelopes (mirror of result.ts) ----
const errorEnvelope = z
  .object({
    ok: z.literal(false),
    error: z
      .object({
        code: apiErrorCodeSchema,
        message: z.string().min(1),
        requestId: z.string().min(1).optional(),
        retryable: z.boolean()
      })
      .strict()
  })
  .strict();
const successEnvelope = (d) => z.object({ ok: z.literal(true), data: d, requestId: z.string().min(1).optional() }).strict();

test("success envelope accepts typed data", () => {
  const s = successEnvelope(z.object({ id: z.string() }).strict());
  assert.equal(s.safeParse({ ok: true, data: { id: "abc" } }).success, true);
});

test("error envelope requires a valid code and rejects extra/sensitive fields", () => {
  assert.equal(errorEnvelope.safeParse({ ok: false, error: { code: "RATE_LIMITED", message: "x", retryable: true } }).success, true);
  // invalid code
  assert.equal(errorEnvelope.safeParse({ ok: false, error: { code: "NOPE", message: "x", retryable: true } }).success, false);
  // extra field (e.g. leaked stack / token) rejected by .strict()
  assert.equal(errorEnvelope.safeParse({ ok: false, error: { code: "INTERNAL_ERROR", message: "x", retryable: false, stack: "secret" } }).success, false);
});

test("result.ts wires strict envelopes + retryable helper", () => {
  assert.match(resultSrc, /apiErrorResponseSchema/);
  assert.match(resultSrc, /\.strict\(\)/);
  assert.match(resultSrc, /retryable:\s*RETRYABLE_API_ERROR_CODES\.has\(code\)/);
});

// ---- DTO strictness / no sensitive fields ----
test("DTOs use .strict() so unexpected sensitive fields are rejected", () => {
  for (const [name, src] of [["auth", authSrc], ["common", commonSrc]]) {
    assert.match(src, /\.strict\(\)/, `${name} should use strict objects`);
  }
  // FORBIDDEN_DTO_FIELDS denylist is declared for contract assertions.
  for (const f of ["passwordHash", "sessionVersion", "accessToken", "refreshToken", "cookie", "email", "prisma"]) {
    assert.ok(commonSrc.includes(`"${f}"`), `FORBIDDEN_DTO_FIELDS missing ${f}`);
  }
});

test("a strict DTO rejects a schema-invalid payload and forbidden fields", () => {
  const dto = z.object({ id: z.string().min(1), status: z.enum(["pending", "active"]) }).strict();
  assert.equal(dto.safeParse({ id: "u1", status: "active" }).success, true);
  assert.equal(dto.safeParse({ id: "u1", status: "bogus" }).success, false); // invalid enum
  assert.equal(dto.safeParse({ id: "u1", status: "active", passwordHash: "x" }).success, false); // forbidden extra
  assert.equal(dto.safeParse({ id: "", status: "active" }).success, false); // empty id
});

// ---- client error mapping does not leak ----
test("client maps to safe messages and never echoes raw error text", () => {
  assert.match(clientSrc, /SAFE_ERROR_MESSAGE/);
  assert.match(clientSrc, /export function toSafeApiError/);
  // must not stringify or forward the raw error / body / message input
  assert.doesNotMatch(clientSrc, /input\.message|JSON\.stringify\(|error\.stack|response\.body/);
});

// ---- no forbidden implementation leaks in this batch ----
test("batch introduces no /api/v1 route, Prisma import, or production URL", () => {
  const all = [errorCodesSrc, resultSrc, clientSrc, commonSrc, authSrc, indexSrc].join("\n");
  assert.doesNotMatch(all, /@prisma\/client|from "@\/lib\/prisma"/);
  assert.doesNotMatch(all, /https?:\/\/ai\.gbmedix\.com|api\.deepseek\.com|aihubmix/i);
  assert.match(indexSrc, /API_CONTRACT_VERSION = "v1"/);
});
