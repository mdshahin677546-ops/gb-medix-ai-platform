// GB MEDIX AI Mobile Auth security controls - pure tests.
//
// Compiles and executes the real TypeScript modules. No DB, no network, no
// committed secret. Values used here are throwaway test-only constants and are
// never printed as credentials.

import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";

const cwd = process.cwd();
const files = [
  "lib/api-contract/v1/common.ts",
  "lib/api-contract/v1/error-codes.ts",
  "lib/api-contract/v1/result.ts",
  "lib/api-contract/v1/client.ts",
  "lib/api-contract/v1/mobile-auth.ts",
  "lib/api-v1/request-context.ts",
  "lib/api-v1/failure.ts",
  "lib/api-v1/handler-result.ts",
  "lib/api-v1/mobile-auth-boundary.ts",
  "lib/mobile-auth/v1/audit.ts",
  "lib/mobile-auth/v1/security-controls.ts"
].map((f) => join(cwd, f));

mkdirSync(join(cwd, ".tmp"), { recursive: true });
const outDir = mkdtempSync(join(cwd, ".tmp", "mauth-security-"));
const requireCjs = createRequire(import.meta.url);
const tsconfigPath = join(outDir, "tsconfig.json");
writeFileSync(tsconfigPath, JSON.stringify({
  compilerOptions: {
    outDir,
    rootDir: cwd,
    module: "commonjs",
    target: "es2020",
    lib: ["es2020", "dom"],
    moduleResolution: "node",
    esModuleInterop: true,
    skipLibCheck: true,
    strict: true,
    noEmitOnError: true
  },
  files
}));
try {
  execFileSync(process.execPath, ["node_modules/typescript/bin/tsc", "-p", tsconfigPath], { stdio: "pipe" });
} catch (error) {
  rmSync(outDir, { recursive: true, force: true });
  throw new Error("tsc compile of mobile-auth security controls failed:\n" + (error.stdout || error.message));
}
test.after(() => rmSync(outDir, { recursive: true, force: true }));

const boundary = requireCjs(resolve(outDir, "lib/api-v1/mobile-auth-boundary.js"));
const handlerResult = requireCjs(resolve(outDir, "lib/api-v1/handler-result.js"));
const audit = requireCjs(resolve(outDir, "lib/mobile-auth/v1/audit.js"));
const security = requireCjs(resolve(outDir, "lib/mobile-auth/v1/security-controls.js"));

const CONTROL = "test_control_key_0123456789abcdef0123456789AB";
const REFRESH = "gbrt_v1_" + "a".repeat(43);
const IDEM = "idem_key_0123456789abcdef";

function req({ headers = {}, body = JSON.stringify({ refreshToken: REFRESH }), url = "https://example.test/api/v1/mobile/auth/refresh" } = {}) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": IDEM, ...headers },
    body
  });
}

test("Idempotency-Key parser accepts the safe alphabet and rejects ambiguity", () => {
  assert.equal(security.parseIdempotencyKey(IDEM).ok, true);
  for (const bad of [
    "",
    "short",
    " leading_idem_key_012345",
    "trailing_idem_key_012345 ",
    "comma,idempotency_key_0123",
    "unicode_\u2603_key_012345",
    "control_\n_key_0123456789"
  ]) {
    assert.equal(security.parseIdempotencyKey(bad).ok, false, JSON.stringify(bad));
  }
});

test("HMAC domain separation prevents raw key/body/token storage", () => {
  const idem = security.idempotencyKeyDigest(CONTROL, IDEM);
  const cred = security.credentialDigest(CONTROL, "hash_secret_value");
  const actor = security.actorDigest(CONTROL, "user-1");
  const reqDigest = security.canonicalRequestDigest(CONTROL, "refresh", { refreshToken: REFRESH });
  for (const digest of [idem, cred, actor, reqDigest]) assert.match(digest, /^[0-9a-f]{64}$/);
  assert.equal(new Set([idem, cred, actor, reqDigest]).size, 4);
  assert.notEqual(reqDigest, security.canonicalRequestDigest(CONTROL, "logout", { refreshToken: REFRESH }));
});

test("request boundary rejects query/content-type/body/header ambiguity before handler work", async () => {
  assert.equal((await boundary.prepareMobileAuthRequest(req(), "refresh")).ok, true);
  assert.equal((await boundary.prepareMobileAuthRequest(req({ url: "https://example.test/x?debug=1" }), "refresh")).rejection.reason, "query_rejected");
  assert.equal((await boundary.prepareMobileAuthRequest(req({ headers: { "content-type": "text/plain" } }), "refresh")).rejection.reason, "content_type_rejected");
  assert.equal((await boundary.prepareMobileAuthRequest(req({ headers: { "content-type": "application/json; charset=latin1" } }), "refresh")).rejection.reason, "content_type_rejected");
  assert.equal((await boundary.prepareMobileAuthRequest(req({ headers: { "idempotency-key": IDEM + ",other" } }), "refresh")).rejection.reason, "header_rejected");
  assert.equal((await boundary.prepareMobileAuthRequest(req({ body: JSON.stringify({ refreshToken: REFRESH, userId: "u1" }) }), "refresh")).rejection.reason, "body_schema_rejected");
  assert.equal((await boundary.prepareMobileAuthRequest(req({ body: `{"refreshToken":"${REFRESH}","__proto__":"x"}` }), "refresh")).rejection.reason, "body_schema_rejected");
  assert.equal((await boundary.prepareMobileAuthRequest(req({ body: "x".repeat(8193) }), "refresh")).rejection.reason, "body_too_large");
});

test("logout-all boundary accepts only a strict empty object", async () => {
  const ok = await boundary.prepareMobileAuthRequest(
    req({ url: "https://example.test/api/v1/mobile/auth/logout-all", body: "{}" }),
    "logout-all"
  );
  assert.equal(ok.ok, true);
  const bad = await boundary.prepareMobileAuthRequest(
    req({ url: "https://example.test/api/v1/mobile/auth/logout-all", body: JSON.stringify({ userId: "u1" }) }),
    "logout-all"
  );
  assert.equal(bad.ok, false);
});

test("audit allowlist includes new security events and rejects forbidden fields", () => {
  assert.equal(audit.buildMobileAuthAuditEvent({
    event: "mobile_auth_rate_limited",
    occurredAt: 1,
    reason: "rate_limited",
    outcome: "rate_limited"
  }).event, "mobile_auth_rate_limited");
  for (const field of audit.FORBIDDEN_AUDIT_FIELDS) {
    assert.throws(() => audit.buildMobileAuthAuditEvent({
      event: "mobile_auth_boundary_rejected",
      occurredAt: 1,
      reason: "query_rejected",
      outcome: "denied",
      [field]: "x"
    }), audit.AuditValidationError);
  }
});

test("B22D-BP2-001 boundary audit schema uses fixed endpoint/reason/requestId only", () => {
  const event = audit.buildMobileAuthAuditEvent({
    event: "mobile_auth_boundary_rejected",
    occurredAt: 1,
    endpoint: "refresh",
    requestId: "req-1234:abcd",
    reason: "query_rejected",
    outcome: "denied"
  });
  assert.equal(event.endpoint, "refresh");
  assert.equal(event.reason, "query_rejected");
  assert.throws(() => audit.buildMobileAuthAuditEvent({
    event: "mobile_auth_boundary_rejected",
    occurredAt: 1,
    endpoint: "admin",
    requestId: "req-1234",
    reason: "query_rejected",
    outcome: "denied"
  }), audit.AuditValidationError);
  assert.throws(() => audit.buildMobileAuthAuditEvent({
    event: "mobile_auth_boundary_rejected",
    occurredAt: 1,
    endpoint: "refresh",
    requestId: "req-1\r\nx",
    reason: "query_rejected",
    outcome: "denied"
  }), audit.AuditValidationError);
});

test("B22D-BP2-002 finalize allows only runtime-validated Retry-After", () => {
  const failure = { status: 429, body: { ok: false, error: { code: "RATE_LIMITED", message: "Rate limited.", requestId: "req-1" } } };
  const ok = handlerResult.finalize("req-1", failure, { retryAfterSeconds: 60 });
  assert.equal(ok.headers["Retry-After"], "60");
  assert.equal(ok.headers["Cache-Control"], "private, no-store");
  assert.equal(ok.headers["X-Request-Id"], "req-1");

  const base = handlerResult.finalize("req-1", failure);
  assert.equal(base.headers["Retry-After"], undefined);

  for (const bad of [0, -1, 1.5, 3601, Number.NaN, Number.POSITIVE_INFINITY, "60", "1\r\nSet-Cookie: x=1", null]) {
    assert.throws(() => handlerResult.finalize("req-1", failure, { retryAfterSeconds: bad }), /Invalid Retry-After value/);
  }
});
