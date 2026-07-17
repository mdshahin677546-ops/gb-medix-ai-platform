// BETA-0A — Admin RBAC audit + immutability REAL PostgreSQL integration.
//
// Uses a one-shot isolated PostgreSQL database supplied by TEST_PG_* variables,
// applies the real Prisma migrations, and exercises: the read+audit boundary,
// database-level append-only immutability (UPDATE/DELETE rejected), audit-fail →
// no-data, 10-worker concurrency, and a real 8→9 upgrade migration with role
// backfill. It never prints passwords, full DB URLs, tokens, or PHI.

import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, readdirSync, rmSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";

const requireCjs = createRequire(import.meta.url);

function resolvePgConfig() {
  const password = process.env.TEST_PG_PASSWORD ?? process.env.PGPASSWORD;
  if (!password) throw new Error("Admin audit integration requires explicit isolated TEST_PG_PASSWORD.");
  return {
    host: process.env.TEST_PG_HOST ?? "127.0.0.1",
    port: process.env.TEST_PG_PORT ?? "5432",
    user: process.env.TEST_PG_USER ?? "postgres",
    password
  };
}
const PG = resolvePgConfig();

function collectTs(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...collectTs(p));
    else if (e.name.endsWith(".ts")) out.push(p);
  }
  return out;
}
const outDir = mkdtempSync(join(process.cwd(), ".tmp-admin-audit-db-"));
execFileSync(
  process.execPath,
  [
    "node_modules/typescript/bin/tsc",
    ...collectTs("lib/admin"),
    "--outDir", outDir,
    "--rootDir", "lib",
    "--module", "commonjs",
    "--target", "es2020",
    "--lib", "es2020,dom",
    "--moduleResolution", "node",
    "--esModuleInterop",
    "--strict",
    "--skipLibCheck"
  ],
  { stdio: "pipe" }
);
const A = requireCjs(resolve(outDir, "admin/ai-usage-read.js"));
const AUDIT = requireCjs(resolve(outDir, "admin/audit.js"));
const RBAC = requireCjs(resolve(outDir, "admin/rbac.js"));
const { PrismaClient } = requireCjs("@prisma/client");

const MIGRATIONS_DIR = join(process.cwd(), "prisma", "migrations");
const adminEnv = { ...process.env, PGPASSWORD: PG.password };
function psql(sql, db = "postgres") {
  execFileSync("psql", ["-h", PG.host, "-U", PG.user, "-p", PG.port, "-d", db, "-v", "ON_ERROR_STOP=1", "-tAc", sql], { env: adminEnv, stdio: "pipe" });
}
function psqlFile(file, db) {
  execFileSync("psql", ["-h", PG.host, "-U", PG.user, "-p", PG.port, "-d", db, "-v", "ON_ERROR_STOP=1", "-f", file], { env: adminEnv, stdio: "pipe" });
}
function newDbName(p) { return `gbmedix_${p}_${Date.now()}_${randomBytes(4).toString("hex")}`; }
function urlFor(db) { return `postgresql://${PG.user}:${encodeURIComponent(PG.password)}@${PG.host}:${PG.port}/${db}?schema=public&connection_limit=20`; }

const DBNAME = newDbName("adminaudit");
let prisma;
let adminId;
let userId;

before(async () => {
  psql(`CREATE DATABASE "${DBNAME}"`);
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: urlFor(DBNAME) }, stdio: "pipe"
  });
  prisma = new PrismaClient({ datasources: { db: { url: urlFor(DBNAME) } } });
  await prisma.$connect();
  const admin = await prisma.user.create({ data: { email: `admin_${DBNAME}@t.local`, status: "active", emailVerifiedAt: new Date(), role: "ADMIN" } });
  const normal = await prisma.user.create({ data: { email: `user_${DBNAME}@t.local`, status: "active", emailVerifiedAt: new Date() } });
  adminId = admin.id;
  userId = normal.id;
  await prisma.aIUsage.createMany({ data: [
    { userId: adminId, model: "gpt-4o-mini", tokens: 100, cost: 0.001, provider: "openai", endpoint: "/api/tcm" },
    { userId: normal.id, model: "gpt-4o-mini", tokens: 200, cost: 0.002, provider: "openai", endpoint: "/api/reports/generate" }
  ] });
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

test("migration added Role column, AdminAuditLog table, and there are exactly 9 migrations", async () => {
  const cols = await prisma.$queryRawUnsafe(`SELECT column_name FROM information_schema.columns WHERE table_name='User' AND column_name='role'`);
  assert.equal(cols.length, 1);
  const tbl = await prisma.$queryRawUnsafe(`SELECT tablename FROM pg_tables WHERE tablename='AdminAuditLog'`);
  assert.equal(tbl.length, 1);
  const migCount = readdirSync(MIGRATIONS_DIR, { withFileTypes: true }).filter((e) => e.isDirectory() && /^\d/.test(e.name)).length;
  assert.equal(migCount, 9);
  // Default seeded a normal user as USER.
  const u = await prisma.user.findUnique({ where: { id: userId } });
  assert.equal(u.role, "USER");
});

test("admin AI-usage read writes exactly one audit row with fixed fields and no sensitive metadata", async () => {
  const requestId = `req-${randomBytes(6).toString("hex")}`;
  const data = await A.readAdminAiUsageWithAudit({ prisma, actorUserId: adminId, requestId });
  assert.ok(data.daily.calls >= 2);
  const rows = await prisma.adminAuditLog.findMany({ where: { requestId } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].action, "ADMIN_AI_USAGE_READ");
  assert.equal(rows[0].actorUserId, adminId);
  assert.equal(rows[0].outcome, "success");
  assert.equal(rows[0].metadata, null);
});

test("AdminAuditLog is append-only: UPDATE and DELETE are rejected, INSERT works", async () => {
  const seed = await prisma.adminAuditLog.create({ data: { actorUserId: adminId, action: "ADMIN_AI_USAGE_READ", requestId: `req-${randomBytes(4).toString("hex")}`, outcome: "success" } });
  await assert.rejects(() => prisma.$executeRawUnsafe(`UPDATE "AdminAuditLog" SET "outcome"='tampered' WHERE "id"='${seed.id}'`));
  await assert.rejects(() => prisma.$executeRawUnsafe(`DELETE FROM "AdminAuditLog" WHERE "id"='${seed.id}'`));
  const still = await prisma.adminAuditLog.findUnique({ where: { id: seed.id } });
  assert.equal(still.outcome, "success");
});

test("audit failure rolls back the boundary and returns NO data (bad actor FK)", async () => {
  const before = await prisma.adminAuditLog.count();
  await assert.rejects(() => A.readAdminAiUsageWithAudit({ prisma, actorUserId: "nonexistent-user-id", requestId: `req-${randomBytes(4).toString("hex")}` }));
  const afterCount = await prisma.adminAuditLog.count();
  assert.equal(afterCount, before, "no audit row should be created when the boundary fails");
});

test("10 concurrent admin reads → exactly 10 distinct audit rows, none lost/duplicated", async () => {
  const ids = Array.from({ length: 10 }, () => `req-${randomBytes(8).toString("hex")}`);
  const results = await Promise.all(ids.map((requestId) => A.readAdminAiUsageWithAudit({ prisma, actorUserId: adminId, requestId })));
  assert.equal(results.length, 10);
  const rows = await prisma.adminAuditLog.findMany({ where: { requestId: { in: ids } } });
  assert.equal(rows.length, 10);
  assert.equal(new Set(rows.map((r) => r.requestId)).size, 10);
  // exactly one audit per requestId
  for (const id of ids) assert.equal(rows.filter((r) => r.requestId === id).length, 1);
});

test("10 concurrent normal users are denied by the guard and produce no admin-read audit", async () => {
  const before = await prisma.adminAuditLog.count({ where: { action: "ADMIN_AI_USAGE_READ" } });
  const guards = await Promise.all(Array.from({ length: 10 }, async (_v, i) => {
    const u = await prisma.user.findUnique({ where: { id: userId } });
    return RBAC.authorizeUserRole({ id: u.id, role: u.role, email: `u${i}@t.local` }, ["ADMIN"]);
  }));
  assert.equal(guards.filter((g) => g.ok).length, 0);
  assert.equal(guards.filter((g) => g.status === 403).length, 10);
  const afterCount = await prisma.adminAuditLog.count({ where: { action: "ADMIN_AI_USAGE_READ" } });
  assert.equal(afterCount, before, "denied users must not create admin-read audits");
});

test("UPGRADE: apply 8 base migrations, insert a legacy user, apply the 9th → role backfilled + audit table immutable", async () => {
  const migDirs = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^\d/.test(e.name))
    .map((e) => e.name)
    .sort();
  assert.equal(migDirs.length, 9);
  const base8 = migDirs.slice(0, 8);
  const ninth = migDirs[8];

  const UPDB = newDbName("adminupg");
  psql(`CREATE DATABASE "${UPDB}"`);
  let up;
  try {
    // Old baseline: apply the 8 base migration SQL files directly, in order.
    for (const d of base8) {
      const sqlFile = join(MIGRATIONS_DIR, d, "migration.sql");
      if (existsSync(sqlFile)) psqlFile(sqlFile, UPDB);
    }
    // Insert a legacy user (pre-role schema has no "role" column).
    psql(`INSERT INTO "User" ("id","email","status","sessionVersion","createdAt") VALUES ('legacy1','legacy_${UPDB}@t.local','active',1, now())`, UPDB);
    // Upgrade: apply the 9th (BETA-0A) migration.
    psqlFile(join(MIGRATIONS_DIR, ninth, "migration.sql"), UPDB);

    up = new PrismaClient({ datasources: { db: { url: urlFor(UPDB) } } });
    await up.$connect();
    const legacy = await up.user.findUnique({ where: { id: "legacy1" } });
    assert.equal(legacy.role, "USER", "legacy user must backfill to USER");
    // role NOT NULL
    const nn = await up.$queryRawUnsafe(`SELECT is_nullable FROM information_schema.columns WHERE table_name='User' AND column_name='role'`);
    assert.equal(nn[0].is_nullable, "NO");
    // AdminAuditLog exists + immutability holds after upgrade
    const row = await up.adminAuditLog.create({ data: { actorUserId: "legacy1", action: "ADMIN_AI_USAGE_READ", requestId: "up-req", outcome: "success" } });
    await assert.rejects(() => up.$executeRawUnsafe(`UPDATE "AdminAuditLog" SET "outcome"='x' WHERE "id"='${row.id}'`));
    await assert.rejects(() => up.$executeRawUnsafe(`DELETE FROM "AdminAuditLog" WHERE "id"='${row.id}'`));
  } finally {
    try { if (up) await up.$disconnect(); } catch {}
    try { psql(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${UPDB}' AND pid <> pg_backend_pid()`); } catch {}
    psql(`DROP DATABASE IF EXISTS "${UPDB}"`);
  }
});
