// GB MEDIX AI Batch 2.2E — mobile issue handler PURE unit tests.
//
// Compiles the real handler (+ deps) to CommonJS and exercises it with injected
// fakes — no DB, no network, throwaway test key/pepper only. Verifies the
// orchestration: strict validation, rate-limit BEFORE idempotency claim, a
// completed key returns a fixed CONFLICT (never re-issues), and an invalid token
// yields a coarse AUTH_REQUIRED. No token/hash/key value is printed.

import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";

const cwd = process.cwd();
const files = [
  "lib/api-v1/handlers/mobile-auth-issue.ts",
  "lib/api-v1/mobile-auth-boundary.ts",
  "lib/mobile-auth/v1/access-token-sign.ts",
  "lib/mobile-auth/v1/refresh-token.ts"
].map((f) => join(cwd, f));

mkdirSync(join(cwd, ".tmp"), { recursive: true });
const outDir = mkdtempSync(join(cwd, ".tmp", "missue-"));
const requireCjs = createRequire(import.meta.url);
const tsconfigPath = join(outDir, "tsconfig.json");
writeFileSync(tsconfigPath, JSON.stringify({
  compilerOptions: {
    outDir, rootDir: cwd, baseUrl: cwd, paths: { "@/*": ["*"] },
    module: "commonjs", target: "es2020", moduleResolution: "node",
    esModuleInterop: true, skipLibCheck: true, strict: true, noEmitOnError: true
  },
  files
}));
try {
  execFileSync(process.execPath, ["node_modules/typescript/bin/tsc", "-p", tsconfigPath], { stdio: "pipe" });
} catch (error) {
  rmSync(outDir, { recursive: true, force: true });
  throw new Error("tsc compile of issue handler failed:\n" + (error.stdout || error.message));
}
test.after(() => rmSync(outDir, { recursive: true, force: true }));

const E = (p) => requireCjs(resolve(outDir, "lib", p));
const handlerMod = E("api-v1/handlers/mobile-auth-issue.js");
const boundary = E("api-v1/mobile-auth-boundary.js");
const sign = E("mobile-auth/v1/access-token-sign.js");

const KEY = "test_signing_key_0123456789abcdef0123456789ABCDEF";
const PEPPER = "test_refresh_pepper_0123456789abcdef0123456789";
const ISS = "gbmedix-test";
const AUD = "gbmedix-mobile-test";
const NOW = 1_900_000_000;
const TOKEN = "verif_0123456789abcdef0123456789abcdef";

function makeDeps(over = {}) {
  const calls = { checkRateLimit: 0, claimIdempotency: 0, exchange: 0, complete: 0, fail: 0 };
  const deps = {
    now: () => NOW,
    pepper: PEPPER,
    signingKey: KEY,
    issuer: ISS,
    audience: AUD,
    accessTtlSeconds: 900,
    refreshIdleTtlSeconds: 3600,
    refreshAbsoluteTtlSeconds: 100000,
    newSessionId: () => "sess_1",
    newTokenFamilyId: () => "fam_1",
    newTokenId: () => "jti_1",
    exchange: async () => {
      calls.exchange++;
      return { status: "issued", session: {}, userId: "u1", sessionVersion: 3 };
    },
    security: {
      credentialDigest: (v) => "cd_" + v.length,
      requestDigest: () => "rd",
      checkRateLimit: async () => { calls.checkRateLimit++; return { ok: true }; },
      claimIdempotency: async () => { calls.claimIdempotency++; return { status: "claimed", id: "idem_1" }; },
      completeIdempotency: async () => { calls.complete++; },
      failIdempotency: async () => { calls.fail++; }
    },
    ...over
  };
  return { deps, calls };
}
const body = { verificationToken: TOKEN, device: { platform: "ios", appVersion: "1.2.3" } };
const IDEM = "idem-key-abcdef123456";

function boundaryRequest({ endpoint = "issue", headers = {}, requestBody = body } = {}) {
  return new Request(`https://api.test/mobile/${endpoint}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": IDEM,
      ...headers
    },
    body: JSON.stringify(requestBody)
  });
}

test("issue success returns tokens once and a verifiable access token", async () => {
  const { deps, calls } = makeDeps();
  const res = await handlerMod.createMobileIssueHandler(deps)({ body, idempotencyKey: IDEM });
  assert.equal(res.status, 200);
  assert.equal(res.headers["Cache-Control"], "private, no-store");
  assert.equal(res.body.ok, true);
  assert.equal(res.body.data.deviceSessionId, "sess_1");
  assert.ok(res.body.data.refreshToken.startsWith("gbrt_v1_"));
  assert.equal(sign.verifyAccessToken(res.body.data.accessToken, KEY, { issuer: ISS, audience: AUD, maxTtlSeconds: 900 }, NOW + 10).ok, true);
  assert.equal(calls.exchange, 1);
});

test("malformed body is rejected before any side effect", async () => {
  const { deps, calls } = makeDeps();
  const res = await handlerMod.createMobileIssueHandler(deps)({ body: { device: { platform: "ios", appVersion: "1" } }, idempotencyKey: IDEM });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, "VALIDATION_ERROR");
  assert.equal(calls.checkRateLimit + calls.claimIdempotency + calls.exchange, 0);
});

test("rate limit is checked BEFORE claiming idempotency (no claim on 429)", async () => {
  const { deps, calls } = makeDeps({
    security: undefined
  });
  const sec = {
    credentialDigest: () => "cd",
    requestDigest: () => "rd",
    checkRateLimit: async () => { calls.checkRateLimit++; return { ok: false, retryAfterSeconds: 42 }; },
    claimIdempotency: async () => { calls.claimIdempotency++; return { status: "claimed", id: "x" }; },
    completeIdempotency: async () => {},
    failIdempotency: async () => {}
  };
  deps.security = sec;
  const res = await handlerMod.createMobileIssueHandler(deps)({ body, idempotencyKey: IDEM });
  assert.equal(res.status, 429);
  assert.equal(res.headers["Retry-After"], "42");
  assert.equal(calls.claimIdempotency, 0, "must not claim idempotency on a rate-limited request");
  assert.equal(calls.exchange, 0);
});

test("a completed idempotency key returns a fixed CONFLICT and never re-issues", async () => {
  const { deps, calls } = makeDeps();
  deps.security.claimIdempotency = async () => ({ status: "completed", id: "idem_1" });
  const res = await handlerMod.createMobileIssueHandler(deps)({ body, idempotencyKey: IDEM });
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, "CONFLICT");
  assert.equal(calls.exchange, 0, "must not re-issue on a completed key");
});

test("an invalid/expired/consumed verification token yields a coarse AUTH_REQUIRED", async () => {
  const { deps } = makeDeps();
  deps.exchange = async () => ({ status: "invalid_token" });
  const res = await handlerMod.createMobileIssueHandler(deps)({ body, idempotencyKey: IDEM });
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, "AUTH_REQUIRED");
});

test("B22E-BP2-001 issue boundary rejects Authorization/Cookie presence before handler", async () => {
  const cases = [
    ["Bearer Authorization", { authorization: "Bearer access-token-value" }],
    ["Basic Authorization", { authorization: "Basic abcdef" }],
    ["empty Authorization header", { authorization: "" }],
    ["Cookie", { cookie: "sid=secret-cookie" }],
    ["Authorization and Cookie", { authorization: "Bearer access-token-value", cookie: "sid=secret-cookie" }]
  ];
  for (const [label, headers] of cases) {
    let handlerCalls = 0;
    const prepared = await boundary.prepareMobileAuthRequest(boundaryRequest({ headers }), "issue");
    if (prepared.ok) handlerCalls += 1;
    assert.equal(prepared.ok, false, label);
    assert.equal(prepared.rejection.reason, "header_rejected", label);
    assert.equal(handlerCalls, 0, label);
    assert.equal(prepared.rejection.result.status, 400, label);
    assert.equal(prepared.rejection.result.headers["Cache-Control"], "private, no-store", label);
    assert.equal(prepared.rejection.result.headers["X-API-Version"], "1", label);
    const serialized = JSON.stringify(prepared.rejection);
    assert.equal(serialized.includes("access-token-value"), false, label);
    assert.equal(serialized.includes("secret-cookie"), false, label);
    assert.equal(serialized.includes(TOKEN), false, label);
    assert.equal(serialized.includes(IDEM), false, label);
  }
});

test("B22E-BP2-001 issue accepts no credential headers while logout-all keeps Bearer auth", async () => {
  const issue = await boundary.prepareMobileAuthRequest(boundaryRequest(), "issue");
  assert.equal(issue.ok, true);
  assert.equal(issue.input.authorization, undefined);

  const logoutAll = await boundary.prepareMobileAuthRequest(
    boundaryRequest({
      endpoint: "logout-all",
      headers: { authorization: "Bearer mobile-access-token" },
      requestBody: {}
    }),
    "logout-all"
  );
  assert.equal(logoutAll.ok, true);
  assert.equal(logoutAll.input.authorization, "Bearer mobile-access-token");

  const refresh = await boundary.prepareMobileAuthRequest(
    boundaryRequest({
      endpoint: "refresh",
      requestBody: { refreshToken: "gbrt_v1_" + "a".repeat(48) }
    }),
    "refresh"
  );
  assert.equal(refresh.ok, true);
});
