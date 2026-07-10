// Pre-launch security hardening tests:
//   1) AUTH_SECRET production enforcement (no dev fallback in production).
//   2) Session revocation via User.sessionVersion.
//
// Style mirrors the rest of the suite: behavioral tests reimplement the exact
// algorithm (so we can exercise it without importing the Next/Prisma-bound
// TS module), plus source assertions that lib/auth.ts actually wires that
// algorithm, plus a real-Postgres check (skipped when no DB is reachable).

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createHmac, timingSafeEqual } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const DEV_FALLBACK = "dev-only-change-me";
const authSource = readFileSync("lib/auth.ts", "utf8");

// ---- Mirror of lib/auth.ts secret() resolution ----------------------------
function resolveSecret(env) {
  const value = env.AUTH_SECRET;
  if (env.NODE_ENV === "production") {
    if (!value || value === DEV_FALLBACK) {
      throw new Error("AUTH_SECRET must be set to a strong, non-default value in production.");
    }
    return value;
  }
  return value || DEV_FALLBACK;
}

// ---- Mirror of user session token encode / verify -------------------------
function sign(value, secret) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}
function userSessionValue(userId, sessionVersion, secret) {
  const payload = `${userId}.${sessionVersion}`;
  return `${payload}.${sign(payload, secret)}`;
}
function validateCookie(raw, dbVersion, secret) {
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [userId, versionRaw, signature] = parts;
  if (!userId || !versionRaw || !signature) return null;
  const expected = sign(`${userId}.${versionRaw}`, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (Number(versionRaw) !== dbVersion) return null;
  return userId;
}

// ============================ TASK 1: AUTH_SECRET ==========================

test("AUTH_SECRET: production + missing throws", () => {
  assert.throws(() => resolveSecret({ NODE_ENV: "production" }), /AUTH_SECRET/);
});

test("AUTH_SECRET: production + dev-only-change-me throws", () => {
  assert.throws(
    () => resolveSecret({ NODE_ENV: "production", AUTH_SECRET: DEV_FALLBACK }),
    /AUTH_SECRET/
  );
});

test("AUTH_SECRET: production + strong value is accepted", () => {
  const strong = "x".repeat(48);
  assert.equal(resolveSecret({ NODE_ENV: "production", AUTH_SECRET: strong }), strong);
});

test("AUTH_SECRET: development fallback does not block local runs", () => {
  assert.equal(resolveSecret({ NODE_ENV: "development" }), DEV_FALLBACK);
  assert.equal(resolveSecret({}), DEV_FALLBACK);
});

test("AUTH_SECRET: lib/auth.ts implements the production guard", () => {
  assert.match(authSource, /process\.env\.NODE_ENV === "production"/);
  assert.match(authSource, /DEV_FALLBACK_SECRET\s*=\s*"dev-only-change-me"/);
  assert.match(authSource, /throw new Error\(/);
  // The guard must reject both the missing and the default-value cases.
  assert.match(authSource, /!value \|\| value === DEV_FALLBACK_SECRET/);
});

// ========================= TASK 2: session revoke =========================

test("session token: matching sessionVersion is valid", () => {
  const secret = "s".repeat(48);
  const cookie = userSessionValue("user_1", 1, secret);
  assert.equal(validateCookie(cookie, 1, secret), "user_1");
});

test("session token: bumped sessionVersion invalidates an older cookie", () => {
  const secret = "s".repeat(48);
  const cookie = userSessionValue("user_1", 1, secret); // signed at v1
  assert.equal(validateCookie(cookie, 2, secret), null); // DB now at v2
});

test("session token: tampered signature is rejected", () => {
  const secret = "s".repeat(48);
  const cookie = userSessionValue("user_1", 1, secret);
  const tampered = cookie.slice(0, -2) + (cookie.endsWith("aa") ? "bb" : "aa");
  assert.equal(validateCookie(tampered, 1, secret), null);
});

test("session token: tampered version is rejected (signature covers id.version)", () => {
  const secret = "s".repeat(48);
  const cookie = userSessionValue("user_1", 1, secret);
  const [id, , sig] = cookie.split(".");
  const forged = `${id}.999.${sig}`; // claim a different version, reuse signature
  assert.equal(validateCookie(forged, 999, secret), null);
});

test("session token: legacy 2-part cookie no longer validates", () => {
  const secret = "s".repeat(48);
  const legacy = `user_1.${sign("user_1", secret)}`; // old "id.sig" format
  assert.equal(validateCookie(legacy, 1, secret), null);
});

test("lib/auth.ts implements sessionVersion binding, revoke, and DB check", () => {
  // Cookie payload binds id + version and signs the pair.
  assert.match(authSource, /const payload = `\$\{userId\}\.\$\{sessionVersion\}`/);
  // getCurrentUser compares the cookie version to the DB row.
  assert.match(authSource, /user\.sessionVersion !== Number\(versionRaw\)/);
  // invalidateUserSessions advances the version.
  assert.match(authSource, /invalidateUserSessions/);
  assert.match(authSource, /sessionVersion:\s*\{\s*increment:\s*1\s*\}/);
});

test("schema + migration declare User.sessionVersion", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  assert.match(schema, /sessionVersion\s+Int\s+@default\(1\)/);
  const migration = readFileSync(
    "prisma/migrations/20260710120000_add_user_session_version/migration.sql",
    "utf8"
  );
  assert.match(migration, /ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 1/);
});

test("session cookie callers pass sessionVersion", () => {
  const session = readFileSync("app/api/session/route.ts", "utf8");
  const verify = readFileSync("app/api/auth/verify-email/route.ts", "utf8");
  const checkout = readFileSync("app/api/checkout/route.ts", "utf8");
  assert.match(session, /setSessionCookie\(response, user\.id, user\.sessionVersion\)/);
  assert.match(verify, /setSessionCookie\(response, result\.userId, result\.sessionVersion\)/);
  assert.match(checkout, /setSessionCookie\(response, user\.id, user\.sessionVersion\)/);
  // Logout-all wiring.
  assert.match(session, /scope === "all"/);
  assert.match(session, /invalidateUserSessions\(user\.id\)/);
});

// ===================== TASK 2: real Postgres behavior =====================

const prisma = new PrismaClient();
let dbReady = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  await prisma.user.count();
  dbReady = true;
} catch {
  dbReady = false;
}
const skip = dbReady ? false : "no reachable PostgreSQL";

test("invalidateUserSessions bumps the DB version so old cookies fail", { skip }, async () => {
  const secret = "integration-secret-" + "z".repeat(32);
  const email = `sv_${process.pid}_${Math.random().toString(36).slice(2, 8)}@t.dev`;
  const user = await prisma.user.create({ data: { email, status: "active" } });
  try {
    assert.equal(user.sessionVersion, 1, "new users start at sessionVersion 1");

    // Cookie signed at the user's current version validates against the DB row.
    const cookie = userSessionValue(user.id, user.sessionVersion, secret);
    let current = await prisma.user.findUnique({ where: { id: user.id } });
    assert.equal(validateCookie(cookie, current.sessionVersion, secret), user.id);

    // Mirror invalidateUserSessions(): advance the version.
    await prisma.user.update({
      where: { id: user.id },
      data: { sessionVersion: { increment: 1 } }
    });
    current = await prisma.user.findUnique({ where: { id: user.id } });
    assert.equal(current.sessionVersion, 2);

    // The old cookie is now rejected; a freshly issued one works again.
    assert.equal(validateCookie(cookie, current.sessionVersion, secret), null);
    const fresh = userSessionValue(user.id, current.sessionVersion, secret);
    assert.equal(validateCookie(fresh, current.sessionVersion, secret), user.id);
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test.after(async () => {
  await prisma.$disconnect();
});
