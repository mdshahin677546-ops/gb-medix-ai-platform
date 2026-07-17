// BETA-0A — RBAC guard + audit-metadata pure tests.
//
// Compiles and executes the real TypeScript modules. No DB, no network, no
// committed secret. The RBAC guard NEVER reads request input (headers/query/body)
// or ADMIN_EMAILS — it authorizes solely on the DB-resolved user's role — so those
// bypass attempts are proven inert here.

import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";

const cwd = process.cwd();
const files = ["lib/admin/rbac.ts", "lib/admin/audit.ts"].map((f) => join(cwd, f));

mkdirSync(join(cwd, ".tmp"), { recursive: true });
const outDir = mkdtempSync(join(cwd, ".tmp", "admin-rbac-"));
const requireCjs = createRequire(import.meta.url);
const tsconfigPath = join(outDir, "tsconfig.json");
writeFileSync(tsconfigPath, JSON.stringify({
  compilerOptions: {
    outDir, rootDir: cwd, module: "commonjs", target: "es2020",
    lib: ["es2020", "dom"], moduleResolution: "node", esModuleInterop: true,
    skipLibCheck: true, strict: true, noEmitOnError: true
  },
  files
}));
try {
  execFileSync(process.execPath, ["node_modules/typescript/bin/tsc", "-p", tsconfigPath], { stdio: "pipe" });
} catch (error) {
  rmSync(outDir, { recursive: true, force: true });
  throw new Error("tsc compile of admin rbac/audit failed:\n" + (error.stdout || error.message));
}
test.after(() => rmSync(outDir, { recursive: true, force: true }));

const rbac = requireCjs(resolve(outDir, "lib/admin/rbac.js"));
const audit = requireCjs(resolve(outDir, "lib/admin/audit.js"));

const resolver = (u) => async () => u;

test("authorizeUserRole is fail-closed and role-only", () => {
  assert.equal(rbac.authorizeUserRole(null, ["ADMIN"]).status, 401);
  assert.equal(rbac.authorizeUserRole(undefined, ["ADMIN"]).status, 401);
  assert.equal(rbac.authorizeUserRole({ id: "u", role: "USER" }, ["ADMIN"]).status, 403);
  assert.equal(rbac.authorizeUserRole({ id: "u", role: "WEIRD" }, ["ADMIN"]).status, 403);
  assert.equal(rbac.authorizeUserRole({ id: "u", role: undefined }, ["ADMIN"]).status, 403);
  const ok = rbac.authorizeUserRole({ id: "u", role: "ADMIN" }, ["ADMIN"]);
  assert.equal(ok.ok, true);
  assert.equal(ok.user.id, "u");
  assert.equal(ok.user.role, "ADMIN");
});

test("requireAdmin: unauthenticated → 401", async () => {
  const r = await rbac.requireAdmin(resolver(null));
  assert.equal(r.ok, false);
  assert.equal(r.status, 401);
});

test("requireAdmin: resolver/DB error → fail-closed 401, no leak", async () => {
  const r = await rbac.requireAdmin(async () => { throw new Error("db exploded: secret conn string"); });
  assert.equal(r.ok, false);
  assert.equal(r.status, 401);
  // Fixed safe body — no role, admin list, or internal error detail.
  assert.equal(r.body.error, "Authentication required.");
  assert.ok(!/secret|conn|ADMIN|USER|role/i.test(JSON.stringify(r.body)));
});

test("requireAdmin: USER → 403 (even if email is in ADMIN_EMAILS)", async () => {
  process.env.ADMIN_EMAILS = "boss@t.local,ops@t.local";
  const r = await rbac.requireAdmin(resolver({ id: "u1", email: "boss@t.local", role: "USER" }));
  assert.equal(r.ok, false);
  assert.equal(r.status, 403);
  assert.equal(r.body.error, "Forbidden.");
  delete process.env.ADMIN_EMAILS;
});

test("requireAdmin: ADMIN → allowed (even if email NOT in ADMIN_EMAILS)", async () => {
  process.env.ADMIN_EMAILS = "someone-else@t.local";
  const r = await rbac.requireAdmin(resolver({ id: "a1", email: "notlisted@t.local", role: "ADMIN" }));
  assert.equal(r.ok, true);
  assert.equal(r.user.id, "a1");
  delete process.env.ADMIN_EMAILS;
});

test("forged role via extra fields is ignored — only DB role decides", async () => {
  // A resolver returning USER with attacker-controlled 'roleHeader'/'role' echoes
  // still authorizes on the real role field only.
  const r = await rbac.requireAdmin(resolver({ id: "u", role: "USER", roleHeader: "ADMIN", isAdmin: true }));
  assert.equal(r.status, 403);
});

test("requireRole supports multiple allowed roles (future-proof)", async () => {
  const r = await rbac.requireRole(["ADMIN", "USER"], resolver({ id: "u", role: "USER" }));
  assert.equal(r.ok, true);
});

test("sanitizeAuditMetadata accepts safe primitives, rejects sensitive/nested/oversized", () => {
  assert.deepEqual(audit.sanitizeAuditMetadata({ event: "ok", n: 3, flag: true }), { event: "ok", n: 3, flag: true });
  assert.equal(audit.sanitizeAuditMetadata(undefined), undefined);
  assert.equal(audit.sanitizeAuditMetadata(null), undefined);
  for (const bad of [
    "password",
    "token",
    "cookie",
    "authorization",
    "email",
    "ip",
    "payment",
    "health",
    "access_token",
    "refresh-token",
    "Authorization\r",
    "constructor",
    "prototype",
    "__proto__",
    "note",
    "notes",
    "prompt",
    "response",
    "diagnosis",
    "symptom",
    "patient_name",
    "phoneNumber",
    "medical.record"
  ]) {
    assert.throws(() => audit.sanitizeAuditMetadata({ [bad]: "x" }), audit.AdminAuditValidationError, bad);
  }
  assert.throws(() => audit.sanitizeAuditMetadata({ nested: { a: 1 } }), audit.AdminAuditValidationError);
  assert.throws(() => audit.sanitizeAuditMetadata([1, 2, 3]), audit.AdminAuditValidationError);
  assert.throws(() => audit.sanitizeAuditMetadata({ big: "x".repeat(5000) }), audit.AdminAuditValidationError);
  assert.throws(() => audit.sanitizeAuditMetadata({ n: Number.NaN }), audit.AdminAuditValidationError);
  assert.throws(() => audit.sanitizeAuditMetadata({ n: Number.POSITIVE_INFINITY }), audit.AdminAuditValidationError);
});

test("insertAdminAudit writes fixed action + sanitized fields via injected writer", async () => {
  let captured = null;
  const writer = { adminAuditLog: { create: async (args) => { captured = args.data; return { id: "aud_1" }; } } };
  const res = await audit.insertAdminAudit(writer, {
    actorUserId: "a1",
    action: audit.ADMIN_AUDIT_ACTIONS.AI_USAGE_READ,
    requestId: "req-123",
    outcome: "success"
  });
  assert.equal(res.id, "aud_1");
  assert.equal(captured.action, "ADMIN_AI_USAGE_READ");
  assert.equal(captured.actorUserId, "a1");
  assert.equal(captured.requestId, "req-123");
  assert.equal(captured.metadata, null);
  // Forbidden metadata is rejected before any create call.
  let called = false;
  const w2 = { adminAuditLog: { create: async () => { called = true; return { id: "x" }; } } };
  await assert.rejects(() => audit.insertAdminAudit(w2, {
    actorUserId: "a1", action: audit.ADMIN_AUDIT_ACTIONS.AI_USAGE_READ,
    requestId: "r", outcome: "success", metadata: { token: "leak" }
  }), audit.AdminAuditValidationError);
  assert.equal(called, false);
});
