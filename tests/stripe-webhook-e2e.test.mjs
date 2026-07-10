import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const hasStripeTestKey = process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_");
const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
const skipReason = !hasStripeTestKey
  ? "STRIPE_SECRET_KEY test key is not configured"
  : !hasDatabaseUrl
    ? "DATABASE_URL is not configured"
    : false;

test("Stripe signed webhook route handler updates payment and entitlement state", { skip: skipReason }, () => {
  const runnerPath = join(
    process.cwd(),
    `.tmp-stripe-webhook-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mts`
  );

  const runner = `
import assert from "node:assert/strict";
import Stripe from "stripe";
import { PrismaClient } from "@prisma/client";
import { POST } from "./app/api/webhooks/stripe/route";

const PREMIUM_PRODUCT = "premium_report";
const RESOURCE_ASSESSMENT = "assessment";
const TEST_SECRET = "whsec_local_test_secret";
const prisma = new PrismaClient();

process.env.STRIPE_WEBHOOK_SECRET ||= TEST_SECRET;

function makeStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2025-02-24.acacia"
  });
}

function makeEvent(type: string, object: Record<string, unknown>) {
  return {
    id: \`evt_stripe_loop_\${Date.now()}_\${Math.random().toString(36).slice(2, 8)}\`,
    object: "event",
    api_version: "2025-02-24.acacia",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type,
    data: { object }
  };
}

async function invokeWebhook(stripe: Stripe, type: string, object: Record<string, unknown>) {
  const event = makeEvent(type, object);
  const payload = JSON.stringify(event);
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: process.env.STRIPE_WEBHOOK_SECRET!
  });

  const response = await POST(
    new Request("http://direct.test/api/webhooks/stripe", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": signature
      },
      body: payload
    })
  );
  const body = await response.text();
  assert.equal(response.status, 200, \`\${type} should be accepted: \${body}\`);
}

async function cleanupStripeLoopData() {
  const users = await prisma.user.findMany({
    where: { email: { contains: "stripe_loop_" } },
    select: { id: true }
  });
  const userIds = users.map((user) => user.id);
  if (!userIds.length) return 0;

  await prisma.productRecommendation.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.entitlement.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.paymentRecord.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.aIReport.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.tCMRecord.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.emailVerification.deleteMany({ where: { userId: { in: userIds } } }).catch(() => {});
  await prisma.aIProcessingConsent.deleteMany({ where: { userId: { in: userIds } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  return userIds.length;
}

async function createFixture() {
  const tag = \`stripe_loop_\${Date.now()}_\${Math.random().toString(36).slice(2, 8)}\`;
  const user = await prisma.user.create({
    data: { email: \`\${tag}@example.test\`, status: "active", emailVerifiedAt: new Date() }
  });
  const assessment = await prisma.tCMRecord.create({
    data: { userId: user.id, kind: "tcm_analysis", input: "{}", result: "{}" }
  });
  return { user, assessment };
}

async function createPayment(userId: string, assessmentId: string, suffix: string) {
  const sessionId = \`cs_test_stripe_loop_\${suffix}_\${Math.random().toString(36).slice(2, 8)}\`;
  const paymentIntentId = \`pi_stripe_loop_\${suffix}_\${Math.random().toString(36).slice(2, 8)}\`;
  const payment = await prisma.paymentRecord.create({
    data: {
      userId,
      provider: "stripe",
      product: PREMIUM_PRODUCT,
      resourceType: RESOURCE_ASSESSMENT,
      resourceId: assessmentId,
      status: "created",
      amountCents: 999,
      currency: "usd",
      sessionId,
      paymentIntentId
    }
  });
  return { id: payment.id, sessionId, paymentIntentId };
}

async function paymentStatus(paymentId: string) {
  return (await prisma.paymentRecord.findUniqueOrThrow({ where: { id: paymentId } })).status;
}

async function entitlementStatus(paymentId: string) {
  const entitlements = await prisma.entitlement.findMany({
    where: { paymentId },
    orderBy: { createdAt: "asc" }
  });
  return entitlements.map((entitlement) => entitlement.status);
}

async function hasActivePremiumEntitlement(userId: string, assessmentId: string) {
  const entitlement = await prisma.entitlement.findFirst({
    where: {
      userId,
      productId: PREMIUM_PRODUCT,
      resourceType: RESOURCE_ASSESSMENT,
      resourceId: assessmentId,
      status: "active",
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
    }
  });
  return Boolean(entitlement);
}

const result = {
  signatureAccepted: {
    completed: false,
    refunded: false,
    disputed: false,
    expired: false,
    failed: false
  },
  completedAuthorized: false,
  refundRevoked: false,
  disputeRevoked: false,
  expiredDidNotAuthorize: false,
  failedDidNotAuthorize: false,
  paymentStatus: {} as Record<string, string>,
  entitlementStatus: {} as Record<string, string[]>,
  cleanup: { before: 0, after: 0 }
};

try {
  const stripe = makeStripe();
  result.cleanup.before = await cleanupStripeLoopData();
  await prisma.$queryRaw\`select 1\`;
  const { user, assessment } = await createFixture();

  const completedPayment = await createPayment(user.id, assessment.id, "completed");
  await invokeWebhook(stripe, "checkout.session.completed", {
    id: completedPayment.sessionId,
    object: "checkout.session",
    payment_status: "paid",
    payment_intent: completedPayment.paymentIntentId
  });
  result.signatureAccepted.completed = true;
  result.paymentStatus.completed = await paymentStatus(completedPayment.id);
  result.entitlementStatus.completed = await entitlementStatus(completedPayment.id);
  result.completedAuthorized =
    result.paymentStatus.completed === "paid" &&
    result.entitlementStatus.completed.includes("active") &&
    (await hasActivePremiumEntitlement(user.id, assessment.id));

  await invokeWebhook(stripe, "charge.refunded", {
    id: \`ch_stripe_loop_refund_\${Date.now()}\`,
    object: "charge",
    payment_intent: completedPayment.paymentIntentId
  });
  result.signatureAccepted.refunded = true;
  result.paymentStatus.refunded = await paymentStatus(completedPayment.id);
  result.entitlementStatus.refunded = await entitlementStatus(completedPayment.id);
  result.refundRevoked =
    result.paymentStatus.refunded === "refunded" &&
    !result.entitlementStatus.refunded.includes("active") &&
    !(await hasActivePremiumEntitlement(user.id, assessment.id));

  const disputedPayment = await createPayment(user.id, assessment.id, "disputed");
  await invokeWebhook(stripe, "checkout.session.completed", {
    id: disputedPayment.sessionId,
    object: "checkout.session",
    payment_status: "paid",
    payment_intent: disputedPayment.paymentIntentId
  });
  await invokeWebhook(stripe, "charge.dispute.created", {
    id: \`du_stripe_loop_\${Date.now()}\`,
    object: "dispute",
    payment_intent: disputedPayment.paymentIntentId
  });
  result.signatureAccepted.disputed = true;
  result.paymentStatus.disputed = await paymentStatus(disputedPayment.id);
  result.entitlementStatus.disputed = await entitlementStatus(disputedPayment.id);
  result.disputeRevoked =
    result.paymentStatus.disputed === "disputed" &&
    !result.entitlementStatus.disputed.includes("active");

  const expiredPayment = await createPayment(user.id, assessment.id, "expired");
  await invokeWebhook(stripe, "checkout.session.expired", {
    id: expiredPayment.sessionId,
    object: "checkout.session",
    payment_status: "unpaid",
    payment_intent: expiredPayment.paymentIntentId
  });
  result.signatureAccepted.expired = true;
  result.paymentStatus.expired = await paymentStatus(expiredPayment.id);
  result.entitlementStatus.expired = await entitlementStatus(expiredPayment.id);
  result.expiredDidNotAuthorize =
    result.paymentStatus.expired === "expired" &&
    result.entitlementStatus.expired.length === 0;

  const failedPayment = await createPayment(user.id, assessment.id, "failed");
  await invokeWebhook(stripe, "payment_intent.payment_failed", {
    id: failedPayment.paymentIntentId,
    object: "payment_intent",
    metadata: { checkout_session_id: failedPayment.sessionId }
  });
  result.signatureAccepted.failed = true;
  result.paymentStatus.failed = await paymentStatus(failedPayment.id);
  result.entitlementStatus.failed = await entitlementStatus(failedPayment.id);
  result.failedDidNotAuthorize =
    result.paymentStatus.failed === "failed" &&
    result.entitlementStatus.failed.length === 0;

  assert.equal(result.completedAuthorized, true);
  assert.equal(result.refundRevoked, true);
  assert.equal(result.disputeRevoked, true);
  assert.equal(result.expiredDidNotAuthorize, true);
  assert.equal(result.failedDidNotAuthorize, true);
} finally {
  result.cleanup.after = await cleanupStripeLoopData();
  await prisma.$disconnect();
}

console.log("STRIPE_WEBHOOK_E2E_RESULT=" + JSON.stringify(result));
`;

  try {
    writeFileSync(runnerPath, runner, "utf8");
    const command = process.platform === "win32" ? "npx.cmd" : "npx";
    const child = spawnSync(command, ["-y", "tsx", runnerPath], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || "whsec_local_test_secret"
      },
      encoding: "utf8"
    });

    assert.equal(child.status, 0, child.stderr || child.stdout);
    const resultLine = child.stdout
      .split(/\r?\n/)
      .find((line) => line.startsWith("STRIPE_WEBHOOK_E2E_RESULT="));
    assert.ok(resultLine, child.stdout);
    const result = JSON.parse(resultLine.replace("STRIPE_WEBHOOK_E2E_RESULT=", ""));

    assert.deepEqual(result.signatureAccepted, {
      completed: true,
      refunded: true,
      disputed: true,
      expired: true,
      failed: true
    });
    assert.equal(result.completedAuthorized, true);
    assert.equal(result.refundRevoked, true);
    assert.equal(result.disputeRevoked, true);
    assert.equal(result.expiredDidNotAuthorize, true);
    assert.equal(result.failedDidNotAuthorize, true);
    assert.equal(result.cleanup.after >= 1, true);
  } finally {
    if (existsSync(runnerPath)) rmSync(runnerPath, { force: true });
  }
});
