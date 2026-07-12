// Batch 2.2B — PrismaDeviceSessionStore integration tests against a REAL, one-shot
// PostgreSQL database. This suite provisions a unique random database, applies the
// real Prisma migration (`prisma migrate deploy`), and exercises the transactional
// store. It NEVER silently skips: if a one-shot PostgreSQL cannot be provisioned,
// the setup hook throws and the suite FAILS (it must never be reported as passing
// without a real database). No token, pepper, Authorization header, or health data
// is printed; DATABASE_URL is never logged.

import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";

const requireCjs = createRequire(import.meta.url);

// ---- compile the real TS store to CommonJS and require it ----
const MOBILE = "lib/mobile-auth/v1";
const CONTRACT = "lib/api-contract/v1";
function collectTs(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...collectTs(p));
    else if (e.name.endsWith(".ts")) out.push(p);
  }
  return out;
}
const outDir = mkdtempSync(join(process.cwd(), ".tmp-prismastore-"));
execFileSync(
  process.execPath,
  ["node_modules/typescript/bin/tsc", ...collectTs(CONTRACT), ...collectTs(MOBILE),
   "--outDir", outDir, "--rootDir", "lib", "--module", "commonjs", "--target", "es2020",
   "--moduleResolution", "node", "--esModuleInterop", "--strict", "--skipLibCheck"],
  { stdio: "pipe" }
);
const M = requireCjs(resolve(outDir, "mobile-auth/v1/index.js"));
const { PrismaClient } = requireCjs("@prisma/client");

// ---- one-shot database (local test PostgreSQL; connection is env-overridable) ----
const PG_HOST = process.env.TEST_PG_HOST ?? "127.0.0.1";
const PG_PORT = process.env.TEST_PG_PORT ?? "5432";
const PG_USER = process.env.TEST_PG_USER ?? "postgres";
const PG_PASSWORD = process.env.TEST_PG_PASSWORD ?? process.env.PGPASSWORD ?? "Yu520mama";
const DBNAME = `gbmedix_devsess_${Date.now()}_${randomBytes(4).toString("hex")}`;
const TEST_URL = `postgresql://${PG_USER}:${PG_PASSWORD}@${PG_HOST}:${PG_PORT}/${DBNAME}?schema=public`;
const adminEnv = { ...process.env, PGPASSWORD: PG_PASSWORD };
function psql(sql, db = "postgres") {
  execFileSync("psql", ["-h", PG_HOST, "-U", PG_USER, "-p", PG_PORT, "-d", db, "-v", "ON_ERROR_STOP=1", "-tAc", sql], { env: adminEnv, stdio: "pipe" });
}

let prisma;
const BASE = 1_800_000_000; // fixed epoch-seconds base (whole seconds)
const hex = () => randomBytes(32).toString("hex"); // 64 lowercase hex
let userId, otherUserId;

before(async () => {
  // Provision + migrate. Any failure here throws -> suite fails (never a silent skip).
  psql(`CREATE DATABASE "${DBNAME}"`);
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"],
    { env: { ...process.env, DATABASE_URL: TEST_URL }, stdio: "pipe" });
  prisma = new PrismaClient({ datasources: { db: { url: TEST_URL } } });
  await prisma.$connect();
  const u = await prisma.user.create({ data: { email: `a_${DBNAME}@t.local`, status: "active", emailVerifiedAt: new Date() } });
  const o = await prisma.user.create({ data: { email: `b_${DBNAME}@t.local`, status: "active", emailVerifiedAt: new Date() } });
  userId = u.id; otherUserId = o.id;
});

after(async () => {
  if (prisma) await prisma.$disconnect();
  try { psql(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${DBNAME}' AND pid <> pg_backend_pid()`); } catch { /* best effort */ }
  psql(`DROP DATABASE IF EXISTS "${DBNAME}"`);
  rmSync(outDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 150 });
});

function newStore() { return new M.PrismaDeviceSessionStore(prisma); }
async function seed(store, over = {}) {
  const h0 = hex();
  const id = `sess_${randomBytes(6).toString("hex")}`;
  const s = await store.createSession({
    id, userId, tokenFamilyId: over.tokenFamilyId ?? `fam_${randomBytes(4).toString("hex")}`,
    refreshTokenHash: h0, createdAt: BASE, idleExpiresAt: BASE + 1000, absoluteExpiresAt: BASE + 100000, ...over
  });
  return { store, id, h0, s };
}

// 1-3: migration applied, create/find mapping
test("migration applied + create/find round-trips with epoch mapping", async () => {
  const store = newStore();
  const { id, h0, s } = await seed(store);
  assert.equal(s.createdAt, BASE);
  assert.equal(s.idleExpiresAt, BASE + 1000);
  assert.equal(s.rotationCounter, 0);
  const byId = await store.findById(id);
  assert.equal(byId.refreshTokenHash, h0);
  assert.equal(byId.idleExpiresAt, BASE + 1000);
  const byHash = await store.findByRefreshTokenHash(h0);
  assert.equal(byHash.id, id);
  assert.equal(await store.findById("nope"), null);
});

// 4: invalid input rejected before write
test("createSession rejects invalid hash/time/counter (fail closed)", async () => {
  const store = newStore();
  const base = { id: `x_${hex().slice(0, 8)}`, userId, tokenFamilyId: "f", refreshTokenHash: hex(), createdAt: BASE, idleExpiresAt: BASE + 10, absoluteExpiresAt: BASE + 100 };
  for (const over of [
    { refreshTokenHash: "not-hex" }, { refreshTokenHash: "ABCDEF".repeat(10) + "abcd" },
    { createdAt: NaN }, { idleExpiresAt: Infinity }, { absoluteExpiresAt: BASE - 5 },
    { idleExpiresAt: BASE }, { idleExpiresAt: BASE + 200 /* > absolute */ },
    { rotationCounter: -1 }, { rotationCounter: 1.5 }, { rotationCounter: 2147483647 }
  ]) {
    await assert.rejects(
      () => store.createSession({ ...base, id: `x_${hex().slice(0, 8)}`, ...over }),
      M.DeviceSessionInvariantError, JSON.stringify(over)
    );
  }
});

// 5: user FK + cross-user isolation
test("user FK enforced; cross-user isolation", async () => {
  const store = newStore();
  await assert.rejects(() => store.createSession({ id: `fk_${hex().slice(0, 8)}`, userId: "ghost", tokenFamilyId: "f", refreshTokenHash: hex(), createdAt: BASE, idleExpiresAt: BASE + 10, absoluteExpiresAt: BASE + 100 }), M.DeviceSessionInvariantError);
  const a = await seed(store);
  const revoked = await store.revokeAllUserSessions(otherUserId, "user_logout_all", BASE + 5);
  assert.equal(revoked, 0); // other user's logout does not touch this session
  assert.equal((await store.findById(a.id)).status, "active");
});

// 6-7: unique constraints
test("current-hash and consumed-hash uniqueness enforced", async () => {
  const store = newStore();
  const shared = hex();
  await store.createSession({ id: `u1_${hex().slice(0, 6)}`, userId, tokenFamilyId: "f", refreshTokenHash: shared, createdAt: BASE, idleExpiresAt: BASE + 10, absoluteExpiresAt: BASE + 100 });
  await assert.rejects(() => store.createSession({ id: `u2_${hex().slice(0, 6)}`, userId, tokenFamilyId: "f", refreshTokenHash: shared, createdAt: BASE, idleExpiresAt: BASE + 10, absoluteExpiresAt: BASE + 100 }), M.DeviceSessionInvariantError);
  // consumed-hash unique: after a rotation, re-inserting the consumed hash fails
  const { id, h0 } = await seed(store);
  const r = await store.rotateRefreshTokenAtomically({ sessionId: id, expectedRotationCounter: 0, expectedCurrentRefreshTokenHash: h0, newRefreshTokenHash: hex(), newIdleExpiresAt: BASE + 2000, now: BASE + 10 });
  assert.equal(r.status, "rotated");
  await assert.rejects(() => prisma.consumedRefreshToken.create({ data: { deviceSessionId: id, tokenFamilyId: "f", refreshTokenHash: h0, consumedAt: new Date(), expiresAt: new Date() } }));
});

// 8: successful rotation writes session + consumed in the same tx
test("rotation updates session and inserts consumed history atomically", async () => {
  const store = newStore();
  const { id, h0 } = await seed(store);
  const hNew = hex();
  const r = await store.rotateRefreshTokenAtomically({ sessionId: id, expectedRotationCounter: 0, expectedCurrentRefreshTokenHash: h0, newRefreshTokenHash: hNew, newIdleExpiresAt: BASE + 2000, now: BASE + 10 });
  assert.equal(r.status, "rotated");
  assert.equal(r.session.rotationCounter, 1);
  assert.equal(r.session.refreshTokenHash, hNew);
  assert.equal(r.session.idleExpiresAt, BASE + 2000);
  const consumed = await prisma.consumedRefreshToken.findUnique({ where: { refreshTokenHash: h0 } });
  assert.ok(consumed);
  assert.equal(consumed.deviceSessionId, id);
  assert.equal(Math.floor(consumed.expiresAt.getTime() / 1000), BASE + 100000); // == absolute expiry
});

// 9: late failure rolls the WHOLE transaction back (no partial consumed history)
test("late failure rolls back consumed insert + session update", async () => {
  const store = newStore();
  const a = await seed(store);
  const b = await seed(store); // b.h0 is another CURRENT hash
  // Rotating a to b's current hash violates the unique index at the UPDATE step,
  // AFTER the consumed insert — the whole tx must roll back.
  const r = await store.rotateRefreshTokenAtomically({ sessionId: a.id, expectedRotationCounter: 0, expectedCurrentRefreshTokenHash: a.h0, newRefreshTokenHash: b.h0, newIdleExpiresAt: BASE + 2000, now: BASE + 10 });
  assert.equal(r.status, "conflict"); // unique violation normalized
  const after = await store.findById(a.id);
  assert.equal(after.rotationCounter, 0); // unchanged
  assert.equal(after.refreshTokenHash, a.h0); // unchanged
  assert.equal(await prisma.consumedRefreshToken.findUnique({ where: { refreshTokenHash: a.h0 } }), null); // rolled back
});

// 10 + 14: double concurrent CAS -> exactly one rotated, one conflict
test("double concurrent rotation: one rotated, one conflict, counter +1, one consumed", async () => {
  const store = newStore();
  const { id, h0 } = await seed(store);
  const base = { sessionId: id, expectedRotationCounter: 0, expectedCurrentRefreshTokenHash: h0, newIdleExpiresAt: BASE + 2000, now: BASE + 10 };
  const [r1, r2] = await Promise.all([
    store.rotateRefreshTokenAtomically({ ...base, newRefreshTokenHash: hex() }),
    store.rotateRefreshTokenAtomically({ ...base, newRefreshTokenHash: hex() })
  ]);
  assert.deepEqual([r1.status, r2.status].sort(), ["conflict", "rotated"]); // benign conflict, NOT replay
  assert.equal((await store.findById(id)).rotationCounter, 1);
  const consumedCount = await prisma.consumedRefreshToken.count({ where: { deviceSessionId: id } });
  assert.equal(consumedCount, 1);
});

// 11: revoked/compromised/expired do not rotate
test("revoked/compromised/expired sessions do not rotate", async () => {
  const store = newStore();
  let { id, h0 } = await seed(store);
  await store.revokeSession(id, "user_logout", BASE + 5);
  assert.equal((await store.rotateRefreshTokenAtomically({ sessionId: id, expectedRotationCounter: 0, expectedCurrentRefreshTokenHash: h0, newRefreshTokenHash: hex(), newIdleExpiresAt: BASE + 2000, now: BASE + 10 })).status, "not_active");
  ({ id, h0 } = await seed(store));
  await store.markCompromised(id, BASE + 5);
  assert.equal((await store.rotateRefreshTokenAtomically({ sessionId: id, expectedRotationCounter: 0, expectedCurrentRefreshTokenHash: h0, newRefreshTokenHash: hex(), newIdleExpiresAt: BASE + 2000, now: BASE + 10 })).status, "not_active");
  ({ id, h0 } = await seed(store, { idleExpiresAt: BASE + 20, absoluteExpiresAt: BASE + 20 }));
  assert.equal((await store.rotateRefreshTokenAtomically({ sessionId: id, expectedRotationCounter: 0, expectedCurrentRefreshTokenHash: h0, newRefreshTokenHash: hex(), newIdleExpiresAt: BASE + 30, now: BASE + 25 })).status, "expired");
});

// 12: absolute expiry hard ceiling (clamp)
test("new idle deadline is clamped to the absolute ceiling", async () => {
  const store = newStore();
  const { id, h0 } = await seed(store, { idleExpiresAt: BASE + 1000, absoluteExpiresAt: BASE + 5000 });
  const r = await store.rotateRefreshTokenAtomically({ sessionId: id, expectedRotationCounter: 0, expectedCurrentRefreshTokenHash: h0, newRefreshTokenHash: hex(), newIdleExpiresAt: BASE + 999999, now: BASE + 10 });
  assert.equal(r.status, "rotated");
  assert.equal(r.session.idleExpiresAt, BASE + 5000); // clamped, never beyond absolute
});

// 13: confirmed replay -> classify consumed + transactional family revoke
test("confirmed replay classifies consumed and revokes the whole family", async () => {
  const store = newStore();
  const fam = `fam_${randomBytes(4).toString("hex")}`;
  const a = await seed(store, { tokenFamilyId: fam });
  const b = await seed(store, { tokenFamilyId: fam }); // same family, still active
  const r = await store.rotateRefreshTokenAtomically({ sessionId: a.id, expectedRotationCounter: 0, expectedCurrentRefreshTokenHash: a.h0, newRefreshTokenHash: hex(), newIdleExpiresAt: BASE + 2000, now: BASE + 10 });
  assert.equal(r.status, "rotated");
  const cls = await store.classifyRefreshTokenHash(a.h0); // replayed old token
  assert.equal(cls.kind, "consumed");
  assert.equal(cls.tokenFamilyId, fam);
  const rev = await store.revokeFamilyOnReplay(a.h0, BASE + 20);
  assert.equal(rev.replay, true);
  assert.equal(rev.audit, "mobile_refresh_replay_detected");
  assert.ok(rev.revokedCount >= 2); // both a and b active sessions in the family
  assert.equal((await store.findById(a.id)).status, "revoked");
  assert.equal((await store.findById(b.id)).status, "revoked");
  // a genuinely unknown hash is not replay
  const none = await store.revokeFamilyOnReplay(hex(), BASE + 20);
  assert.equal(none.replay, false);
});

// 15-18: revocations
test("revokeSession / revokeTokenFamily / revokeAllUserSessions / markCompromised", async () => {
  const store = newStore();
  const a = await seed(store);
  await store.revokeSession(a.id, "user_logout", BASE + 5);
  assert.equal((await store.findById(a.id)).status, "revoked");

  const fam = `fam_${randomBytes(4).toString("hex")}`;
  await seed(store, { tokenFamilyId: fam }); await seed(store, { tokenFamilyId: fam });
  assert.equal(await store.revokeTokenFamily(fam, "token_family_revoked", BASE + 5), 2);

  const u = await prisma.user.create({ data: { email: `c_${hex().slice(0, 8)}@t.local`, status: "active", emailVerifiedAt: new Date() } });
  await store.createSession({ id: `us_${hex().slice(0, 6)}`, userId: u.id, tokenFamilyId: "f", refreshTokenHash: hex(), createdAt: BASE, idleExpiresAt: BASE + 10, absoluteExpiresAt: BASE + 100 });
  await store.createSession({ id: `us_${hex().slice(0, 6)}`, userId: u.id, tokenFamilyId: "g", refreshTokenHash: hex(), createdAt: BASE, idleExpiresAt: BASE + 10, absoluteExpiresAt: BASE + 100 });
  assert.equal(await store.revokeAllUserSessions(u.id, "user_logout_all", BASE + 5), 2);

  const c = await seed(store);
  await store.markCompromised(c.id, BASE + 5);
  assert.equal((await store.findById(c.id)).status, "compromised");
});

// 19: expired consumed cleanup boundary
test("purgeExpiredConsumedTokens deletes only past-retention rows", async () => {
  const store = newStore();
  const { id, h0 } = await seed(store, { idleExpiresAt: BASE + 300, absoluteExpiresAt: BASE + 500 });
  await store.rotateRefreshTokenAtomically({ sessionId: id, expectedRotationCounter: 0, expectedCurrentRefreshTokenHash: h0, newRefreshTokenHash: hex(), newIdleExpiresAt: BASE + 400, now: BASE + 10 });
  // consumed expiresAt == BASE+500
  assert.equal(await store.purgeExpiredConsumedTokens(BASE + 499), 0); // not yet
  assert.ok(await prisma.consumedRefreshToken.findUnique({ where: { refreshTokenHash: h0 } }));
  assert.equal(await store.purgeExpiredConsumedTokens(BASE + 500), 1); // boundary reached
  assert.equal(await prisma.consumedRefreshToken.findUnique({ where: { refreshTokenHash: h0 } }), null);
});

// 20: no sensitive columns exist in the two tables
test("device session tables carry no token/email/authorization/health columns", async () => {
  const cols = await prisma.$queryRawUnsafe(
    `SELECT table_name, column_name FROM information_schema.columns
     WHERE table_name IN ('DeviceSession','ConsumedRefreshToken')`
  );
  const names = cols.map((c) => c.column_name.toLowerCase());
  for (const forbidden of ["email", "phone", "token", "accesstoken", "refreshtoken", "authorization", "cookie", "pepper", "password", "health", "payment", "fingerprint", "ip"]) {
    assert.ok(!names.includes(forbidden), `forbidden column ${forbidden}`);
  }
  // only hashes/ids/status/times are present
  assert.ok(names.includes("refreshtokenhash"));
  assert.ok(names.includes("rotationcounter"));
});
