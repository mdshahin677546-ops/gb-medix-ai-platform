// AI failure diagnostics — allowlist-only logging.
//
// lib/ai/diagnostics.ts must emit a single structured line containing ONLY an
// allowlisted set of fields (provider, model, endpoint, httpStatus, errorType,
// errorCode, requestId, stage, retryable). It must never log raw error text,
// prompts, health content, request/response payloads, email, userId, cookies,
// tokens, or secrets.
//
// Behavioral tests mirror the upstream-error field extraction + retryable rule
// and the allowlist object shape; source assertions verify the shipped module
// logs only the allowlisted object.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const diagSource = readFileSync("lib/ai/diagnostics.ts", "utf8");

const ALLOWLIST = [
  "provider",
  "model",
  "endpoint",
  "httpStatus",
  "errorType",
  "errorCode",
  "requestId",
  "stage",
  "retryable"
];

// ---- Mirror of the upstream-error branch of describeAIError ----
function readString(obj, key) {
  if (obj && typeof obj === "object" && key in obj) {
    const v = obj[key];
    if (typeof v === "string" && v) return v;
    if (typeof v === "number") return String(v);
  }
  return undefined;
}
function readNumber(obj, key) {
  if (obj && typeof obj === "object" && key in obj) {
    const v = obj[key];
    if (typeof v === "number") return v;
  }
  return undefined;
}
function describeUpstream(error) {
  const httpStatus = readNumber(error, "status");
  const errorType =
    readString(error, "type") ?? (error && error.name) ?? "UnknownError";
  const errorCode = readString(error, "code");
  const requestId = readString(error, "request_id") ?? readString(error, "requestID");
  const retryable =
    typeof httpStatus === "number"
      ? httpStatus === 408 || httpStatus === 409 || httpStatus === 429 || httpStatus >= 500
      : false;
  return { httpStatus, errorType, errorCode, requestId, stage: "upstream_request", retryable };
}

function buildDiagnostic(input, described) {
  return {
    provider: input.provider,
    model: input.model,
    endpoint: input.endpoint,
    httpStatus: described.httpStatus,
    errorType: described.errorType,
    errorCode: described.errorCode,
    requestId: described.requestId,
    stage: input.stage ?? described.stage,
    retryable: described.retryable
  };
}

test("5xx / 429 / 408 / 409 upstream errors are retryable; 4xx are not", () => {
  for (const s of [500, 502, 503, 504, 429, 408, 409]) {
    assert.equal(describeUpstream({ status: s }).retryable, true, `status ${s}`);
  }
  for (const s of [400, 401, 403, 404, 422]) {
    assert.equal(describeUpstream({ status: s }).retryable, false, `status ${s}`);
  }
  assert.equal(describeUpstream({}).retryable, false); // no status
});

test("upstream diagnostic reads only structured fields", () => {
  const err = {
    status: 502,
    type: "api_error",
    code: "bad_gateway",
    request_id: "req_123",
    message: "SENSITIVE upstream text that must never be logged"
  };
  const d = describeUpstream(err);
  assert.equal(d.httpStatus, 502);
  assert.equal(d.errorType, "api_error");
  assert.equal(d.errorCode, "bad_gateway");
  assert.equal(d.requestId, "req_123");
  assert.equal(d.stage, "upstream_request");
  assert.equal(d.retryable, true);
});

test("the serialized diagnostic contains only allowlisted keys", () => {
  const err = { status: 500, type: "api_error", request_id: "req_9", message: "secret text" };
  const diagnostic = buildDiagnostic(
    { provider: "deepseek", model: "deepseek-chat", endpoint: "/api/tcm" },
    describeUpstream(err)
  );
  const serialized = JSON.parse(JSON.stringify(diagnostic));
  for (const key of Object.keys(serialized)) {
    assert.ok(ALLOWLIST.includes(key), `unexpected key leaked: ${key}`);
  }
  // No sensitive value made it through.
  const dump = JSON.stringify(serialized);
  assert.doesNotMatch(dump, /secret text/);
  assert.doesNotMatch(dump, /SENSITIVE/);
  assert.equal(serialized.provider, "deepseek");
  assert.equal(serialized.model, "deepseek-chat");
});

// ---- Source assertions: shipped module logs only the allowlisted object ----

test("diagnostics logs only the typed allowlist object, never the raw error", () => {
  assert.match(diagSource, /const diagnostic: AIDiagnostic = \{/);
  assert.match(diagSource, /console\.error\("ai_provider_diagnostic", JSON\.stringify\(diagnostic\)\)/);
  // Never serialize or log the raw error, its message, or a stringified error.
  assert.doesNotMatch(diagSource, /JSON\.stringify\(error\)/);
  assert.doesNotMatch(diagSource, /error\.message/);
  assert.doesNotMatch(diagSource, /String\(error\)/);
  assert.doesNotMatch(diagSource, /console\.error\([^)]*error\b(?!Type|Code)/);
});

test("failure stages and retryable flag are modeled", () => {
  assert.match(diagSource, /"provider_init"/);
  assert.match(diagSource, /"upstream_request"/);
  assert.match(diagSource, /"json_parse"/);
  assert.match(diagSource, /"schema_validation"/);
  assert.match(diagSource, /"database_write"/);
  assert.match(diagSource, /retryable/);
});

test("AIProviderOutputError carries a stage used by diagnostics", () => {
  const typesSource = readFileSync("lib/ai/providers/types.ts", "utf8");
  assert.match(typesSource, /readonly stage: AIOutputFailureStage/);
  assert.match(diagSource, /error\.stage/);
});
