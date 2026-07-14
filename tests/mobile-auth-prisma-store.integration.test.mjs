// Batch 2.2B — PrismaDeviceSessionStore integration tests against a REAL, one-shot
// PostgreSQL database. Provisions a unique random database, applies the real Prisma
// migration, and exercises the transactional store. It NEVER silently skips: if
// isolated test credentials are not provided or a one-shot PostgreSQL cannot be
// provisioned, the setup hook throws and the suite FAILS. There is NO hardcoded
// password/URL fallback. No token, hash, pepper, Authorization header, health data,
// password, or DATABASE_URL is printed.

import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";

const requireCjs = createRequire(import.meta.url);

// ---- isolated test credentials — REQUIRED, resolved FIRST (before any temp dir) ----
// Provide TEST_DATABASE_ADMIN_URL (postgres://user:pass@host:port/postgres) OR the
// discrete TEST_PG_* / PGPASSWORD env. Missing config throws a fixed error at module
// load — BEFORE the compile temp dir is created — so a credential-less run fails
// clean (fixed error, no PG.host TypeError, no .tmp-prismastore-* residue) and never
// falls back to a hardcoded or shared database.
function resolvePgConfig() {
  const adminUrl = process.env.TEST_DATABASE_ADMIN_URL;
  if (adminUrl) {
    const u = new URL(adminUrl);
    if (!u.password) throw new Error("TEST_DATABASE_ADMIN_URL must include a password.");
    return { host: u.hostname, port: u.port || "5432", user: decodeURIComponent(u.username), password: decodeURIComponent(u.password) };
  }
  const password = process.env.TEST_PG_PASSWORD ?? process.env.PGPASSWORD;
  if (!password) {
    throw new Error("DeviceSession integration suite requires TEST_PG_PASSWORD (or TEST_DATABASE_ADMIN_URL). Refusing to run without explicit isolated test credentials.");
  }
  return { host: process.env.TEST_PG_HOST ?? "127.0.0.1", port: process.env.TEST_PG_PORT ?? "5432", user: process.env.TEST_PG_USER ?? "postgres", password };
}
const PG = resolvePgConfig();

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

const DBNAME = `gbmedix_devsess_${Date.now()}_${randomBytes(4).toString("hex")}`;
const TEST_URL = `postgresql://${PG.user}:${encodeURIComponent(PG.password)}@${PG.host}:${PG.port}/${DBNAME}?schema=public`;
const adminEnv = { ...process.env, PGPASSWORD: PG.password };
function psql(sql, db = "postgres") {
  execFileSync("psql", ["-h", PG.host, "-U", PG.user, "-p", PG.port, "-d", db, "-v", "ON_ERROR_STOP=1", "-tAc", sql], { env: adminEnv, stdio: "pipe" });
}

/** Remove this run's temp compile dir; never let cleanup hide a leak silently. */
function cleanupTempDir() {
  rmSync(outDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 150 });
}

let prisma;
const BASE = 1_800_000_000; // fixed epoch-seconds base (whole seconds)
const hex = () => randomBytes(32).toString("hex"); // 64 lowercase hex
const rid = (p) => `${p}_${randomBytes(6).toString("hex")}`;
let userId, otherUserId;

before(async () => {
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
  // Temp is ALWAYS removed (finally). A real DROP failure still surfaces (thrown
  // after cleanup) — never a silent pass; PG is always defined here (resolved at
  // module load, so a credential-less run never reaches this hook).
  try {
    if (prisma) await prisma.$disconnect();
    try { psql(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${DBNAME}' AND pid <> pg_backend_pid()`); } catch { /* best effort */ }
    psql(`DROP DATABASE IF EXISTS "${DBNAME}"`);
  } finally {
    cleanupTempDir();
  }
});

function newStore() { return new M.PrismaDeviceSessionStore(prisma); }
// One session == one token family (families are globally unique).
async function seed(store, over = {}) {
  const h0 = over.refreshTokenHash ?? hex();
  const id = over.id ?? rid("sess");
  const tokenFamilyId = over.tokenFamilyId ?? rid("fam");
  const uid = over.userId ?? userId;
  const s = await store.createSession({
    id, userId: uid, tokenFamilyId, refreshTokenHash: h0,
    createdAt: over.createdAt ?? BASE, idleExpiresAt: over.idleExpiresAt ?? BASE + 1000,
    absoluteExpiresAt: over.absoluteExpiresAt ?? BASE + 100000, rotationCounter: over.rotationCounter
  });
  return { store, id, h0, fam: tokenFamilyId, s };
}

// 1-3
test("migration applied + create/find round-trips with epoch mapping", async () => {
  const store = newStore();
  const { id, h0, s } = await seed(store);
  assert.equal(s.createdAt, BASE);
  assert.equal(s.idleExpiresAt, BASE + 1000);
  assert.equal((await store.findById(id)).refreshTokenHash, h0);
  assert.equal((await store.findByRefreshTokenHash(h0)).id, id);
  assert.equal(await store.findById("nope"), null);
});

// 4
test("createSession rejects invalid hash/time/counter", async () => {
  const store = newStore();
  const base = { userId, tokenFamilyId: rid("f"), refreshTokenHash: hex(), createdAt: BASE, idleExpiresAt: BASE + 10, absoluteExpiresAt: BASE + 100 };
  for (const over of [
    { refreshTokenHash: "not-hex" }, { refreshTokenHash: "ABCDEF".repeat(10) + "abcd" },
    { createdAt: NaN }, { idleExpiresAt: Infinity }, { absoluteExpiresAt: BASE - 5 },
    { idleExpiresAt: BASE }, { idleExpiresAt: BASE + 200 }, { rotationCounter: -1 }, { rotationCounter: 1.5 }, { rotationCounter: 2147483647 }
  ]) {
    await assert.rejects(() => store.createSession({ ...base, id: rid("x"), tokenFamilyId: rid("f"), refreshTokenHash: over.refreshTokenHash ?? hex(), ...over }), M.DeviceSessionInvariantError, JSON.stringify(over));
  }
});

// 5 + B22B-P1-001: family global uniqueness + cross-user isolation
test("tokenFamilyId is globally unique (same and cross user); FK enforced", async () => {
  const store = newStore();
  const fam = rid("fam");
  await seed(store, { tokenFamilyId: fam });
  // same user reusing the family -> rejected
  await assert.rejects(() => store.createSession({ id: rid("s"), userId, tokenFamilyId: fam, refreshTokenHash: hex(), createdAt: BASE, idleExpiresAt: BASE + 10, absoluteExpiresAt: BASE + 100 }), M.DeviceSessionInvariantError);
  // DIFFERENT user reusing the family -> rejected (no cross-user family sharing)
  await assert.rejects(() => store.createSession({ id: rid("s"), userId: otherUserId, tokenFamilyId: fam, refreshTokenHash: hex(), createdAt: BASE, idleExpiresAt: BASE + 10, absoluteExpiresAt: BASE + 100 }), M.DeviceSessionInvariantError);
  // FK
  await assert.rejects(() => store.createSession({ id: rid("s"), userId: "ghost", tokenFamilyId: rid("fam"), refreshTokenHash: hex(), createdAt: BASE, idleExpiresAt: BASE + 10, absoluteExpiresAt: BASE + 100 }), M.DeviceSessionInvariantError);
  // DB unique index exists
  const idx = await prisma.$queryRawUnsafe(`SELECT indexname FROM pg_indexes WHERE tablename='DeviceSession' AND indexname='DeviceSession_tokenFamilyId_key'`);
  assert.equal(idx.length, 1);
});

// 6 + B22B-P2-002: cross-table hash exclusivity
test("hash exclusivity: consumed hash cannot become current (create or rotate)", async () => {
  const store = newStore();
  const { id, h0 } = await seed(store);
  const r = await store.rotateRefreshTokenAtomically({ sessionId: id, expectedRotationCounter: 0, expectedCurrentRefreshTokenHash: h0, newRefreshTokenHash: hex(), newIdleExpiresAt: BASE + 2000, now: BASE + 10 });
  assert.equal(r.status, "rotated"); // h0 now consumed
  // createSession reusing a consumed hash -> rejected
  await assert.rejects(() => store.createSession({ id: rid("s"), userId, tokenFamilyId: rid("fam"), refreshTokenHash: h0, createdAt: BASE, idleExpiresAt: BASE + 10, absoluteExpiresAt: BASE + 100 }), M.DeviceSessionInvariantError);
  // rotate another session's new hash to a consumed hash -> conflict
  const b = await seed(store);
  assert.equal((await store.rotateRefreshTokenAtomically({ sessionId: b.id, expectedRotationCounter: 0, expectedCurrentRefreshTokenHash: b.h0, newRefreshTokenHash: h0, newIdleExpiresAt: BASE + 2000, now: BASE + 10 })).status, "conflict");
  // createSession reusing a CURRENT hash -> rejected
  await assert.rejects(() => store.createSession({ id: rid("s"), userId, tokenFamilyId: rid("fam"), refreshTokenHash: b.h0, createdAt: BASE, idleExpiresAt: BASE + 10, absoluteExpiresAt: BASE + 100 }), M.DeviceSessionInvariantError);
});

// 7 + B22B: two concurrent sessions -> same new hash: one wins, one conflict
test("two sessions rotating to the SAME new hash: exactly one succeeds", async () => {
  const store = newStore();
  const a = await seed(store); const b = await seed(store);
  const shared = hex();
  const [ra, rb] = await Promise.all([
    store.rotateRefreshTokenAtomically({ sessionId: a.id, expectedRotationCounter: 0, expectedCurrentRefreshTokenHash: a.h0, newRefreshTokenHash: shared, newIdleExpiresAt: BASE + 2000, now: BASE + 10 }),
    store.rotateRefreshTokenAtomically({ sessionId: b.id, expectedRotationCounter: 0, expectedCurrentRefreshTokenHash: b.h0, newRefreshTokenHash: shared, newIdleExpiresAt: BASE + 2000, now: BASE + 10 })
  ]);
  assert.deepEqual([ra.status, rb.status].sort(), ["conflict", "rotated"]);
});

// 8-9: atomic write + rollback
test("rotation writes session + consumed atomically; late failure rolls back", async () => {
  const store = newStore();
  const { id, h0 } = await seed(store);
  const hNew = hex();
  const r = await store.rotateRefreshTokenAtomically({ sessionId: id, expectedRotationCounter: 0, expectedCurrentRefreshTokenHash: h0, newRefreshTokenHash: hNew, newIdleExpiresAt: BASE + 2000, now: BASE + 10 });
  assert.equal(r.status, "rotated");
  assert.equal(r.session.rotationCounter, 1);
  const consumed = await prisma.consumedRefreshToken.findUnique({ where: { refreshTokenHash: h0 } });
  assert.ok(consumed && consumed.deviceSessionId === id);
  assert.equal(Math.floor(consumed.expiresAt.getTime() / 1000), BASE + 100000);

  // late failure: rotate to another session's current hash -> unique violation at
  // the UPDATE, after the consumed insert -> whole tx rolls back.
  const a = await seed(store); const b = await seed(store);
  const rr = await store.rotateRefreshTokenAtomically({ sessionId: a.id, expectedRotationCounter: 0, expectedCurrentRefreshTokenHash: a.h0, newRefreshTokenHash: b.h0, newIdleExpiresAt: BASE + 2000, now: BASE + 10 });
  assert.equal(rr.status, "conflict");
  assert.equal((await store.findById(a.id)).rotationCounter, 0);
  assert.equal(await prisma.consumedRefreshToken.findUnique({ where: { refreshTokenHash: a.h0 } }), null); // rolled back
});

// 10: existing double concurrent CAS on the SAME session
test("double concurrent CAS on one session: one rotated, one conflict, counter +1, one consumed", async () => {
  const store = newStore();
  const { id, h0 } = await seed(store);
  const base = { sessionId: id, expectedRotationCounter: 0, expectedCurrentRefreshTokenHash: h0, newIdleExpiresAt: BASE + 2000, now: BASE + 10 };
  const [r1, r2] = await Promise.all([
    store.rotateRefreshTokenAtomically({ ...base, newRefreshTokenHash: hex() }),
    store.rotateRefreshTokenAtomically({ ...base, newRefreshTokenHash: hex() })
  ]);
  assert.deepEqual([r1.status, r2.status].sort(), ["conflict", "rotated"]);
  assert.equal((await store.findById(id)).rotationCounter, 1);
  assert.equal(await prisma.consumedRefreshToken.count({ where: { deviceSessionId: id } }), 1);
});

// 11: revoked/compromised/expired do not rotate; absolute clamp
test("revoked/compromised/expired don't rotate; new idle clamps to absolute", async () => {
  const store = newStore();
  let s = await seed(store);
  await store.revokeSession(s.id, "user_logout", BASE + 5);
  assert.equal((await store.rotateRefreshTokenAtomically({ sessionId: s.id, expectedRotationCounter: 0, expectedCurrentRefreshTokenHash: s.h0, newRefreshTokenHash: hex(), newIdleExpiresAt: BASE + 2000, now: BASE + 10 })).status, "not_active");
  s = await seed(store); await store.markCompromised(s.id, BASE + 5);
  assert.equal((await store.rotateRefreshTokenAtomically({ sessionId: s.id, expectedRotationCounter: 0, expectedCurrentRefreshTokenHash: s.h0, newRefreshTokenHash: hex(), newIdleExpiresAt: BASE + 2000, now: BASE + 10 })).status, "not_active");
  s = await seed(store, { idleExpiresAt: BASE + 20, absoluteExpiresAt: BASE + 20 });
  assert.equal((await store.rotateRefreshTokenAtomically({ sessionId: s.id, expectedRotationCounter: 0, expectedCurrentRefreshTokenHash: s.h0, newRefreshTokenHash: hex(), newIdleExpiresAt: BASE + 30, now: BASE + 25 })).status, "expired");
  s = await seed(store, { idleExpiresAt: BASE + 1000, absoluteExpiresAt: BASE + 5000 });
  const r = await store.rotateRefreshTokenAtomically({ sessionId: s.id, expectedRotationCounter: 0, expectedCurrentRefreshTokenHash: s.h0, newRefreshTokenHash: hex(), newIdleExpiresAt: BASE + 999999, now: BASE + 10 });
  assert.equal(r.session.idleExpiresAt, BASE + 5000);
});

// 12 + B22B-P1-001: replay revokes ONLY the correct session's family
test("confirmed replay revokes only the owning session; other users stay active", async () => {
  const store = newStore();
  const a = await seed(store); // fam A, user
  const other = await seed(store, { userId: otherUserId }); // different family + user, stays active
  await store.rotateRefreshTokenAtomically({ sessionId: a.id, expectedRotationCounter: 0, expectedCurrentRefreshTokenHash: a.h0, newRefreshTokenHash: hex(), newIdleExpiresAt: BASE + 2000, now: BASE + 10 });
  const cls = await store.classifyRefreshTokenHash(a.h0);
  assert.equal(cls.kind, "consumed");
  assert.equal(cls.tokenFamilyId, a.fam);
  const rev = await store.revokeFamilyOnReplay(a.h0, BASE + 20);
  assert.equal(rev.replay, true);
  assert.equal(rev.audit, "mobile_refresh_replay_detected");
  assert.equal(rev.revokedCount, 1); // exactly the one session in that family
  assert.equal((await store.findById(a.id)).status, "revoked");
  assert.equal((await store.findById(other.id)).status, "active"); // untouched
  assert.equal((await store.revokeFamilyOnReplay(hex(), BASE + 20)).replay, false);
});

// 13 + B22B-P2-001: runtime revokeReason matrix
test("revoke methods reject non-allowlisted reasons (DB unchanged)", async () => {
  const store = newStore();
  const s = await seed(store);
  for (const bad of ["bogus", "gbrt_v1_x", "a@b.com", "x\ny", "x".repeat(100)]) {
    await assert.rejects(() => store.revokeSession(s.id, bad, BASE + 5), M.DeviceSessionInvariantError);
  }
  assert.equal((await store.findById(s.id)).status, "active"); // unchanged
  await assert.rejects(() => store.revokeTokenFamily(s.fam, "bogus", BASE + 5), M.DeviceSessionInvariantError);
  await assert.rejects(() => store.revokeAllUserSessions(userId, "bogus", BASE + 5), M.DeviceSessionInvariantError);
  // valid revoke works
  await store.revokeSession(s.id, "user_logout", BASE + 5);
  assert.equal((await store.findById(s.id)).status, "revoked");
});

// 14 + B22B-P2-003: corrupted persisted rows fail closed on find/classify
test("sub-second persisted timestamp fails closed on find and classify", async () => {
  const store = newStore();
  const { id, h0 } = await seed(store, { idleExpiresAt: BASE + 1000, absoluteExpiresAt: BASE + 100000 });
  // Inject a millisecond fraction (allowed by TIMESTAMP(3) + CHECKs) -> not a whole second.
  await prisma.$executeRawUnsafe(`UPDATE "DeviceSession" SET "idleExpiresAt" = "idleExpiresAt" + interval '500 milliseconds' WHERE "id" = $1`, id);
  await assert.rejects(() => store.findById(id), M.DeviceSessionInvariantError);
  await assert.rejects(() => store.findByRefreshTokenHash(h0), M.DeviceSessionInvariantError);
  await assert.rejects(() => store.classifyRefreshTokenHash(h0), M.DeviceSessionInvariantError);
});

// 15 + B22B-P2-002: cross-table duplicate -> classify fails closed (never masks replay)
test("cross-table duplicate hash makes classify fail closed", async () => {
  const store = newStore();
  const { id, h0, fam } = await seed(store);
  // Force a consumed row with the SAME hash as a current session (raw insert).
  await prisma.$executeRawUnsafe(
    `INSERT INTO "ConsumedRefreshToken"("id","deviceSessionId","tokenFamilyId","refreshTokenHash","consumedAt","expiresAt") VALUES ($1,$2,$3,$4, now(), now())`,
    rid("con"), id, fam, h0
  );
  await assert.rejects(() => store.classifyRefreshTokenHash(h0), M.DeviceSessionInvariantError);
});

// 16-18: revocations + purge
test("revoke family/all + purge expired consumed boundary", async () => {
  const store = newStore();
  const s = await seed(store);
  assert.equal(await store.revokeTokenFamily(s.fam, "token_family_revoked", BASE + 5), 1);
  const u = await prisma.user.create({ data: { email: `c_${hex().slice(0, 8)}@t.local`, status: "active", emailVerifiedAt: new Date() } });
  await seed(store, { userId: u.id }); await seed(store, { userId: u.id });
  assert.equal(await store.revokeAllUserSessions(u.id, "user_logout_all", BASE + 5), 2);
  const p = await seed(store, { idleExpiresAt: BASE + 300, absoluteExpiresAt: BASE + 500 });
  await store.rotateRefreshTokenAtomically({ sessionId: p.id, expectedRotationCounter: 0, expectedCurrentRefreshTokenHash: p.h0, newRefreshTokenHash: hex(), newIdleExpiresAt: BASE + 400, now: BASE + 10 });
  // p's consumed row expires at BASE+500; it survives a purge at 499 and dies at 500.
  // (Scoped to p's own row — the global purge count depends on other tests' data.)
  await store.purgeExpiredConsumedTokens(BASE + 499);
  assert.ok(await prisma.consumedRefreshToken.findUnique({ where: { refreshTokenHash: p.h0 } }));
  const purged = await store.purgeExpiredConsumedTokens(BASE + 500);
  assert.ok(purged >= 1);
  assert.equal(await prisma.consumedRefreshToken.findUnique({ where: { refreshTokenHash: p.h0 } }), null);
});

// 19: migration constraints exist (unique family + revokeReason + active-null CHECKs)
test("migration created the unique family index and CHECK constraints", async () => {
  const checks = await prisma.$queryRawUnsafe(
    `SELECT conname FROM pg_constraint WHERE conname IN ('DeviceSession_revokeReason_check','DeviceSession_active_no_revocation_check','DeviceSession_status_check','DeviceSession_rotationCounter_range_check')`
  );
  assert.equal(checks.length, 4);
  const badReason = prisma.$executeRawUnsafe(`UPDATE "DeviceSession" SET "revokeReason" = 'evil' WHERE false`);
  await badReason; // no rows; constraint still present (asserted above)
});

// 20: no sensitive columns
test("device session tables carry no token/email/authorization/health columns", async () => {
  const cols = await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns WHERE table_name IN ('DeviceSession','ConsumedRefreshToken')`
  );
  const names = cols.map((c) => c.column_name.toLowerCase());
  for (const f of ["email", "phone", "token", "accesstoken", "refreshtoken", "authorization", "cookie", "pepper", "password", "health", "payment", "fingerprint", "ip"]) {
    assert.ok(!names.includes(f), `forbidden column ${f}`);
  }
  assert.ok(names.includes("refreshtokenhash") && names.includes("rotationcounter"));
});
