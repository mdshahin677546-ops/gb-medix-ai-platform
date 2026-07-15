// GB MEDIX AI Mobile Auth security controls - REAL PostgreSQL integration.
//
// Uses a one-shot isolated PostgreSQL database supplied by TEST_PG_* variables,
// applies the real Prisma migrations, and exercises DB-backed rate limiting,
// idempotency, transactional audit, 2/10/50 concurrency, and rollback. It never
// prints passwords, full DB URLs, token values, Authorization headers, or patient
// data.

import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";

const requireCjs = createRequire(import.meta.url);

function resolvePgConfig() {
  const password = process.env.TEST_PG_PASSWORD ?? process.env.PGPASSWORD;
  if (!password) throw new Error("Mobile auth security integration requires explicit isolated TEST_PG_PASSWORD.");
  return {
    host: process.env.TEST_PG_HOST ?? "127.0.0.1",
    port: process.env.TEST_PG_PORT ?? "5432",
    user: process.env.TEST_PG_USER ?? "postgres",
    password
  };
}
const PG = resolvePgConfig();

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
const outDir = mkdtempSync(join(process.cwd(), ".tmp-mauth-security-db-"));
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
const { PrismaClient } = requireCjs("@prisma/client");

const DBNAME = `gbmedix_masec_${Date.now()}_${randomBytes(4).toString("hex")}`;
const TEST_URL = `postgresql://${PG.user}:${encodeURIComponent(PG.password)}@${PG.host}:${PG.port}/${DBNAME}?schema=public`;
const adminEnv = { ...process.env, PGPASSWORD: PG.password };
function psql(sql, db = "postgres") {
  execFileSync("psql", ["-h", PG.host, "-U", PG.user, "-p", PG.port, "-d", db, "-v", "ON_ERROR_STOP=1", "-tAc", sql], { env: adminEnv, stdio: "pipe" });
}

let prisma;
let userId;
const BASE = 1_900_000_000;
const CONTROL = "test_control_key_0123456789abcdef0123456789AB";
const hex = () => randomBytes(32).toString("hex");
const rid = (p) => `${p}_${randomBytes(6).toString("hex")}`;

before(async () => {
  psql(`CREATE DATABASE "${DBNAME}"`);
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: TEST_URL },
    stdio: "pipe"
  });
  prisma = new PrismaClient({ datasources: { db: { url: TEST_URL } } });
  await prisma.$connect();
  const u = await prisma.user.create({ data: { email: `ma_${DBNAME}@t.local`, status: "active", emailVerifiedAt: new Date() } });
  userId = u.id;
});

after(async () => {
  try {
    if (prisma) await prisma.$disconnect();
    try { psql(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${DBNAME}' AND pid <> pg_backend_pid()`); } catch {}
    psql(`DROP DATABASE IF EXISTS "${DBNAME}"`);
  } finally {
    rmSync(outDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 150 });
  }
});

function securityStore(limit = 3) {
  return new M.PrismaMobileAuthSecurityControls(prisma, CONTROL, {
    refresh: { windowSeconds: 60, maxRequests: limit },
    logout: { windowSeconds: 60, maxRequests: limit },
    "logout-all": { windowSeconds: 60, maxRequests: limit }
  });
}

async function seedSession(store, over = {}) {
  const h0 = over.refreshTokenHash ?? hex();
  const id = over.id ?? rid("sess");
  const fam = over.tokenFamilyId ?? rid("fam");
  await store.createSession({
    id,
    userId,
    tokenFamilyId: fam,
    refreshTokenHash: h0,
    createdAt: BASE,
    idleExpiresAt: BASE + 1000,
    absoluteExpiresAt: BASE + 100000
  });
  return { id, fam, h0 };
}

test("migration added security-control tables and constraints", async () => {
  const tables = await prisma.$queryRawUnsafe(
    `SELECT tablename FROM pg_tables WHERE tablename IN ('MobileAuthRateLimitBucket','MobileAuthIdempotencyRecord','MobileAuthAuditLog')`
  );
  assert.equal(tables.length, 3);
  const checks = await prisma.$queryRawUnsafe(
    `SELECT conname FROM pg_constraint WHERE conname IN ('MobileAuthRateLimitBucket_count_check','MobileAuthIdempotencyRecord_status_check','MobileAuthAuditLog_event_check','MobileAuthAuditLog_endpoint_check','MobileAuthAuditLog_requestId_check')`
  );
  assert.equal(checks.length, 5);
});

test("idempotency binds key to endpoint/actor/credential/body and supports completed replay", async () => {
  const sec = securityStore();
  const subject = sec.credentialDigest("credential-a");
  const bodyDigest = sec.requestDigest("logout", { refreshToken: "gbrt_v1_" + "a".repeat(43) });
  const first = await sec.claimIdempotency({ endpoint: "logout", rawKey: "idem_0123456789abcdef", actorDigest: subject, credentialDigest: subject, requestDigest: bodyDigest, now: BASE + 1 });
  assert.equal(first.status, "claimed");
  await sec.completeIdempotency(first.id, BASE + 2);
  const persisted = await prisma.mobileAuthIdempotencyRecord.findUnique({ where: { id: first.id } });
  assert.equal(persisted.status, "completed");
  assert.equal(await prisma.mobileAuthIdempotencyRecord.count({ where: { keyDigest: sec.keyDigest("idem_0123456789abcdef") } }), 1);
  const replay = await sec.claimIdempotency({ endpoint: "logout", rawKey: "idem_0123456789abcdef", actorDigest: subject, credentialDigest: subject, requestDigest: bodyDigest, now: BASE + 3 });
  assert.equal(replay.status, "completed");
  const conflict = await sec.claimIdempotency({ endpoint: "refresh", rawKey: "idem_0123456789abcdef", actorDigest: subject, credentialDigest: subject, requestDigest: bodyDigest, now: BASE + 4 });
  assert.equal(conflict.status, "conflict");
});

test("rate limiter is DB-backed and deterministic under 2/10/50 workers", async () => {
  for (const workers of [2, 10, 50]) {
    const sec = securityStore(3);
    const subject = sec.credentialDigest(`subject-${workers}-${randomBytes(3).toString("hex")}`);
    const results = await Promise.all(Array.from({ length: workers }, () =>
      sec.checkRateLimit({ endpoint: "refresh", subjectDigest: subject, now: BASE + 10 })
    ));
    assert.equal(results.filter((r) => r.ok).length, Math.min(3, workers));
    assert.equal(results.filter((r) => !r.ok).length, Math.max(0, workers - 3));
    const rows = await prisma.mobileAuthRateLimitBucket.findMany({ where: { subjectDigest: subject } });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].count, Math.min(3, workers));
    assert.ok(rows[0].count >= 0);
  }
});

test("transactional audit failure rolls back refresh rotation", async () => {
  const store = new M.PrismaDeviceSessionStore(prisma);
  const session = await seedSession(store);
  const result = await store.rotateRefreshTokenAtomicallyWithAudit(
    {
      sessionId: session.id,
      expectedRotationCounter: 0,
      expectedCurrentRefreshTokenHash: session.h0,
      newRefreshTokenHash: hex(),
      newIdleExpiresAt: BASE + 2000,
      now: BASE + 20
    },
    {
      event: "mobile_refresh_rotated",
      occurredAt: BASE + 20,
      userId,
      deviceSessionId: session.id,
      reason: "rotated",
      outcome: "not_allowed"
    }
  );
  assert.equal(result.status, "invalid_input");
  const after = await store.findById(session.id);
  assert.equal(after.rotationCounter, 0);
  assert.equal(after.refreshTokenHash, session.h0);
  assert.equal(await prisma.consumedRefreshToken.count({ where: { deviceSessionId: session.id } }), 0);
  assert.equal(await prisma.mobileAuthAuditLog.count({ where: { deviceSessionId: session.id } }), 0);
});

test("valid transactional rotate writes audit and completed idempotency atomically", async () => {
  const store = new M.PrismaDeviceSessionStore(prisma);
  const sec = securityStore();
  const session = await seedSession(store);
  const subject = sec.credentialDigest(session.h0);
  const claim = await sec.claimIdempotency({
    endpoint: "refresh",
    rawKey: "idem_valid_rotate_012345",
    actorDigest: subject,
    credentialDigest: subject,
    requestDigest: sec.requestDigest("refresh", { refreshToken: "gbrt_v1_" + "b".repeat(43) }),
    now: BASE + 30
  });
  assert.equal(claim.status, "claimed");
  const rotated = await store.rotateRefreshTokenAtomicallyWithAudit(
    {
      sessionId: session.id,
      expectedRotationCounter: 0,
      expectedCurrentRefreshTokenHash: session.h0,
      newRefreshTokenHash: hex(),
      newIdleExpiresAt: BASE + 2000,
      now: BASE + 31
    },
    {
      event: "mobile_refresh_rotated",
      occurredAt: BASE + 31,
      userId,
      deviceSessionId: session.id,
      reason: "rotated",
      outcome: "success"
    },
    claim.id
  );
  assert.equal(rotated.status, "rotated");
  assert.equal(await prisma.mobileAuthAuditLog.count({ where: { deviceSessionId: session.id, event: "mobile_refresh_rotated" } }), 1);
  const idem = await prisma.mobileAuthIdempotencyRecord.findUnique({ where: { id: claim.id } });
  assert.equal(idem.status, "completed");
});

test("boundary audit persists fixed endpoint, reason, and requestId only", async () => {
  const requestId = `req-${randomBytes(6).toString("hex")}`;
  await M.persistMobileAuthBoundaryAudit(prisma, {
    endpoint: "refresh",
    requestId,
    reason: "query_rejected",
    occurredAt: BASE + 40
  });
  const rows = await prisma.$queryRaw`
    SELECT "event", "endpoint", "requestId", "reason", "outcome"
    FROM "MobileAuthAuditLog"
    WHERE "requestId" = ${requestId}
  `;
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    event: "mobile_auth_boundary_rejected",
    endpoint: "refresh",
    requestId,
    reason: "query_rejected",
    outcome: "denied"
  });
  await assert.rejects(() => M.persistMobileAuthBoundaryAudit(prisma, {
    endpoint: "refresh",
    requestId: `bad-${randomBytes(3).toString("hex")}`,
    reason: "boundary_rejected",
    occurredAt: BASE + 41
  }));
  await assert.rejects(() => prisma.$executeRaw`
    INSERT INTO "MobileAuthAuditLog"
      ("id", "event", "reason", "outcome", "occurredAt", "endpoint", "requestId")
    VALUES
      (${rid("audit")}, 'mobile_auth_boundary_rejected', 'query_rejected', 'denied', ${new Date((BASE + 42) * 1000)}, 'refresh', ${"bad\r\nrequest"})
  `);
});

test("audit tables do not contain forbidden token/header/body columns", async () => {
  const cols = await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns WHERE table_name IN ('MobileAuthRateLimitBucket','MobileAuthIdempotencyRecord','MobileAuthAuditLog')`
  );
  const names = cols.map((c) => c.column_name.toLowerCase());
  for (const bad of ["token", "authorization", "cookie", "email", "phone", "password", "rawerror", "stack", "sql", "requestbody", "idempotencykey"]) {
    assert.ok(!names.includes(bad), `forbidden column ${bad}`);
  }
});
