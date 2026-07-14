// GB MEDIX AI — Mobile Auth API Routes pure layer tests (Batch 2.2C).
//
// Executes the REAL implementation: the actual TS signer/config/handlers and the
// real InMemoryDeviceSessionStore are compiled (project tsc -> CommonJS temp dir)
// and required. Handlers run with injected fakes/real in-memory store — NO DB, NO
// Prisma, NO network, NO secret committed (throwaway test key/pepper only). No
// token / hash / key value is ever asserted-into or printed.

import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";

const cwd = process.cwd();
const files = [
  "lib/api-v1/handlers/mobile-auth-refresh.ts",
  "lib/api-v1/handlers/mobile-auth-logout.ts",
  "lib/api-v1/handlers/mobile-auth-logout-all.ts",
  "lib/mobile-auth/v1/access-token-sign.ts",
  "lib/mobile-auth/v1/config.ts",
  "lib/mobile-auth/v1/audit.ts",
  "lib/mobile-auth/v1/bearer.ts",
  "lib/mobile-auth/v1/refresh-token.ts",
  "lib/mobile-auth/v1/store.ts"
].map((f) => join(cwd, f));

mkdirSync(join(cwd, ".tmp"), { recursive: true });
const outDir = mkdtempSync(join(cwd, ".tmp", "mauth-routes-"));
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
  throw new Error("tsc compile of mobile-auth routes failed:\n" + (error.stdout || error.message));
}
test.after(() => rmSync(outDir, { recursive: true, force: true }));

const E = (p) => requireCjs(resolve(outDir, "lib", p));
const sign = E("mobile-auth/v1/access-token-sign.js");
const cfg = E("mobile-auth/v1/config.js");
const auditM = E("mobile-auth/v1/audit.js");
const bearer = E("mobile-auth/v1/bearer.js");
const rt = E("mobile-auth/v1/refresh-token.js");
const storeM = E("mobile-auth/v1/store.js");
const refreshH = E("api-v1/handlers/mobile-auth-refresh.js");
const logoutH = E("api-v1/handlers/mobile-auth-logout.js");
const logoutAllH = E("api-v1/handlers/mobile-auth-logout-all.js");

const KEY = "test_signing_key_0123456789abcdef0123456789ABCDEF"; // >= 32, throwaway
const PEPPER = "test_refresh_pepper_0123456789abcdef0123456789"; // >= 32, throwaway
const ISS = "gbmedix-test";
const AUD = "gbmedix-mobile-test";
const POLICY = { issuer: ISS, audience: AUD, maxTtlSeconds: 900, clockSkewSeconds: 0 };
const BASE = 1_800_000_000;
const ACCESS_TTL = 900;

const claims = (over = {}) =>
  sign.buildAccessTokenClaims({
    userId: over.userId ?? "u1", deviceSessionId: over.sid ?? "s1", sessionVersion: over.sv ?? 1,
    tokenId: over.jti ?? "jti1", issuer: over.iss ?? ISS, audience: over.aud ?? AUD,
    issuedAt: over.iat ?? BASE, ttlSeconds: over.ttl ?? ACCESS_TTL
  });

// ---------- signer ----------
test("signer issues and verifies an access token round-trip", () => {
  const token = sign.signAccessToken(claims(), KEY);
  const v = sign.verifyAccessToken(token, KEY, POLICY, BASE + 10);
  assert.equal(v.ok, true);
  assert.equal(v.claims.sub, "u1");
  assert.equal(v.claims.typ, "gbmedix_mobile_at");
});

test("tampered token is rejected (bad signature / malformed)", () => {
  const token = sign.signAccessToken(claims(), KEY);
  const [p, s] = token.split(".");
  const flippedPayload = `${p.slice(0, -1)}${p.slice(-1) === "A" ? "B" : "A"}.${s}`;
  assert.equal(sign.verifyAccessToken(flippedPayload, KEY, POLICY, BASE + 10).ok, false);
  const wrongKey = sign.verifyAccessToken(token, KEY + "_different_suffix_padding_x", POLICY, BASE + 10);
  assert.equal(wrongKey.ok, false);
  assert.equal(wrongKey.reason, "bad_signature");
});

test("wrong issuer / audience rejected", () => {
  const token = sign.signAccessToken(claims(), KEY);
  assert.equal(sign.verifyAccessToken(token, KEY, { ...POLICY, issuer: "other" }, BASE + 10).reason, "wrong_issuer");
  assert.equal(sign.verifyAccessToken(token, KEY, { ...POLICY, audience: "other" }, BASE + 10).reason, "wrong_audience");
});

test("expired / not-yet-valid rejected", () => {
  const token = sign.signAccessToken(claims(), KEY);
  assert.equal(sign.verifyAccessToken(token, KEY, POLICY, BASE + ACCESS_TTL + 1).reason, "expired");
  assert.equal(sign.verifyAccessToken(token, KEY, POLICY, BASE - 5).reason, "not_yet_valid");
});

test("missing / short signing key fails closed", () => {
  assert.throws(() => sign.signAccessToken(claims(), "short"), /AccessTokenSignError/);
  assert.throws(() => sign.verifyAccessToken("a.b", "short", POLICY, BASE), /AccessTokenSignError/);
});

// ---------- config boundary ----------
const goodEnv = {
  MOBILE_AUTH_ACCESS_TOKEN_SIGNING_KEY: KEY,
  MOBILE_AUTH_REFRESH_TOKEN_PEPPER: PEPPER,
  MOBILE_AUTH_CONTROL_KEY: "test_control_key_0123456789abcdef0123456789AB",
  MOBILE_AUTH_ISSUER: ISS,
  MOBILE_AUTH_AUDIENCE: AUD,
  MOBILE_AUTH_ACCESS_TTL_SECONDS: "900",
  MOBILE_AUTH_REFRESH_IDLE_TTL_SECONDS: "3600",
  MOBILE_AUTH_REFRESH_ABSOLUTE_TTL_SECONDS: "2592000"
};
test("config loads valid env and fails closed (value-free) on missing/short secrets", () => {
  const c = cfg.loadMobileAuthConfig(goodEnv);
  assert.equal(c.issuer, ISS);
  assert.equal(c.accessTtlSeconds, 900);
  assert.throws(() => cfg.loadMobileAuthConfig({ ...goodEnv, MOBILE_AUTH_ACCESS_TOKEN_SIGNING_KEY: undefined }), (e) => {
    assert.match(e.message, /signing key|SIGNING_KEY/i);
    assert.equal(e.message.includes(PEPPER), false);
    return true;
  });
  assert.throws(() => cfg.loadMobileAuthConfig({ ...goodEnv, MOBILE_AUTH_REFRESH_TOKEN_PEPPER: "tooshort" }), (e) => {
    assert.equal(e.message.includes("tooshort"), false);
    return true;
  });
});

// ---------- bearer parser (cookie/query/basic/multiple/CRLF/control) ----------
test("Bearer parser rejects cookie/query/basic/multiple/comma/CRLF/control, accepts a clean token", () => {
  for (const bad of ["Basic abc", "Bearer a b", "Bearer a,Bearer b", "Bearer a\r\nb", "Bearer a\tb", "token=abc", ["Bearer a", "Bearer b"], "bearer abc"]) {
    assert.equal(bearer.parseBearerAuthorization(bad).ok, false);
  }
  const t = sign.signAccessToken(claims(), KEY);
  assert.equal(bearer.parseBearerAuthorization(`Bearer ${t}`).ok, true);
});

// ---------- audit rejects secret-bearing metadata ----------
test("audit builder rejects secret-bearing fields, accepts a clean event", () => {
  for (const bad of [
    { event: "mobile_refresh_rotated", occurredAt: BASE, refreshToken: "gbrt_v1_x" },
    { event: "mobile_refresh_rotated", occurredAt: BASE, refreshTokenHash: "deadbeef" },
    { event: "mobile_session_revoked", occurredAt: BASE, authorization: "Bearer x" },
    { event: "mobile_session_revoked", occurredAt: BASE, email: "a@b.com" }
  ]) {
    assert.throws(() => auditM.buildMobileAuthAuditEvent(bad), /AuditValidationError/);
  }
  assert.ok(auditM.buildMobileAuthAuditEvent({ event: "mobile_refresh_rotated", occurredAt: BASE, userId: "u1", reason: "rotated" }));
});

// ---------- shared handler harness (real InMemory store + injected fakes) ----------
function makeHarness(over = {}) {
  const store = new storeM.InMemoryDeviceSessionStore();
  const facts = over.facts ?? { exists: true, status: "active", emailVerifiedAt: "2020-01-01T00:00:00Z", sessionVersion: 1 };
  const audits = [];
  const baseDeps = {
    now: () => BASE + 100,
    pepper: PEPPER,
    signingKey: KEY,
    issuer: ISS,
    audience: AUD,
    accessTtlSeconds: ACCESS_TTL,
    refreshIdleTtlSeconds: 3600,
    findCurrentByHash: (h) => store.findByRefreshTokenHash(h),
    rotate: (i) => store.rotateRefreshTokenAtomically(i),
    revokeSession: (id, r, n) => store.revokeSession(id, r, n),
    revokeAllUserSessions: (u, r, n) => store.revokeAllUserSessions(u, r, n),
    getUserFacts: async () => facts,
    newTokenId: () => "jti_" + Math.floor((BASE % 100000)).toString(16),
    audit: (e) => audits.push(e),
    revokeFamilyOnReplay: async (h, now) => {
      const lookup = store.classifyRefreshToken(h);
      if (lookup.kind === "consumed") {
        const c = await store.revokeTokenFamily(lookup.session.tokenFamilyId, "refresh_replay", now);
        return { replay: true, revokedCount: c };
      }
      return { replay: false, revokedCount: 0 };
    }
  };
  return { store, audits, deps: { ...baseDeps, ...over.deps } };
}

async function seedSession(store, token, over = {}) {
  const hash = rt.hashRefreshToken(token, PEPPER);
  return store.createSession({
    id: over.id ?? "sess1", userId: over.userId ?? "u1", tokenFamilyId: over.fam ?? "fam1",
    refreshTokenHash: hash, createdAt: BASE, idleExpiresAt: BASE + 100000, absoluteExpiresAt: BASE + 1000000
  });
}

function makeSecuritySpy({ limited = false, throwRateLimit = false, claimStatus = { status: "claimed", id: "idem-1" } } = {}) {
  const calls = { rateLimit: 0, claim: 0, complete: 0, fail: 0 };
  return {
    calls,
    security: {
      credentialDigest: (value) => `cred:${value}`,
      actorDigest: (value) => `actor:${value}`,
      requestDigest: (endpoint, body) => `request:${endpoint}:${JSON.stringify(body)}`,
      checkRateLimit: async () => {
        calls.rateLimit += 1;
        if (throwRateLimit) throw new Error("rate-limit unavailable");
        return limited ? { ok: false, retryAfterSeconds: 17 } : { ok: true, remaining: 1 };
      },
      claimIdempotency: async () => {
        calls.claim += 1;
        return claimStatus;
      },
      completeIdempotency: async () => {
        calls.complete += 1;
      },
      failIdempotency: async () => {
        calls.fail += 1;
      }
    }
  };
}

// ---------- refresh ----------
test("refresh success rotates exactly once and returns a NEW refresh token (plaintext once)", async () => {
  const h = makeHarness();
  const token = rt.generateRefreshToken();
  await seedSession(h.store, token);
  const handler = refreshH.createMobileRefreshHandler(h.deps);

  const res = await handler({ body: { refreshToken: token } });
  assert.equal(res.status, 200);
  assert.equal(res.headers["Cache-Control"], "private, no-store");
  assert.equal(res.body.ok, true);
  const out = res.body.data;
  assert.ok(out.accessToken && out.refreshToken && out.deviceSessionId === "sess1");
  assert.notEqual(out.refreshToken, token); // rotated to a new plaintext
  // the issued access token verifies
  assert.equal(sign.verifyAccessToken(out.accessToken, KEY, POLICY, BASE + 101).ok, true);
  // rotation happened exactly once
  const after = await h.store.findById("sess1");
  assert.equal(after.rotationCounter, 1);
  // never audits the plaintext (old or new)
  const auditStr = JSON.stringify(h.audits);
  assert.equal(auditStr.includes(token), false);
  assert.equal(auditStr.includes(out.refreshToken), false);
  assert.ok(h.audits.some((e) => e.event === "mobile_refresh_rotated"));
});

test("refresh replay (reusing a consumed token) revokes the family and is rejected", async () => {
  const h = makeHarness();
  const token = rt.generateRefreshToken();
  await seedSession(h.store, token);
  const handler = refreshH.createMobileRefreshHandler(h.deps);
  const first = await handler({ body: { refreshToken: token } });
  assert.equal(first.status, 200);

  // Replay the ORIGINAL (now consumed) token.
  const replay = await handler({ body: { refreshToken: token } });
  assert.equal(replay.status, 401);
  const s = await h.store.findById("sess1");
  assert.equal(s.status, "revoked"); // family revoked on replay
  assert.ok(h.audits.some((e) => e.event === "mobile_refresh_replay_detected"));
});

test("refresh rejects malformed body and unknown token with coarse codes", async () => {
  const h = makeHarness();
  const handler = refreshH.createMobileRefreshHandler(h.deps);
  assert.equal((await handler({ body: { refreshToken: "not-a-token" } })).status, 400);
  assert.equal((await handler({ body: {} })).status, 400);
  assert.equal((await handler({ body: { refreshToken: rt.generateRefreshToken() } })).status, 401); // unknown
});

test("refresh rejects an ineligible (inactive) user", async () => {
  const h = makeHarness({ facts: { exists: true, status: "suspended", emailVerifiedAt: "2020-01-01T00:00:00Z", sessionVersion: 1 } });
  const token = rt.generateRefreshToken();
  await seedSession(h.store, token);
  const handler = refreshH.createMobileRefreshHandler(h.deps);
  assert.equal((await handler({ body: { refreshToken: token } })).status, 401);
});

// ---------- logout ----------
test("logout revokes only the owning session and is idempotent + non-revealing", async () => {
  const h = makeHarness();
  const token = rt.generateRefreshToken();
  await seedSession(h.store, token, { id: "sA", fam: "famA" });
  await seedSession(h.store, rt.generateRefreshToken(), { id: "sB", fam: "famB", userId: "u1" });
  const handler = logoutH.createMobileLogoutHandler(h.deps);

  const res = await handler({ body: { refreshToken: token } });
  assert.equal(res.status, 200);
  assert.equal((await h.store.findById("sA")).status, "revoked");
  assert.equal((await h.store.findById("sB")).status, "active"); // other session untouched

  // idempotent + non-revealing: unknown token returns the SAME status + body shape
  const unknown = await handler({ body: { refreshToken: rt.generateRefreshToken() } });
  assert.equal(unknown.status, res.status);
  assert.deepEqual(Object.keys(unknown.body.data), Object.keys(res.body.data));
});

test("B22D-P1-001 rate-limited logout does not claim, complete, revoke, or replay false success", async () => {
  const token = rt.generateRefreshToken();
  const spy = makeSecuritySpy({ limited: true });
  const h = makeHarness({ deps: { security: spy.security } });
  await seedSession(h.store, token, { id: "rate-logout", fam: "rate-fam" });
  const handler = logoutH.createMobileLogoutHandler(h.deps);

  const first = await handler({ body: { refreshToken: token }, idempotencyKey: "idem_rate_logout_0001" });
  const replay = await handler({ body: { refreshToken: token }, idempotencyKey: "idem_rate_logout_0001" });

  assert.equal(first.status, 429);
  assert.equal(replay.status, 429);
  assert.equal(first.headers["Retry-After"], "17");
  assert.equal(spy.calls.rateLimit, 2);
  assert.equal(spy.calls.claim, 0);
  assert.equal(spy.calls.complete, 0);
  assert.equal(spy.calls.fail, 0);
  assert.equal((await h.store.findById("rate-logout")).status, "active");
});

test("B22D-P1-001 logout limiter exception happens before claim and revoke", async () => {
  const token = rt.generateRefreshToken();
  const spy = makeSecuritySpy({ throwRateLimit: true });
  const h = makeHarness({ deps: { security: spy.security } });
  await seedSession(h.store, token, { id: "limit-error-logout", fam: "limit-error-fam" });
  const handler = logoutH.createMobileLogoutHandler(h.deps);

  const res = await handler({ body: { refreshToken: token }, idempotencyKey: "idem_rate_logout_0002" });

  assert.equal(res.status, 500);
  assert.equal(spy.calls.rateLimit, 1);
  assert.equal(spy.calls.claim, 0);
  assert.equal(spy.calls.complete, 0);
  assert.equal(spy.calls.fail, 0);
  assert.equal((await h.store.findById("limit-error-logout")).status, "active");
});

test("B22D-P1-001 rate-limited logout 2/10/50 workers have no false 200 replay", async () => {
  for (const workers of [2, 10, 50]) {
    const token = rt.generateRefreshToken();
    const spy = makeSecuritySpy({ limited: true });
    const h = makeHarness({ deps: { security: spy.security } });
    await seedSession(h.store, token, { id: `rate-workers-${workers}`, fam: `rate-fam-${workers}` });
    const handler = logoutH.createMobileLogoutHandler(h.deps);
    const results = await Promise.all(Array.from({ length: workers }, () =>
      handler({ body: { refreshToken: token }, idempotencyKey: "idem_rate_logout_workers" })
    ));
    assert.deepEqual(results.map((r) => r.status), Array(workers).fill(429));
    assert.equal(spy.calls.claim, 0);
    assert.equal(spy.calls.complete, 0);
    assert.equal((await h.store.findById(`rate-workers-${workers}`)).status, "active");
  }
});

// ---------- logout-all ----------
test("logout-all requires a valid Bearer, revokes only the actor's sessions, rejects client userId", async () => {
  const h = makeHarness();
  await seedSession(h.store, rt.generateRefreshToken(), { id: "s1", fam: "f1", userId: "u1" });
  await seedSession(h.store, rt.generateRefreshToken(), { id: "s2", fam: "f2", userId: "u1" });
  await seedSession(h.store, rt.generateRefreshToken(), { id: "sX", fam: "fX", userId: "other" });
  const deps = { ...h.deps, policy: POLICY };
  const handler = logoutAllH.createMobileLogoutAllHandler(deps);

  // no bearer -> AUTH_REQUIRED
  assert.equal((await handler({ body: {}, authorization: undefined })).status, 401);
  assert.equal((await handler({ body: {}, authorization: "Basic x" })).status, 401);

  const accessToken = sign.signAccessToken(claims({ userId: "u1", sv: 1, iat: BASE + 90 }), KEY);
  // client-supplied userId in body -> VALIDATION_ERROR (strict-empty body)
  assert.equal((await handler({ body: { userId: "other" }, authorization: `Bearer ${accessToken}` })).status, 400);

  // valid -> revokes ONLY u1's sessions
  const ok = await handler({ body: {}, authorization: `Bearer ${accessToken}` });
  assert.equal(ok.status, 200);
  assert.equal((await h.store.findById("s1")).status, "revoked");
  assert.equal((await h.store.findById("s2")).status, "revoked");
  assert.equal((await h.store.findById("sX")).status, "active"); // cross-user isolation
  assert.ok(h.audits.some((e) => e.event === "mobile_all_sessions_revoked"));
});

test("B22D-P1-001 rate-limited logout-all does not claim, complete, revoke, or replay false success", async () => {
  const spy = makeSecuritySpy({ limited: true });
  const h = makeHarness({ deps: { security: spy.security, policy: POLICY } });
  await seedSession(h.store, rt.generateRefreshToken(), { id: "rate-all-1", fam: "rate-all-fam-1", userId: "u1" });
  await seedSession(h.store, rt.generateRefreshToken(), { id: "rate-all-2", fam: "rate-all-fam-2", userId: "u1" });
  const handler = logoutAllH.createMobileLogoutAllHandler(h.deps);
  const accessToken = sign.signAccessToken(claims({ userId: "u1", sv: 1, iat: BASE + 90 }), KEY);

  const first = await handler({ body: {}, authorization: `Bearer ${accessToken}`, idempotencyKey: "idem_rate_all_0001" });
  const replay = await handler({ body: {}, authorization: `Bearer ${accessToken}`, idempotencyKey: "idem_rate_all_0001" });

  assert.equal(first.status, 429);
  assert.equal(replay.status, 429);
  assert.equal(first.headers["Retry-After"], "17");
  assert.equal(spy.calls.rateLimit, 2);
  assert.equal(spy.calls.claim, 0);
  assert.equal(spy.calls.complete, 0);
  assert.equal(spy.calls.fail, 0);
  assert.equal((await h.store.findById("rate-all-1")).status, "active");
  assert.equal((await h.store.findById("rate-all-2")).status, "active");
});

test("logout-all rejects a token whose sessionVersion no longer matches (TOKEN_EXPIRED)", async () => {
  const h = makeHarness({ facts: { exists: true, status: "active", emailVerifiedAt: "2020-01-01T00:00:00Z", sessionVersion: 5 } });
  const deps = { ...h.deps, policy: POLICY };
  const handler = logoutAllH.createMobileLogoutAllHandler(deps);
  const staleToken = sign.signAccessToken(claims({ userId: "u1", sv: 1, iat: BASE + 90 }), KEY);
  assert.equal((await handler({ body: {}, authorization: `Bearer ${staleToken}` })).status, 401);
});

// ---------- fixed response contract shape ----------
test("handlers always emit the fixed private/no-store headers + versioned contract", async () => {
  const h = makeHarness();
  const handler = refreshH.createMobileRefreshHandler(h.deps);
  const res = await handler({ body: { refreshToken: "bad" } });
  assert.equal(res.headers["Cache-Control"], "private, no-store");
  assert.equal(res.headers["X-API-Version"], "1");
  assert.equal(res.headers["Content-Type"], "application/json");
  assert.equal(typeof res.headers["X-Request-Id"], "string");
  assert.equal(res.body.ok, false);
  assert.equal(res.body.error.code, "VALIDATION_ERROR");
});
