// Real-database integration test for the Sprint 1B commercial invariants.
//
// Unlike the unit suite (which asserts intended behaviour on an in-memory
// model), this exercises the actual Prisma schema, constraints, and the
// resource-scoped entitlement WHERE clause used by lib/entitlement, against a
// live PostgreSQL. It requires DATABASE_URL to point at a reachable Postgres
// (use a throwaway database). Tests are skipped, not failed, when no DB is
// reachable so the suite stays CI-safe without a database.
//
//   DATABASE_URL="postgresql://user:pass@host:5432/testdb?schema=public" \
//     node --test tests/sprint-1b-commercial-flow.integration.test.mjs

import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

let dbReady = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  // Require the Sprint 1B schema to be present; otherwise skip (not fail) so the
  // suite is safe against an unmigrated or missing database in CI.
  await prisma.productRecommendation.count();
  dbReady = true;
} catch {
  dbReady = false;
}
const skip = dbReady ? false : "no reachable PostgreSQL with Sprint 1B schema";

const PREMIUM = "premium_report";
const ASSESSMENT = "assessment";

// Mirrors lib/entitlement.checkEntitlement scoped query. Keep in sync.
async function entitled({ userId, productId, resourceType, resourceId }) {
  const e = await prisma.entitlement.findFirst({
    where: {
      userId,
      productId,
      status: "active",
      resourceType: resourceType ?? null,
      resourceId: resourceId ?? null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
    }
  });
  return Boolean(e);
}

async function withFixture(fn) {
  const tag = `it1b_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const userA = await prisma.user.create({ data: { email: `${tag}_a@t.dev`, status: "active" } });
  const userB = await prisma.user.create({ data: { email: `${tag}_b@t.dev`, status: "active" } });
  const asmtA = await prisma.tCMRecord.create({ data: { userId: userA.id, kind: "tcm", input: "{}", result: "{}" } });
  const asmtB = await prisma.tCMRecord.create({ data: { userId: userA.id, kind: "tcm", input: "{}", result: "{}" } });
  try {
    await fn({ userA, userB, asmtA, asmtB });
  } finally {
    const ids = [userA.id, userB.id];
    await prisma.productRecommendation.deleteMany({ where: { userId: { in: ids } } });
    await prisma.entitlement.deleteMany({ where: { userId: { in: ids } } });
    await prisma.paymentRecord.deleteMany({ where: { userId: { in: ids } } });
    await prisma.aIReport.deleteMany({ where: { userId: { in: ids } } });
    await prisma.tCMRecord.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
}

test.after(async () => {
  await prisma.$disconnect();
});

test("free report persists no premium fields", { skip }, async () => {
  await withFixture(async ({ userA, asmtA }) => {
    const free = await prisma.aIReport.create({
      data: {
        userId: userA.id, assessmentId: asmtA.id, type: "free_health_report", status: "free_ready",
        score: 80, summary: "s", analysis: { healthScore: 80 },
        recommendations: [{ category: "sleep", content: "x" }],
        lifestylePlan: [], productSuggestions: [], followUpPlan: []
      }
    });
    assert.deepEqual(free.lifestylePlan, []);
    assert.deepEqual(free.productSuggestions, []);
    assert.deepEqual(free.followUpPlan, []);
  });
});

test("premium is locked without a paid, resource-scoped entitlement", { skip }, async () => {
  await withFixture(async ({ userA, asmtA }) => {
    assert.equal(await entitled({ userId: userA.id, productId: PREMIUM, resourceType: ASSESSMENT, resourceId: asmtA.id }), false);
  });
});

test("payment grants entitlement scoped to its own assessment only", { skip }, async () => {
  await withFixture(async ({ userA, asmtA, asmtB }) => {
    const pay = await prisma.paymentRecord.create({
      data: {
        userId: userA.id, product: PREMIUM, status: "paid", amountCents: 999, currency: "usd",
        resourceType: ASSESSMENT, resourceId: asmtA.id, sessionId: `sess_${asmtA.id}`
      }
    });
    await prisma.entitlement.create({
      data: { userId: userA.id, productId: PREMIUM, paymentId: pay.id, status: "active", resourceType: ASSESSMENT, resourceId: asmtA.id }
    });
    assert.equal(await entitled({ userId: userA.id, productId: PREMIUM, resourceType: ASSESSMENT, resourceId: asmtA.id }), true);
    // resource isolation: entitlement for A must not unlock B
    assert.equal(await entitled({ userId: userA.id, productId: PREMIUM, resourceType: ASSESSMENT, resourceId: asmtB.id }), false);
  });
});

test("refund revokes the entitlement and re-locks premium", { skip }, async () => {
  await withFixture(async ({ userA, asmtA }) => {
    const pay = await prisma.paymentRecord.create({
      data: {
        userId: userA.id, product: PREMIUM, status: "paid", amountCents: 999, currency: "usd",
        resourceType: ASSESSMENT, resourceId: asmtA.id, sessionId: `sess_r_${asmtA.id}`, paymentIntentId: `pi_${asmtA.id}`
      }
    });
    await prisma.entitlement.create({
      data: { userId: userA.id, productId: PREMIUM, paymentId: pay.id, status: "active", resourceType: ASSESSMENT, resourceId: asmtA.id }
    });
    assert.equal(await entitled({ userId: userA.id, productId: PREMIUM, resourceType: ASSESSMENT, resourceId: asmtA.id }), true);

    // mirrors webhook charge.refunded handling
    await prisma.entitlement.updateMany({ where: { paymentId: pay.id, status: "active" }, data: { status: "revoked" } });
    await prisma.paymentRecord.update({ where: { id: pay.id }, data: { status: "refunded" } });

    assert.equal(await entitled({ userId: userA.id, productId: PREMIUM, resourceType: ASSESSMENT, resourceId: asmtA.id }), false);
  });
});

test("report read is IDOR-safe when scoped by { id, userId }", { skip }, async () => {
  await withFixture(async ({ userA, userB, asmtA }) => {
    const report = await prisma.aIReport.create({
      data: {
        userId: userA.id, assessmentId: asmtA.id, type: "free_health_report", status: "free_ready",
        score: 70, summary: "s", analysis: {}, recommendations: [], lifestylePlan: [], productSuggestions: [], followUpPlan: []
      }
    });
    const asOwner = await prisma.aIReport.findFirst({ where: { id: report.id, userId: userA.id } });
    const asOther = await prisma.aIReport.findFirst({ where: { id: report.id, userId: userB.id } });
    assert.ok(asOwner);
    assert.equal(asOther, null);
  });
});

test("premium report is unique per (user, assessment, type)", { skip }, async () => {
  await withFixture(async ({ userA, asmtA }) => {
    const base = {
      userId: userA.id, assessmentId: asmtA.id, type: "premium_health_report", status: "premium_ready",
      score: 60, summary: "s", analysis: {}, recommendations: [], lifestylePlan: [], productSuggestions: [], followUpPlan: []
    };
    await prisma.aIReport.create({ data: base });
    await assert.rejects(() => prisma.aIReport.create({ data: base }), /Unique constraint|P2002/);
  });
});
