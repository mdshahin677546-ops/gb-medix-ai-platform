// Mobile Auth / DeviceSession foundation — executes the REAL TypeScript.
//
// lib/mobile-auth/v1 and lib/api-contract/v1 are compiled with the project tsc
// (--strict) to CommonJS in a random, git-ignored temp dir and required. All
// assertions run against the real crypto/policy/store implementations — no
// mirrored logic, no source-string checks. Tests never print a token, hash,
// pepper, or Authorization header value.

import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";

const MOBILE = "lib/mobile-auth/v1";
const CONTRACT = "lib/api-contract/v1";

function collectTs(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectTs(p));
    else if (entry.name.endsWith(".ts")) out.push(p);
  }
  return out;
}

// Random, per-process temp dir. It is repo-LOCAL (under a git-ignored .tmp-*
// prefix) on purpose: the compiled CommonJS output does `require("zod")`, which
// only resolves against the repo's node_modules, so an os.tmpdir() location
// would break module resolution. mkdtemp guarantees a unique name, so concurrent
// runs never collide and no run can delete another run's directory.
const outDir = mkdtempSync(join(process.cwd(), ".tmp-mobileauth-"));
const requireCjs = createRequire(import.meta.url);
execFileSync(
  process.execPath,
  [
    "node_modules/typescript/bin/tsc",
    ...collectTs(CONTRACT),
    ...collectTs(MOBILE),
    "--outDir", outDir,
    "--rootDir", "lib",
    "--module", "commonjs",
    "--target", "es2020",
    "--moduleResolution", "node",
    "--esModuleInterop",
    "--strict",
    "--skipLibCheck"
  ],
  { stdio: "pipe" }
);
const M = requireCjs(resolve(outDir, "mobile-auth/v1/index.js"));
const C = requireCjs(resolve(outDir, "api-contract/v1/index.js"));
// Teardown always runs (even if tests fail) and cleans ONLY this run's random
// dir. The compiled files were just require()'d, so on Windows a virus scanner
// can briefly lock them (EBUSY) — retry generously. Crucially, a cleanup failure
// is NOT swallowed: if the dir still exists after retries the hook throws (fixed,
// value-free message) so a real leak surfaces instead of a silent PASS.
test.after(() => {
  rmSync(outDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 150 });
  if (existsSync(outDir)) {
    throw new Error("temp compile dir was not removed after retries");
  }
});

// A >= 32-char pepper. Never printed.
const PEPPER = "pepper_0123456789abcdef0123456789abcdef";

// ============================ refresh token ============================
test("refresh token: format, prefix, entropy, uniqueness", () => {
  const t1 = M.generateRefreshToken();
  const t2 = M.generateRefreshToken();
  assert.ok(t1.startsWith(M.REFRESH_TOKEN_PREFIX));
  assert.ok(M.isValidRefreshTokenFormat(t1));
  assert.notEqual(t1, t2); // entropy
  const body = t1.slice(M.REFRESH_TOKEN_PREFIX.length);
  assert.ok(body.length >= M.REFRESH_TOKEN_MIN_BODY_LENGTH);
});

test("refresh token: rejects malformed / too long / non-string", () => {
  assert.equal(M.isValidRefreshTokenFormat(""), false);
  assert.equal(M.isValidRefreshTokenFormat("nope_" + "a".repeat(50)), false); // bad prefix
  assert.equal(M.isValidRefreshTokenFormat(M.REFRESH_TOKEN_PREFIX + "short"), false); // low entropy
  assert.equal(M.isValidRefreshTokenFormat(M.REFRESH_TOKEN_PREFIX + "!!!" + "a".repeat(43)), false); // bad char
  assert.equal(M.isValidRefreshTokenFormat(M.REFRESH_TOKEN_PREFIX + "a".repeat(M.REFRESH_TOKEN_MAX_LENGTH)), false); // too long
  assert.equal(M.isValidRefreshTokenFormat(12345), false);
  assert.equal(M.isValidRefreshTokenFormat(null), false);
});

test("refresh token: hash determinism and pepper sensitivity", () => {
  const t = M.generateRefreshToken();
  const h1 = M.hashRefreshToken(t, PEPPER);
  const h2 = M.hashRefreshToken(t, PEPPER);
  assert.equal(h1, h2);
  assert.match(h1, /^[0-9a-f]{64}$/); // HMAC-SHA-256 hex
  const other = "pepper_ffffffffffffffffffffffffffffffff";
  assert.notEqual(M.hashRefreshToken(t, other), h1); // different pepper -> different hash
});

test("refresh token: pepper minimum length enforced; error hides secrets", () => {
  const t = M.generateRefreshToken();
  const tinyPepper = "shhh_pepper_value_2b3c9"; // < 32 chars, distinctive
  try {
    M.hashRefreshToken(t, tinyPepper);
    assert.fail("expected throw");
  } catch (e) {
    assert.ok(e instanceof M.RefreshTokenError);
    assert.ok(!e.message.includes(t)); // no token echoed
    assert.ok(!e.message.includes(tinyPepper)); // no pepper value echoed
  }
  assert.ok(M.MIN_PEPPER_LENGTH >= 32);
});

test("refresh token: timing-safe verification path", () => {
  const t = M.generateRefreshToken();
  const h = M.hashRefreshToken(t, PEPPER);
  assert.equal(M.verifyRefreshTokenHash(t, h, PEPPER), true);
  assert.equal(M.verifyRefreshTokenHash(M.generateRefreshToken(), h, PEPPER), false); // wrong token
  assert.equal(M.verifyRefreshTokenHash(t, h, "pepper_ffffffffffffffffffffffffffffffff"), false); // wrong pepper
  assert.equal(M.verifyRefreshTokenHash(t, h.slice(0, -2) + "00", PEPPER), false); // tampered hash
  assert.equal(M.verifyRefreshTokenHash(t, "zz", PEPPER), false); // non-hex / length mismatch
  assert.equal(M.verifyRefreshTokenHash("bad-token", h, PEPPER), false); // malformed token
});

// ============================ access token claims ============================
const TYP = C.MOBILE_ACCESS_TOKEN_TYP;
const POLICY = { issuer: "gbmedix", audience: "mobile", maxTtlSeconds: 3600, clockSkewSeconds: 0 };
function claims(over = {}) {
  return { sub: "u1", sid: "s1", sv: 3, jti: "j1", typ: TYP, iss: "gbmedix", aud: "mobile", iat: 1000, exp: 1900, ...over };
}

test("access claims: valid set passes; typ/iss/aud enforced", () => {
  assert.equal(M.verifyAccessTokenClaims(claims(), POLICY, 1100).ok, true);
  // P3: a wrong typ is rejected by the strict literal schema as malformed_claims
  assert.equal(M.verifyAccessTokenClaims(claims({ typ: "other" }), POLICY, 1100).reason, "malformed_claims");
  assert.equal(M.verifyAccessTokenClaims(claims({ iss: "evil" }), POLICY, 1100).reason, "wrong_issuer");
  assert.equal(M.verifyAccessTokenClaims(claims({ aud: "web" }), POLICY, 1100).reason, "wrong_audience");
});

test("access claims: iat/exp/TTL and window", () => {
  assert.equal(M.verifyAccessTokenClaims(claims({ iat: 2000, exp: 2500 }), POLICY, 1100).reason, "not_yet_valid");
  assert.equal(M.verifyAccessTokenClaims(claims(), POLICY, 5000).reason, "expired");
  assert.equal(M.verifyAccessTokenClaims(claims({ iat: 1000, exp: 1000 }), POLICY, 1100).reason, "invalid_window");
  assert.equal(M.verifyAccessTokenClaims(claims({ iat: 1000, exp: 1000 + 4000 }), POLICY, 1100).reason, "ttl_too_long");
});

test("access claims: extra/sensitive fields rejected by strict schema", () => {
  assert.equal(M.verifyAccessTokenClaims(claims({ email: "a@b.com" }), POLICY, 1100).reason, "malformed_claims");
  assert.equal(M.verifyAccessTokenClaims(claims({ refreshToken: "x" }), POLICY, 1100).reason, "malformed_claims");
  assert.equal(M.verifyAccessTokenClaims(claims({ entitlement: "premium" }), POLICY, 1100).reason, "malformed_claims");
  assert.equal(M.verifyAccessTokenClaims(claims({ sv: -1 }), POLICY, 1100).reason, "malformed_claims"); // sv boundary
});

// ============================ bearer parsing ============================
test("bearer: valid, missing, and scheme rejections", () => {
  assert.deepEqual(M.parseBearerAuthorization("Bearer abc.def-123"), { ok: true, token: "abc.def-123" });
  assert.equal(M.parseBearerAuthorization(undefined).reason, "missing");
  assert.equal(M.parseBearerAuthorization(null).reason, "missing");
  assert.equal(M.parseBearerAuthorization("").reason, "missing");
  assert.equal(M.parseBearerAuthorization("Basic abc").reason, "malformed");
  assert.equal(M.parseBearerAuthorization("Token abc").reason, "malformed");
  assert.equal(M.parseBearerAuthorization("bearer abc").reason, "malformed"); // case-sensitive
});

test("bearer: empty/multiple tokens, comma, array, control chars", () => {
  assert.equal(M.parseBearerAuthorization("Bearer").reason, "malformed"); // no token
  assert.equal(M.parseBearerAuthorization("Bearer ").reason, "malformed"); // empty token
  assert.equal(M.parseBearerAuthorization("Bearer a b").reason, "malformed"); // multiple
  assert.equal(M.parseBearerAuthorization("Bearer a,Bearer b").reason, "malformed"); // comma
  assert.equal(M.parseBearerAuthorization(["Bearer a", "Bearer b"]).reason, "malformed"); // array
  assert.equal(M.parseBearerAuthorization("Bearer a\r\nb").reason, "malformed"); // CRLF
  assert.equal(M.parseBearerAuthorization("Bearer a\tb").reason, "malformed"); // tab/control
  // a bare token (as if taken from a cookie/query) has no "Bearer " scheme -> rejected
  assert.equal(M.parseBearerAuthorization("justatokenvalue").reason, "malformed");
});

// ============================ eligibility ============================
test("eligibility: active + verified + sv match required", () => {
  const facts = { exists: true, status: "active", emailVerifiedAt: 123, sessionVersion: 3 };
  assert.equal(M.evaluateMobileUserEligibility(facts, 3).ok, true);
  assert.equal(M.evaluateMobileUserEligibility(null, 3).reason, "user_not_found");
  assert.equal(M.evaluateMobileUserEligibility({ ...facts, exists: false }, 3).reason, "user_not_found");
  assert.equal(M.evaluateMobileUserEligibility({ ...facts, status: "pending" }, 3).reason, "not_active");
  assert.equal(M.evaluateMobileUserEligibility({ ...facts, emailVerifiedAt: null }, 3).reason, "email_not_verified");
  assert.equal(M.evaluateMobileUserEligibility(facts, 2).reason, "session_version_mismatch");
});

// ============================ device session helpers ============================
function session(over = {}) {
  return {
    id: "s1", userId: "u1", tokenFamilyId: "f1", status: "active", rotationCounter: 0,
    refreshTokenHash: "h0", createdAt: 100, lastUsedAt: 100,
    idleExpiresAt: 1000, absoluteExpiresAt: 5000, revokedAt: null, revokeReason: null, ...over
  };
}

test("session helpers: idle/absolute expiry and usability", () => {
  assert.equal(M.isSessionTimeExpired(session(), 500), false);
  assert.equal(M.isSessionTimeExpired(session(), 1000), true); // idle reached
  assert.equal(M.isSessionTimeExpired(session({ idleExpiresAt: 9000 }), 5000), true); // absolute reached
  assert.equal(M.isSessionUsable(session(), 500), true);
  assert.equal(M.isSessionUsable(session({ status: "revoked" }), 500), false);
  assert.equal(M.isSessionUsable(session({ status: "compromised" }), 500), false);
  assert.equal(M.isSessionUsable(session({ status: "expired" }), 500), false);
  assert.equal(M.isSessionUsable(session(), 1000), false); // time expired
});

test("session helpers: absolute expiry is a hard ceiling refresh cannot extend", () => {
  const s = session({ absoluteExpiresAt: 1200 });
  assert.equal(M.nextIdleExpiry(s, 500, 10000), 1200); // clamped to absolute, not 10500
  assert.equal(M.nextIdleExpiry(s, 500, 300), 800); // within absolute
});

// ============================ rotation / replay policy ============================
test("rotation policy: rotate / reject / replay decisions", () => {
  assert.equal(M.evaluateRefreshAttempt({ kind: "unknown" }, 500).reason, "session_not_found");
  const consumed = M.evaluateRefreshAttempt({ kind: "consumed", session: session() }, 500);
  assert.equal(consumed.action, "revoke_family");
  assert.equal(consumed.reason, "replay_detected");
  assert.equal(consumed.tokenFamilyId, "f1");

  const rotate = M.evaluateRefreshAttempt({ kind: "current", session: session() }, 500);
  assert.equal(rotate.action, "rotate");
  assert.equal(rotate.expectedRotationCounter, 0);
  assert.equal(rotate.expectedCurrentRefreshTokenHash, "h0");

  assert.equal(M.evaluateRefreshAttempt({ kind: "current", session: session({ status: "revoked" }) }, 500).reason, "session_revoked");
  assert.equal(M.evaluateRefreshAttempt({ kind: "current", session: session({ status: "compromised" }) }, 500).reason, "session_compromised");
  assert.equal(M.evaluateRefreshAttempt({ kind: "current", session: session() }, 1000).reason, "session_expired"); // time-expired
});

// ============================ store CAS + replay + revocation ============================
async function seedStore() {
  const store = new M.InMemoryDeviceSessionStore();
  const t0 = M.generateRefreshToken();
  const h0 = M.hashRefreshToken(t0, PEPPER);
  const s = await store.createSession({
    id: "s1", userId: "u1", tokenFamilyId: "f1", refreshTokenHash: h0,
    createdAt: 100, idleExpiresAt: 10000, absoluteExpiresAt: 100000
  });
  return { store, h0, s };
}

test("store: create/find and successful CAS rotation", async () => {
  const { store, h0 } = await seedStore();
  assert.equal((await store.findById("s1")).rotationCounter, 0);
  assert.ok(await store.findByRefreshTokenHash(h0));
  const hNew = M.hashRefreshToken(M.generateRefreshToken(), PEPPER);
  const r = await store.rotateRefreshTokenAtomically({
    sessionId: "s1", expectedRotationCounter: 0, expectedCurrentRefreshTokenHash: h0,
    newRefreshTokenHash: hNew, newIdleExpiresAt: 20000, now: 200
  });
  assert.equal(r.status, "rotated");
  assert.equal(r.session.rotationCounter, 1);
  assert.equal(r.session.refreshTokenHash, hNew);
});

test("store: stale counter conflicts; not_found / not_active / expired", async () => {
  const { store, h0 } = await seedStore();
  const hNew = M.hashRefreshToken(M.generateRefreshToken(), PEPPER);
  await store.rotateRefreshTokenAtomically({ sessionId: "s1", expectedRotationCounter: 0, expectedCurrentRefreshTokenHash: h0, newRefreshTokenHash: hNew, newIdleExpiresAt: 20000, now: 200 });
  // replay of old expected counter/hash now conflicts
  const stale = await store.rotateRefreshTokenAtomically({ sessionId: "s1", expectedRotationCounter: 0, expectedCurrentRefreshTokenHash: h0, newRefreshTokenHash: "deadbeef", newIdleExpiresAt: 30000, now: 300 });
  assert.equal(stale.status, "conflict");

  assert.equal((await store.rotateRefreshTokenAtomically({ sessionId: "missing", expectedRotationCounter: 0, expectedCurrentRefreshTokenHash: h0, newRefreshTokenHash: hNew, newIdleExpiresAt: 1, now: 1 })).status, "not_found");

  await store.revokeSession("s1", "user_logout", 400);
  assert.equal((await store.rotateRefreshTokenAtomically({ sessionId: "s1", expectedRotationCounter: 1, expectedCurrentRefreshTokenHash: hNew, newRefreshTokenHash: "x", newIdleExpiresAt: 1, now: 500 })).status, "not_active");
});

test("store: DOUBLE CONCURRENT rotation -> exactly one rotated, one conflict", async () => {
  const { store, h0 } = await seedStore();
  const hA = M.hashRefreshToken(M.generateRefreshToken(), PEPPER);
  const hB = M.hashRefreshToken(M.generateRefreshToken(), PEPPER);
  const base = { sessionId: "s1", expectedRotationCounter: 0, expectedCurrentRefreshTokenHash: h0, newIdleExpiresAt: 20000, now: 200 };
  const [r1, r2] = await Promise.all([
    store.rotateRefreshTokenAtomically({ ...base, newRefreshTokenHash: hA }),
    store.rotateRefreshTokenAtomically({ ...base, newRefreshTokenHash: hB })
  ]);
  const statuses = [r1.status, r2.status].sort();
  assert.deepEqual(statuses, ["conflict", "rotated"]);
  // Only one new refresh token is now valid; no two simultaneously-valid tokens.
  assert.equal((await store.findById("s1")).rotationCounter, 1);
});

test("store: consumed-token replay classifies as consumed -> revoke family", async () => {
  const { store, h0 } = await seedStore();
  const hNew = M.hashRefreshToken(M.generateRefreshToken(), PEPPER);
  await store.rotateRefreshTokenAtomically({ sessionId: "s1", expectedRotationCounter: 0, expectedCurrentRefreshTokenHash: h0, newRefreshTokenHash: hNew, newIdleExpiresAt: 20000, now: 200 });
  const lookup = store.classifyRefreshToken(h0); // old hash was consumed
  assert.equal(lookup.kind, "consumed");
  const decision = M.evaluateRefreshAttempt(lookup, 300);
  assert.equal(decision.action, "revoke_family");
  const revoked = await store.revokeTokenFamily(decision.tokenFamilyId, "refresh_replay", 300);
  assert.equal(revoked, 1);
  assert.equal((await store.findById("s1")).status, "revoked");
});

test("store: revokeAll and markCompromised", async () => {
  const { store } = await seedStore();
  assert.equal(await store.revokeAllUserSessions("u1", "user_logout_all", 500), 1);
  const { store: store2 } = await seedStore();
  await store2.markCompromised("s1", 600);
  assert.equal((await store2.findById("s1")).status, "compromised");
});

// ============================ device metadata privacy ============================
test("device metadata: allowlist only; forbidden keys rejected", () => {
  assert.equal(M.sanitizeDeviceMetadata({ platform: "ios", appVersion: "1.2.0" }).ok, true);
  assert.equal(M.sanitizeDeviceMetadata({ platform: "android", appVersion: "1.0", deviceLabel: "Pixel", locale: "en" }).ok, true);
  for (const bad of ["advertisingId", "imei", "androidId", "idfa", "mac", "preciseLocation", "userAgent", "deviceFingerprint", "serial", "email", "phone", "patientProfile"]) {
    const r = M.sanitizeDeviceMetadata({ platform: "ios", [bad]: "x" });
    assert.equal(r.ok, false, `${bad} must be rejected`);
    assert.ok(r.rejectedKeys.includes(bad));
  }
  assert.equal(M.sanitizeDeviceMetadata("not-an-object").ok, false);
  assert.equal(M.sanitizeDeviceMetadata({ appVersion: "bad version!" }).ok, false); // bad chars
});

// ============================ audit events ============================
test("audit: valid event builds; forbidden/unknown fields throw", () => {
  const e = M.buildMobileAuthAuditEvent({ event: "mobile_refresh_rotated", occurredAt: 100, userId: "u1", deviceSessionId: "s1", tokenFamilyId: "f1", reason: "rotated" });
  assert.equal(e.event, "mobile_refresh_rotated");
  for (const forbidden of ["accessToken", "refreshToken", "refreshTokenHash", "authorization", "cookie", "pepper", "email", "phone", "healthData", "paymentInfo"]) {
    assert.throws(
      () => M.buildMobileAuthAuditEvent({ event: "mobile_session_created", occurredAt: 1, [forbidden]: "secret" }),
      M.AuditValidationError,
      forbidden
    );
  }
  assert.throws(() => M.buildMobileAuthAuditEvent({ event: "not_a_real_event", occurredAt: 1 }), M.AuditValidationError);
});

test("audit: strict schema rejects forbidden fields structurally", () => {
  for (const f of M.FORBIDDEN_AUDIT_FIELDS) {
    assert.equal(M.mobileAuthAuditEventSchema.safeParse({ event: "mobile_session_created", occurredAt: 1, [f]: "x" }).success, false);
  }
});

// ============================ contract schemas ============================
test("contract: request/result schemas are strict", () => {
  assert.equal(C.mobileRefreshRequestSchema.safeParse({ refreshToken: "gbrt_v1_" + "a".repeat(43) }).success, true);
  assert.equal(C.mobileRefreshRequestSchema.safeParse({ refreshToken: "x", extra: 1 }).success, false);
  assert.equal(C.mobileLogoutAllRequestSchema.safeParse({}).success, true);
  assert.equal(C.mobileLogoutAllRequestSchema.safeParse({ userId: "u1" }).success, false); // no client userId
  assert.equal(C.accessTokenClaimsSchema.safeParse(claims()).success, true);
  assert.equal(C.accessTokenClaimsSchema.safeParse(claims({ email: "a@b.com" })).success, false);
});

// ==================== FIX-P1-001: policy / now numeric gate ====================
test("P1: invalid policy or now fails closed (never ok)", () => {
  const c = claims();
  const bad = (over, now = 1100) => M.verifyAccessTokenClaims(c, { ...POLICY, ...over }, now);
  for (const mt of [NaN, Infinity, -Infinity, 0, -5, 1.5]) {
    assert.equal(bad({ maxTtlSeconds: mt }).reason, "invalid_policy", `maxTtl ${mt}`);
  }
  for (const cs of [NaN, Infinity, -Infinity, -1, 2.5]) {
    assert.equal(bad({ clockSkewSeconds: cs }).reason, "invalid_policy", `skew ${cs}`);
  }
  for (const n of [NaN, Infinity, -Infinity, -1, 10.5]) {
    assert.equal(M.verifyAccessTokenClaims(c, POLICY, n).reason, "invalid_time", `now ${n}`);
  }
});

test("P1: Infinity policy inputs cannot fail open; exact expiry fails closed", () => {
  // over-long TTL: an Infinity maxTtl is rejected as invalid_policy, never ok
  assert.notEqual(M.verifyAccessTokenClaims(claims({ iat: 1000, exp: 1000 + 4000 }), { ...POLICY, maxTtlSeconds: Infinity }, 1100).ok, true);
  // expired token stays not-ok even if a caller passes Infinity skew
  assert.notEqual(M.verifyAccessTokenClaims(claims(), { ...POLICY, clockSkewSeconds: Infinity }, 5000).ok, true);
  // exact boundary: exp == now -> expired
  assert.equal(M.verifyAccessTokenClaims(claims({ iat: 1000, exp: 1900 }), POLICY, 1900).reason, "expired");
});

// ============ FIX-P2-001: strict refresh token contract schema ============
test("P2-001: contract refreshTokenSchema accept/reject matrix (single source)", () => {
  const good = M.generateRefreshToken();
  assert.equal(C.refreshTokenSchema.safeParse(good).success, true);
  const rejects = [
    "x",
    "gbrt_v2_" + "a".repeat(43), // wrong prefix
    "wrong_" + "a".repeat(43),
    "gbrt_v1_" + "a".repeat(10), // body too short
    "gbrt_v1_", // empty body
    "gbrt_v1_" + "a".repeat(43) + "+", // '+'
    "gbrt_v1_" + "a".repeat(43) + "/", // '/'
    "gbrt_v1_" + "a".repeat(43) + "=", // '='
    "gbrt_v1_" + "a".repeat(20) + " " + "a".repeat(23), // space
    "gbrt_v1_" + "a".repeat(300) // too long
  ];
  for (const t of rejects) assert.equal(C.refreshTokenSchema.safeParse(t).success, false, JSON.stringify(t.slice(0, 14)));
  for (const code of [13, 10, 9, 0]) {
    assert.equal(C.refreshTokenSchema.safeParse("gbrt_v1_" + "a".repeat(43) + String.fromCharCode(code)).success, false, `ctrl ${code}`);
  }
  // request / result / logout all enforce the SAME rule
  assert.equal(C.mobileRefreshRequestSchema.safeParse({ refreshToken: "x" }).success, false);
  assert.equal(C.mobileLogoutRequestSchema.safeParse({ refreshToken: "x" }).success, false);
  assert.equal(C.mobileRefreshResultSchema.safeParse({ accessToken: "a", refreshToken: "x", accessTokenExpiresInSeconds: 900, deviceSessionId: "s1" }).success, false);
  assert.equal(C.mobileRefreshRequestSchema.safeParse({ refreshToken: good }).success, true);
  // crypto util agrees with the contract (no drift)
  assert.equal(M.isValidRefreshTokenFormat(good), true);
  assert.equal(M.isValidRefreshTokenFormat("x"), false);
});

// ============ FIX-P2-002: store time / counter invariants ============
async function seedFor(over = {}) {
  const store = new M.InMemoryDeviceSessionStore();
  const h0 = M.hashRefreshToken(M.generateRefreshToken(), PEPPER);
  // Valid invariants by default: created < idle <= absolute.
  await store.createSession({
    id: "s1", userId: "u1", tokenFamilyId: "f1", refreshTokenHash: h0,
    createdAt: 100, idleExpiresAt: 1000, absoluteExpiresAt: 5000, ...over
  });
  return { store, h0 };
}

test("P2-002: newIdle clamps to absolute; never extends past ceiling", async () => {
  const hNew = M.hashRefreshToken(M.generateRefreshToken(), PEPPER);
  let { store, h0 } = await seedFor();
  let r = await store.rotateRefreshTokenAtomically({ sessionId: "s1", expectedRotationCounter: 0, expectedCurrentRefreshTokenHash: h0, newRefreshTokenHash: hNew, newIdleExpiresAt: 9000, now: 200 });
  assert.equal(r.status, "rotated");
  assert.equal(r.session.idleExpiresAt, 5000); // clamped to absolute, not 9000
  assert.ok(r.session.idleExpiresAt <= 5000);

  ({ store, h0 } = await seedFor());
  r = await store.rotateRefreshTokenAtomically({ sessionId: "s1", expectedRotationCounter: 0, expectedCurrentRefreshTokenHash: h0, newRefreshTokenHash: hNew, newIdleExpiresAt: 5000, now: 200 });
  assert.equal(r.session.idleExpiresAt, 5000); // == absolute allowed
});

test("P2-002: unsafe time/newIdle inputs -> invalid_input, no mutation", async () => {
  const hNew = M.hashRefreshToken(M.generateRefreshToken(), PEPPER);
  const bads = [
    { newIdleExpiresAt: 200 }, // == now
    { newIdleExpiresAt: 100 }, // < now
    { newIdleExpiresAt: NaN },
    { newIdleExpiresAt: Infinity },
    { newIdleExpiresAt: -Infinity },
    { newIdleExpiresAt: 2000.5 },
    { now: NaN },
    { now: 3.5 },
    { now: -1 }
  ];
  for (const bad of bads) {
    const { store, h0 } = await seedFor();
    const r = await store.rotateRefreshTokenAtomically({ sessionId: "s1", expectedRotationCounter: 0, expectedCurrentRefreshTokenHash: h0, newRefreshTokenHash: hNew, newIdleExpiresAt: 2000, now: 200, ...bad });
    assert.equal(r.status, "invalid_input", JSON.stringify(bad));
    const s = await store.findById("s1"); // reject path must not mutate
    assert.equal(s.rotationCounter, 0);
    assert.equal(s.refreshTokenHash, h0);
    assert.equal(s.idleExpiresAt, 1000);
  }
});

test("P2-002: absolute/idle expiry -> expired; unsafe counter -> invalid_input", async () => {
  const hNew = M.hashRefreshToken(M.generateRefreshToken(), PEPPER);
  let { store, h0 } = await seedFor({ idleExpiresAt: 150, absoluteExpiresAt: 150 });
  assert.equal((await store.rotateRefreshTokenAtomically({ sessionId: "s1", expectedRotationCounter: 0, expectedCurrentRefreshTokenHash: h0, newRefreshTokenHash: hNew, newIdleExpiresAt: 210, now: 200 })).status, "expired");
  ({ store, h0 } = await seedFor({ idleExpiresAt: 150 }));
  assert.equal((await store.rotateRefreshTokenAtomically({ sessionId: "s1", expectedRotationCounter: 0, expectedCurrentRefreshTokenHash: h0, newRefreshTokenHash: hNew, newIdleExpiresAt: 210, now: 200 })).status, "expired");
  // counter at unsafe boundary
  ({ store, h0 } = await seedFor({ rotationCounter: M.MAX_ROTATION_COUNTER, idleExpiresAt: 1e9, absoluteExpiresAt: 1e9 }));
  assert.equal((await store.rotateRefreshTokenAtomically({ sessionId: "s1", expectedRotationCounter: M.MAX_ROTATION_COUNTER, expectedCurrentRefreshTokenHash: h0, newRefreshTokenHash: hNew, newIdleExpiresAt: 5000, now: 200 })).status, "invalid_input");
});

test("P2-002: double concurrent CAS still yields one rotated, one conflict", async () => {
  const { store, h0 } = await seedFor({ idleExpiresAt: 1e9, absoluteExpiresAt: 1e9 });
  const hA = M.hashRefreshToken(M.generateRefreshToken(), PEPPER);
  const hB = M.hashRefreshToken(M.generateRefreshToken(), PEPPER);
  const base = { sessionId: "s1", expectedRotationCounter: 0, expectedCurrentRefreshTokenHash: h0, newIdleExpiresAt: 20000, now: 200 };
  const [r1, r2] = await Promise.all([
    store.rotateRefreshTokenAtomically({ ...base, newRefreshTokenHash: hA }),
    store.rotateRefreshTokenAtomically({ ...base, newRefreshTokenHash: hB })
  ]);
  assert.deepEqual([r1.status, r2.status].sort(), ["conflict", "rotated"]);
  assert.equal((await store.findById("s1")).rotationCounter, 1);
});

// ==== RR2-P2-001: fail closed on invalid/corrupt session state ====
test("RR2-A: createSession rejects invalid input BEFORE any write", async () => {
  const HASH = "hash_secret_zzz";
  const cases = [
    { createdAt: NaN }, { createdAt: Infinity }, { createdAt: -Infinity }, { createdAt: -1 }, { createdAt: 100.5 },
    { idleExpiresAt: NaN }, { idleExpiresAt: Infinity }, { idleExpiresAt: -Infinity }, { idleExpiresAt: -1 }, { idleExpiresAt: 100.5 },
    { absoluteExpiresAt: NaN }, { absoluteExpiresAt: Infinity }, { absoluteExpiresAt: -Infinity }, { absoluteExpiresAt: -1 }, { absoluteExpiresAt: 100.5 },
    { idleExpiresAt: 100 }, { idleExpiresAt: 50 }, // <= createdAt(100)
    { absoluteExpiresAt: 100 }, // <= createdAt
    { idleExpiresAt: 6000 }, // idle > absolute(5000)
    { rotationCounter: NaN }, { rotationCounter: Infinity }, { rotationCounter: -1 }, { rotationCounter: 1.5 }, { rotationCounter: Number.MAX_SAFE_INTEGER }
  ];
  for (const over of cases) {
    const store = new M.InMemoryDeviceSessionStore();
    let threw = null;
    try {
      await store.createSession({ id: "s1", userId: "u1", tokenFamilyId: "f1", refreshTokenHash: HASH, createdAt: 100, idleExpiresAt: 1000, absoluteExpiresAt: 5000, ...over });
    } catch (e) { threw = e; }
    assert.ok(threw instanceof M.DeviceSessionInvariantError, JSON.stringify(over));
    assert.ok(!threw.message.includes(HASH)); // no input echoed
    assert.equal(await store.findById("s1"), null); // no partial write
  }
});

test("RR2-B: corrupt persisted session -> invalid_input with zero mutation", async () => {
  const corruptions = [
    (r) => { r.absoluteExpiresAt = NaN; },
    (r) => { r.absoluteExpiresAt = Infinity; },
    (r) => { r.idleExpiresAt = NaN; },
    (r) => { r.idleExpiresAt = Infinity; },
    (r) => { r.idleExpiresAt = 6000; r.absoluteExpiresAt = 5000; }, // idle > absolute
    (r) => { r.createdAt = NaN; },
    (r) => { r.lastUsedAt = NaN; },
    (r) => { r.createdAt = 500; }, // lastUsedAt(100) < createdAt(500)
    (r) => { r.rotationCounter = NaN; },
    (r) => { r.status = "weird"; } // unknown status -> invalid_input (not not_active)
  ];
  const hNew = M.hashRefreshToken(M.generateRefreshToken(), PEPPER);
  for (const corrupt of corruptions) {
    const { store, h0 } = await seedFor();
    // Simulate a DB record that later became corrupt. byId is TS-private but a
    // plain runtime property; mutated ONLY here to inject corruption (no prod backdoor).
    const rec = store.byId.get("s1");
    corrupt(rec);
    const snapshot = { ...rec };
    const r = await store.rotateRefreshTokenAtomically({ sessionId: "s1", expectedRotationCounter: 0, expectedCurrentRefreshTokenHash: h0, newRefreshTokenHash: hNew, newIdleExpiresAt: 800, now: 200 });
    assert.equal(r.status, "invalid_input");
    assert.deepStrictEqual({ ...rec }, snapshot); // reject path mutated nothing
    assert.equal(store.classifyRefreshToken(h0).kind, "current"); // consumed history not grown
  }
});

test("RR2-C: Codex PoC — absolute NaN/Infinity + newIdle 999999 never rotates", async () => {
  const hNew = M.hashRefreshToken(M.generateRefreshToken(), PEPPER);
  for (const absVal of [NaN, Infinity]) {
    const { store, h0 } = await seedFor();
    store.byId.get("s1").absoluteExpiresAt = absVal; // corrupt absolute ceiling
    const r = await store.rotateRefreshTokenAtomically({ sessionId: "s1", expectedRotationCounter: 0, expectedCurrentRefreshTokenHash: h0, newRefreshTokenHash: hNew, newIdleExpiresAt: 999999, now: 200 });
    assert.notEqual(r.status, "rotated");
    assert.equal(r.status, "invalid_input");
    assert.equal((await store.findById("s1")).rotationCounter, 0);
    assert.notEqual((await store.findById("s1")).idleExpiresAt, 999999);
  }
});

test("RR2-D: legal rotation, clamp, exact deadlines, monotonic, reject-then-succeed", async () => {
  const hNew = M.hashRefreshToken(M.generateRefreshToken(), PEPPER);
  let { store, h0 } = await seedFor({ idleExpiresAt: 3000, absoluteExpiresAt: 5000 });
  let r = await store.rotateRefreshTokenAtomically({ sessionId: "s1", expectedRotationCounter: 0, expectedCurrentRefreshTokenHash: h0, newRefreshTokenHash: hNew, newIdleExpiresAt: 2500, now: 200 });
  assert.equal(r.status, "rotated");
  assert.equal(r.session.rotationCounter, 1); // monotonic
  assert.equal(r.session.idleExpiresAt, 2500);

  ({ store, h0 } = await seedFor({ idleExpiresAt: 1000, absoluteExpiresAt: 5000 }));
  r = await store.rotateRefreshTokenAtomically({ sessionId: "s1", expectedRotationCounter: 0, expectedCurrentRefreshTokenHash: h0, newRefreshTokenHash: hNew, newIdleExpiresAt: 99999, now: 200 });
  assert.equal(r.session.idleExpiresAt, 5000); // clamped to absolute

  ({ store, h0 } = await seedFor({ idleExpiresAt: 200, absoluteExpiresAt: 5000 }));
  assert.equal((await store.rotateRefreshTokenAtomically({ sessionId: "s1", expectedRotationCounter: 0, expectedCurrentRefreshTokenHash: h0, newRefreshTokenHash: hNew, newIdleExpiresAt: 400, now: 200 })).status, "expired"); // exact idle
  ({ store, h0 } = await seedFor({ idleExpiresAt: 200, absoluteExpiresAt: 200 }));
  assert.equal((await store.rotateRefreshTokenAtomically({ sessionId: "s1", expectedRotationCounter: 0, expectedCurrentRefreshTokenHash: h0, newRefreshTokenHash: hNew, newIdleExpiresAt: 400, now: 200 })).status, "expired"); // exact absolute

  // a rejected attempt does not block the next legal rotation
  ({ store, h0 } = await seedFor({ idleExpiresAt: 3000, absoluteExpiresAt: 5000 }));
  assert.equal((await store.rotateRefreshTokenAtomically({ sessionId: "s1", expectedRotationCounter: 0, expectedCurrentRefreshTokenHash: h0, newRefreshTokenHash: hNew, newIdleExpiresAt: NaN, now: 200 })).status, "invalid_input");
  assert.equal((await store.rotateRefreshTokenAtomically({ sessionId: "s1", expectedRotationCounter: 0, expectedCurrentRefreshTokenHash: h0, newRefreshTokenHash: hNew, newIdleExpiresAt: 2500, now: 200 })).status, "rotated");
});

test("RR2-E: time helpers fail closed on invalid input", () => {
  const s = session();
  assert.equal(M.isSessionTimeExpired(s, NaN), true);
  assert.equal(M.isSessionTimeExpired(s, Infinity), true);
  assert.equal(M.isSessionTimeExpired({ ...s, absoluteExpiresAt: NaN }, 500), true);
  assert.equal(M.isSessionTimeExpired({ ...s, idleExpiresAt: Infinity }, 500), true);
  assert.equal(M.isSessionTimeExpired(s, 500), false);
  assert.equal(M.isSessionTimeExpired(s, 1000), true); // idle boundary
  assert.equal(M.isSessionUsable(s, NaN), false);
  assert.equal(M.isSessionUsable({ ...s, idleExpiresAt: 6000, absoluteExpiresAt: 5000 }, 500), false); // idle > absolute
  assert.equal(M.isSessionUsable(s, 500), true);
  assert.equal(M.nextIdleExpiry(s, NaN, 100), null);
  assert.equal(M.nextIdleExpiry(s, 500, Infinity), null);
  assert.equal(M.nextIdleExpiry({ ...s, absoluteExpiresAt: NaN }, 500, 100), null);
  assert.equal(M.nextIdleExpiry(s, 500, 100), 600); // valid
});

// ============ FIX-P2-003A: audit reason controlled enum ============
test("P2-003A: audit reason is a controlled enum, no free text", () => {
  for (const reason of M.MOBILE_AUTH_AUDIT_REASONS) {
    assert.equal(M.buildMobileAuthAuditEvent({ event: "mobile_refresh_rotated", occurredAt: 1, reason }).reason, reason);
  }
  const injections = ["unknown_reason", "gbrt_v1_leakedtoken", "a@b.com", "line\nbreak", "tab\there", String.fromCharCode(0), "x".repeat(100), {}, []];
  for (const reason of injections) {
    assert.throws(() => M.buildMobileAuthAuditEvent({ event: "mobile_session_created", occurredAt: 1, reason }), M.AuditValidationError);
  }
});

// ============ FIX-P2-003B: device label hardening ============
test("P2-003B: device label accepts human/Unicode names, rejects unsafe/blank", () => {
  assert.equal(M.sanitizeDeviceMetadata({ deviceLabel: "Ann's iPhone" }).ok, true);
  assert.equal(M.sanitizeDeviceMetadata({ deviceLabel: "小明的手机" }).ok, true); // CJK
  assert.equal(M.sanitizeDeviceMetadata({ deviceLabel: "📱 Phone" }).ok, true); // emoji
  const trimmed = M.sanitizeDeviceMetadata({ deviceLabel: "  Pixel 8  " });
  assert.equal(trimmed.ok, true);
  assert.equal(trimmed.metadata.deviceLabel, "Pixel 8"); // surrounding whitespace trimmed
  assert.equal(M.sanitizeDeviceMetadata({ deviceLabel: "   " }).ok, false); // pure whitespace
  for (const code of [13, 10, 9, 0, 0x7f, 0x2028, 0x2029]) {
    assert.equal(M.sanitizeDeviceMetadata({ deviceLabel: "A" + String.fromCharCode(code) + "B" }).ok, false, `code ${code}`);
  }
  assert.equal(M.sanitizeDeviceMetadata({ deviceLabel: "a".repeat(65) }).ok, false); // too long
});

// ==================== B22B review: store invariant consistency ====================
test("B22B: isRevokeReason allowlist", () => {
  for (const r of M.REVOKE_REASONS) assert.equal(M.isRevokeReason(r), true);
  for (const bad of ["", "nope", "gbrt_v1_x", "a@b.com", "line\nbreak", {}, [], 123, null]) {
    assert.equal(M.isRevokeReason(bad), false);
  }
});

test("B22B: hasValidSessionInvariants enforces reason + active-implies-null", () => {
  const s = session();
  assert.equal(M.hasValidSessionInvariants(s), true);
  assert.equal(M.hasValidSessionInvariants({ ...s, revokeReason: "bogus" }), false);
  assert.equal(M.hasValidSessionInvariants({ ...s, revokedAt: 500 }), false); // active w/ revokedAt
  assert.equal(M.hasValidSessionInvariants({ ...s, revokeReason: "user_logout" }), false); // active w/ reason
  assert.equal(M.hasValidSessionInvariants({ ...s, status: "revoked", revokedAt: 500, revokeReason: "user_logout" }), true);
  assert.equal(M.hasValidSessionInvariants({ ...s, status: "revoked", revokedAt: NaN, revokeReason: "user_logout" }), false);
});

test("B22B: InMemory revoke methods reject invalid reason without state change", async () => {
  const store = new M.InMemoryDeviceSessionStore();
  const h = M.hashRefreshToken(M.generateRefreshToken(), PEPPER);
  await store.createSession({ id: "s1", userId: "u1", tokenFamilyId: "f1", refreshTokenHash: h, createdAt: 100, idleExpiresAt: 1000, absoluteExpiresAt: 5000 });
  for (const bad of ["bogus", "gbrt_v1_x", "a@b.com", "x\ny", {}, "x".repeat(100)]) {
    await assert.rejects(() => store.revokeSession("s1", bad, 200), M.DeviceSessionInvariantError);
  }
  assert.equal((await store.findById("s1")).status, "active");
  await assert.rejects(() => store.revokeTokenFamily("f1", "bogus", 200), M.DeviceSessionInvariantError);
  await assert.rejects(() => store.revokeAllUserSessions("u1", "bogus", 200), M.DeviceSessionInvariantError);
});

test("B22B: InMemory createSession enforces hash + family exclusivity", async () => {
  const store = new M.InMemoryDeviceSessionStore();
  const h = M.hashRefreshToken(M.generateRefreshToken(), PEPPER);
  await store.createSession({ id: "s1", userId: "u1", tokenFamilyId: "f1", refreshTokenHash: h, createdAt: 100, idleExpiresAt: 1000, absoluteExpiresAt: 5000 });
  await assert.rejects(() => store.createSession({ id: "s2", userId: "u1", tokenFamilyId: "f2", refreshTokenHash: h, createdAt: 100, idleExpiresAt: 1000, absoluteExpiresAt: 5000 }), M.DeviceSessionInvariantError);
  await assert.rejects(() => store.createSession({ id: "s3", userId: "u1", tokenFamilyId: "f1", refreshTokenHash: M.hashRefreshToken(M.generateRefreshToken(), PEPPER), createdAt: 100, idleExpiresAt: 1000, absoluteExpiresAt: 5000 }), M.DeviceSessionInvariantError);
});

test("B22B: InMemory rotate rejects reuse of a current or consumed hash", async () => {
  const store = new M.InMemoryDeviceSessionStore();
  const h0 = M.hashRefreshToken(M.generateRefreshToken(), PEPPER);
  await store.createSession({ id: "s1", userId: "u1", tokenFamilyId: "f1", refreshTokenHash: h0, createdAt: 100, idleExpiresAt: 1000, absoluteExpiresAt: 5000 });
  const hOther = M.hashRefreshToken(M.generateRefreshToken(), PEPPER);
  await store.createSession({ id: "s2", userId: "u1", tokenFamilyId: "f2", refreshTokenHash: hOther, createdAt: 100, idleExpiresAt: 1000, absoluteExpiresAt: 5000 });
  assert.equal((await store.rotateRefreshTokenAtomically({ sessionId: "s1", expectedRotationCounter: 0, expectedCurrentRefreshTokenHash: h0, newRefreshTokenHash: hOther, newIdleExpiresAt: 800, now: 200 })).status, "conflict");
  const hNew = M.hashRefreshToken(M.generateRefreshToken(), PEPPER);
  assert.equal((await store.rotateRefreshTokenAtomically({ sessionId: "s1", expectedRotationCounter: 0, expectedCurrentRefreshTokenHash: h0, newRefreshTokenHash: hNew, newIdleExpiresAt: 800, now: 200 })).status, "rotated");
  assert.equal((await store.rotateRefreshTokenAtomically({ sessionId: "s2", expectedRotationCounter: 0, expectedCurrentRefreshTokenHash: hOther, newRefreshTokenHash: h0, newIdleExpiresAt: 800, now: 200 })).status, "conflict");
});
