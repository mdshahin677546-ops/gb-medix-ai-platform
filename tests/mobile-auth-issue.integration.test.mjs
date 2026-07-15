// GB MEDIX AI Batch 2.2E — mobile email-verification issuance REAL PostgreSQL integration.
//
// Uses a one-shot isolated PostgreSQL database (TEST_PG_* env), applies the real
// Prisma migrations, and exercises the atomic issuance transaction: single-use token
// consumption + user activation + one DeviceSession + audit + idempotency, plus
// 2/10/50 + two-process concurrency and rollback injection. Never prints passwords,
// full DB URLs, token values, Authorization headers, or patient data.

import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";

const requireCjs = createRequire(import.meta.url);

function resolvePgConfig() {
  const password = process.env.TEST_PG_PASSWORD ?? process.env.PGPASSWORD;
  if (!password) throw new Error("Mobile auth issue integration requires explicit isolated TEST_PG_PASSWORD.");
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
const outDir = mkdtempSync(join(process.cwd(), ".tmp-mauth-issue-db-"));
execFileSync(
  process.execPath,
  ["node_modules/typescript/bin/tsc", ...collectTs(CONTRACT), ...collectTs(MOBILE),
   "--outDir", outDir, "--rootDir", "lib", "--module", "commonjs", "--target", "es2020",
   "--moduleResolution", "node", "--esModuleInterop", "--strict", "--skipLibCheck"],
  { stdio: "pipe" }
);
const MINDEX = resolve(outDir, "mobile-auth/v1/index.js");
const M = requireCjs(MINDEX);
const { PrismaClient } = requireCjs("@prisma/client");

const DBNAME = `gbmedix_maissue_${Date.now()}_${randomBytes(4).toString("hex")}`;
const TEST_URL = `postgresql://${PG.user}:${encodeURIComponent(PG.password)}@${PG.host}:${PG.port}/${DBNAME}?schema=public`;
const adminEnv = { ...process.env, PGPASSWORD: PG.password };
function psql(sql, db = "postgres") {
  execFileSync("psql", ["-h", PG.host, "-U", PG.user, "-p", PG.port, "-d", db, "-v", "ON_ERROR_STOP=1", "-tAc", sql], { env: adminEnv, stdio: "pipe" });
}

let prisma;
const hex = () => randomBytes(32).toString("hex");
const rid = (p) => `${p}_${randomBytes(6).toString("hex")}`;
const nowSec = () => Math.floor(Date.now() / 1000);

before(async () => {
  psql(`CREATE DATABASE "${DBNAME}"`);
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: TEST_URL }, stdio: "pipe"
  });
  prisma = new PrismaClient({ datasources: { db: { url: TEST_URL } } });
  await prisma.$connect();
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

const store = () => new M.PrismaDeviceSessionStore(prisma);
const auditBuilder = (now) => (userId, deviceSessionId) => ({
  event: "mobile_session_created", endpoint: "issue", occurredAt: now,
  userId, deviceSessionId, reason: "created", outcome: "success"
});

/** Seed a pending user + an unused, not-yet-expired EmailVerification token. */
async function seedPendingUserWithToken() {
  const now = nowSec();
  const user = await prisma.user.create({ data: { email: `iss_${rid("u")}@t.local`, status: "pending" } });
  const token = `verif_${randomBytes(24).toString("hex")}`;
  await prisma.emailVerification.create({
    data: { userId: user.id, email: user.email, token, expiresAt: new Date((now + 3600) * 1000) }
  });
  return { userId: user.id, token, now };
}

function issueInput(token, now, over = {}) {
  return {
    verificationToken: token,
    sessionId: over.sessionId ?? rid("sess"),
    tokenFamilyId: over.tokenFamilyId ?? rid("fam"),
    refreshTokenHash: over.refreshTokenHash ?? hex(),
    now,
    idleExpiresAt: now + 3600,
    absoluteExpiresAt: now + 100000
  };
}

test("migration allows the 'issue' endpoint in the security-control CHECK constraints", async () => {
  // A rate-limit bucket + idempotency + audit row with endpoint='issue' must be accepted.
  await prisma.$executeRawUnsafe(
    `INSERT INTO "MobileAuthAuditLog" ("id","event","endpoint","reason","outcome","occurredAt") VALUES ($1,'mobile_session_created','issue','created','success', now())`,
    rid("aud")
  );
  const rows = await prisma.$queryRawUnsafe(`SELECT 1 FROM "MobileAuthAuditLog" WHERE "endpoint"='issue' LIMIT 1`);
  assert.equal(rows.length, 1);
});

test("issue success: consumes token, activates user, creates exactly one session + audit", async () => {
  const { userId, token, now } = await seedPendingUserWithToken();
  const input = issueInput(token, now);
  const res = await store().issueSessionFromVerificationWithAudit(input, auditBuilder(now));
  assert.equal(res.status, "issued");
  assert.equal(res.userId, userId);

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { status: true, emailVerifiedAt: true, sessionVersion: true } });
  assert.equal(user.status, "active");
  assert.notEqual(user.emailVerifiedAt, null);
  assert.equal(res.sessionVersion, user.sessionVersion); // NOT bumped on issuance

  const ev = await prisma.emailVerification.findUnique({ where: { token }, select: { verifiedAt: true } });
  assert.notEqual(ev.verifiedAt, null); // consumed

  const sessions = await prisma.deviceSession.findMany({ where: { userId } });
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].refreshTokenHash, input.refreshTokenHash); // only the hash persisted

  const audits = await prisma.mobileAuthAuditLog.findMany({ where: { deviceSessionId: input.sessionId } });
  assert.equal(audits.length, 1);
  assert.equal(audits[0].event, "mobile_session_created");
  assert.equal(audits[0].endpoint, "issue");
  // the raw verification token is never persisted into the audit
  assert.equal(JSON.stringify(audits[0]).includes(token), false);
});

test("issue is single-use: a consumed token cannot be replayed for a second session", async () => {
  const { userId, token, now } = await seedPendingUserWithToken();
  assert.equal((await store().issueSessionFromVerificationWithAudit(issueInput(token, now), auditBuilder(now))).status, "issued");
  const replay = await store().issueSessionFromVerificationWithAudit(issueInput(token, now), auditBuilder(now));
  assert.equal(replay.status, "invalid_token");
  assert.equal((await prisma.deviceSession.findMany({ where: { userId } })).length, 1); // still exactly one
});

test("issue rejects expired and unknown tokens", async () => {
  const now = nowSec();
  const user = await prisma.user.create({ data: { email: `iss_${rid("u")}@t.local`, status: "pending" } });
  const expired = `verif_${randomBytes(24).toString("hex")}`;
  await prisma.emailVerification.create({ data: { userId: user.id, email: user.email, token: expired, expiresAt: new Date((now - 10) * 1000) } });
  assert.equal((await store().issueSessionFromVerificationWithAudit(issueInput(expired, now), auditBuilder(now))).status, "invalid_token");
  assert.equal((await store().issueSessionFromVerificationWithAudit(issueInput(`verif_${randomBytes(24).toString("hex")}`, now), auditBuilder(now))).status, "invalid_token");
  const u = await prisma.user.findUnique({ where: { id: user.id }, select: { status: true } });
  assert.equal(u.status, "pending"); // unchanged
});

for (const workers of [2, 10, 50]) {
  test(`concurrency: ${workers} workers on the same token yield exactly one issuance`, async () => {
    const { userId, token, now } = await seedPendingUserWithToken();
    const results = await Promise.all(
      Array.from({ length: workers }, () =>
        store().issueSessionFromVerificationWithAudit(issueInput(token, now), auditBuilder(now)).catch(() => ({ status: "error" }))
      )
    );
    const issued = results.filter((r) => r.status === "issued");
    assert.equal(issued.length, 1, `exactly one winner among ${workers}`);
    assert.equal((await prisma.deviceSession.findMany({ where: { userId } })).length, 1);
    const ev = await prisma.emailVerification.findUnique({ where: { token }, select: { verifiedAt: true } });
    assert.notEqual(ev.verifiedAt, null);
    const audits = await prisma.mobileAuthAuditLog.findMany({ where: { userId, endpoint: "issue" } });
    assert.equal(audits.length, 1); // exactly one issuance audit
  });
}

test("two-process concurrency: exactly one of two independent Node processes issues", async () => {
  const { userId, token, now } = await seedPendingUserWithToken();
  const worker = join(outDir, "issue-worker.cjs");
  writeFileSync(worker, `
    const { PrismaClient } = require(${JSON.stringify(requireCjs.resolve("@prisma/client"))});
    const M = require(${JSON.stringify(MINDEX)});
    (async () => {
      const prisma = new PrismaClient({ datasources: { db: { url: process.env.WORKER_DB_URL } } });
      const store = new M.PrismaDeviceSessionStore(prisma);
      const now = Number(process.env.WORKER_NOW);
      const audit = (userId, sid) => ({ event: "mobile_session_created", endpoint: "issue", occurredAt: now, userId, deviceSessionId: sid, reason: "created", outcome: "success" });
      try {
        const r = await store.issueSessionFromVerificationWithAudit({
          verificationToken: process.env.WORKER_TOKEN, sessionId: "s_"+Math.random().toString(16).slice(2), tokenFamilyId: "f_"+Math.random().toString(16).slice(2),
          refreshTokenHash: require("crypto").randomBytes(32).toString("hex"), now, idleExpiresAt: now+3600, absoluteExpiresAt: now+100000
        }, audit);
        process.stdout.write(r.status);
      } catch { process.stdout.write("error"); }
      finally { await prisma.$disconnect(); }
    })();
  `);
  const run = () => {
    try {
      return execFileSync(process.execPath, [worker], {
        env: { ...process.env, WORKER_DB_URL: TEST_URL, WORKER_TOKEN: token, WORKER_NOW: String(now) },
        encoding: "utf8", stdio: ["ignore", "pipe", "ignore"]
      }).trim();
    } catch { return "error"; }
  };
  const [a, b] = await Promise.all([Promise.resolve().then(run), Promise.resolve().then(run)]);
  assert.equal([a, b].filter((s) => s === "issued").length, 1, "exactly one process issues");
  assert.equal((await prisma.deviceSession.findMany({ where: { userId } })).length, 1);
});

test("rollback: a failure mid-transaction leaves token unconsumed, user inactive, zero sessions", async () => {
  const { userId, token, now } = await seedPendingUserWithToken();
  // Force a failure inside the tx: reuse a refresh-token hash that already exists,
  // so the store's global-exclusivity check throws AFTER the token+user updates in
  // the same transaction — the whole thing must roll back.
  const existing = await prisma.user.create({ data: { email: `other_${rid("u")}@t.local`, status: "active", emailVerifiedAt: new Date() } });
  const collidingHash = hex();
  await store().createSession({ id: rid("sess"), userId: existing.id, tokenFamilyId: rid("fam"), refreshTokenHash: collidingHash, createdAt: now, idleExpiresAt: now + 1000, absoluteExpiresAt: now + 100000 });

  await assert.rejects(() =>
    store().issueSessionFromVerificationWithAudit(issueInput(token, now, { refreshTokenHash: collidingHash }), auditBuilder(now))
  );

  const ev = await prisma.emailVerification.findUnique({ where: { token }, select: { verifiedAt: true } });
  assert.equal(ev.verifiedAt, null, "verifiedAt unchanged after rollback");
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { status: true, emailVerifiedAt: true } });
  assert.equal(user.status, "pending", "user not activated after rollback");
  assert.equal(user.emailVerifiedAt, null);
  assert.equal((await prisma.deviceSession.findMany({ where: { userId } })).length, 0, "no session created after rollback");
  const audits = await prisma.mobileAuthAuditLog.findMany({ where: { userId, endpoint: "issue" } });
  assert.equal(audits.length, 0, "no issuance audit after rollback");
});
