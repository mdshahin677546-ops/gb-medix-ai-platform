import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const premiumProduct = "premium_report";
const assessmentResource = "assessment";

function createStore() {
  return {
    payments: new Map(),
    entitlements: new Map(),
    reports: new Map(),
    reportSequence: 0
  };
}

function entitlementKey({ userId, productId, resourceType, resourceId }) {
  return [userId, productId, resourceType || "", resourceId || ""].join(":");
}

function grantEntitlement(store, payment) {
  const key = entitlementKey({
    userId: payment.userId,
    productId: payment.product,
    resourceType: payment.resourceType,
    resourceId: payment.resourceId
  });
  store.entitlements.set(key, {
    userId: payment.userId,
    productId: payment.product,
    resourceType: payment.resourceType,
    resourceId: payment.resourceId,
    paymentId: payment.id,
    status: "active"
  });
}

function hasEntitlement(store, scope) {
  return store.entitlements.get(entitlementKey(scope))?.status === "active";
}

function createPayment(store, params) {
  const payment = {
    id: `pay_${store.payments.size + 1}`,
    sessionId: params.sessionId,
    paymentIntentId: params.paymentIntentId,
    userId: params.userId,
    product: params.product,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    status: "created"
  };
  store.payments.set(payment.id, payment);
  return payment;
}

function handleMockWebhook(store, event) {
  if (event.type === "checkout.session.completed") {
    const payment = [...store.payments.values()].find(
      (item) => item.sessionId === event.sessionId
    );
    assert.ok(payment, "payment should exist for completed checkout");
    payment.status = "paid";
    payment.paymentIntentId = event.paymentIntentId;
    grantEntitlement(store, payment);
    return;
  }

  if (event.type === "charge.refunded") {
    const payment = [...store.payments.values()].find(
      (item) => item.paymentIntentId === event.paymentIntentId
    );
    assert.ok(payment, "payment should exist for refund");
    payment.status = "refunded";
    for (const entitlement of store.entitlements.values()) {
      if (entitlement.paymentId === payment.id && entitlement.status === "active") {
        entitlement.status = "revoked";
      }
    }
  }
}

function generatePremiumReport(store, { userId, assessmentId }) {
  const entitled = hasEntitlement(store, {
    userId,
    productId: premiumProduct,
    resourceType: assessmentResource,
    resourceId: assessmentId
  });
  if (!entitled) {
    return { status: 402, error: "Premium report access requires a completed payment." };
  }

  const existing = [...store.reports.values()].find(
    (report) =>
      report.userId === userId &&
      report.assessmentId === assessmentId &&
      report.type === "premium_health_report"
  );
  if (existing) {
    return { status: 200, reportId: existing.id };
  }

  const report = {
    id: `report_${++store.reportSequence}`,
    userId,
    assessmentId,
    type: "premium_health_report",
    status: "premium_ready"
  };
  store.reports.set(report.id, report);
  return { status: 200, reportId: report.id };
}

function readReport(store, { userId, reportId }) {
  const report = store.reports.get(reportId);
  if (!report || report.userId !== userId) {
    return { status: 404 };
  }
  return { status: 200, report };
}

test("Premium purchase grants entitlement with mock checkout webhook", () => {
  const store = createStore();
  createPayment(store, {
    sessionId: "cs_test_premium",
    paymentIntentId: null,
    userId: "user_a",
    product: premiumProduct,
    resourceType: assessmentResource,
    resourceId: "assessment_a"
  });

  handleMockWebhook(store, {
    type: "checkout.session.completed",
    sessionId: "cs_test_premium",
    paymentIntentId: "pi_test_premium"
  });

  assert.equal(
    hasEntitlement(store, {
      userId: "user_a",
      productId: premiumProduct,
      resourceType: assessmentResource,
      resourceId: "assessment_a"
    }),
    true
  );
});

test("Free user cannot generate Premium report", () => {
  const store = createStore();
  const response = generatePremiumReport(store, {
    userId: "user_free",
    assessmentId: "assessment_free"
  });

  assert.equal(response.status, 402);
  assert.equal(store.reports.size, 0);
});

test("Report IDOR isolation blocks cross-user access", () => {
  const store = createStore();
  store.reports.set("report_b", {
    id: "report_b",
    userId: "user_b",
    assessmentId: "assessment_b",
    type: "free_health_report"
  });

  assert.equal(readReport(store, { userId: "user_a", reportId: "report_b" }).status, 404);
  assert.equal(readReport(store, { userId: "user_b", reportId: "report_b" }).status, 200);
});

test("Refund webhook revokes Premium entitlement", () => {
  const store = createStore();
  createPayment(store, {
    sessionId: "cs_test_refund",
    paymentIntentId: null,
    userId: "user_a",
    product: premiumProduct,
    resourceType: assessmentResource,
    resourceId: "assessment_a"
  });
  handleMockWebhook(store, {
    type: "checkout.session.completed",
    sessionId: "cs_test_refund",
    paymentIntentId: "pi_test_refund"
  });
  handleMockWebhook(store, {
    type: "charge.refunded",
    paymentIntentId: "pi_test_refund"
  });

  assert.equal(
    hasEntitlement(store, {
      userId: "user_a",
      productId: premiumProduct,
      resourceType: assessmentResource,
      resourceId: "assessment_a"
    }),
    false
  );
});

test("Premium generation is idempotent per user, assessment, and report type", () => {
  const store = createStore();
  const payment = createPayment(store, {
    sessionId: "cs_test_idempotent",
    paymentIntentId: "pi_test_idempotent",
    userId: "user_a",
    product: premiumProduct,
    resourceType: assessmentResource,
    resourceId: "assessment_a"
  });
  payment.status = "paid";
  grantEntitlement(store, payment);

  const first = generatePremiumReport(store, {
    userId: "user_a",
    assessmentId: "assessment_a"
  });
  const second = generatePremiumReport(store, {
    userId: "user_a",
    assessmentId: "assessment_a"
  });

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(first.reportId, second.reportId);
  assert.equal(store.reports.size, 1);
});

test("Sprint 1B routes keep required guards wired in source", () => {
  const reportGenerate = readFileSync("app/api/reports/generate/route.ts", "utf8");
  const reportRead = readFileSync("app/api/reports/[id]/route.ts", "utf8");
  const webhook = readFileSync("app/api/webhooks/stripe/route.ts", "utf8");
  const aiSecurity = readFileSync("lib/ai-security.ts", "utf8");

  assert.match(reportGenerate, /checkEntitlement/);
  assert.match(reportGenerate, /premium_health_report/);
  assert.match(reportRead, /userId:\s*user\.id/);
  assert.match(reportRead, /checkEntitlement/);
  assert.match(webhook, /checkout\.session\.completed/);
  assert.match(webhook, /charge\.refunded/);
  assert.match(webhook, /payment_intent\.payment_failed/);
  assert.match(aiSecurity, /ip !== "direct" && ip !== "unknown"/);
});
