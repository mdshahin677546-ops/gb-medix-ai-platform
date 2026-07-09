import { NextResponse } from "next/server";
import Stripe from "stripe";
import { grantEntitlementForPayment, revokeEntitlement } from "@/lib/entitlements";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe webhook is not configured" }, { status: 400 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-02-24.acacia"
  });
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch {
    return NextResponse.json({ error: "Invalid Stripe signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;
    case "checkout.session.expired":
      await handleCheckoutExpired(event.data.object as Stripe.Checkout.Session);
      break;
    case "payment_intent.payment_failed":
      await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
      break;
    case "charge.refunded":
      await handleChargeReversal(event.data.object as Stripe.Charge, "refunded");
      break;
    case "charge.dispute.created":
      await handleDispute(event.data.object as Stripe.Dispute);
      break;
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const status = session.payment_status === "paid" ? "paid" : session.payment_status || "unpaid";
  const payment = await prisma.paymentRecord.update({
    where: { sessionId: session.id },
    data: {
      status,
      paymentIntentId:
        typeof session.payment_intent === "string" ? session.payment_intent : null
    }
  }).catch(() => null);

  if (payment && status === "paid") {
    await grantEntitlementForPayment(payment.id);
  }
}

async function handleCheckoutExpired(session: Stripe.Checkout.Session) {
  await prisma.paymentRecord.updateMany({
    where: { sessionId: session.id, status: { not: "paid" } },
    data: { status: "expired" }
  });
}

async function handlePaymentIntentFailed(intent: Stripe.PaymentIntent) {
  const payments = await prisma.paymentRecord.updateMany({
    where: { paymentIntentId: intent.id, status: { not: "paid" } },
    data: { status: "failed" }
  });

  if (payments.count === 0) {
    await prisma.paymentRecord.updateMany({
      where: { sessionId: intent.metadata?.checkout_session_id, status: { not: "paid" } },
      data: { status: "failed" }
    });
  }
}

async function handleChargeReversal(charge: Stripe.Charge, status: "refunded" | "disputed") {
  const paymentIntentId =
    typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!paymentIntentId) return;

  const payment = await prisma.paymentRecord.findFirst({
    where: { paymentIntentId }
  });
  if (!payment) return;

  await prisma.$transaction(async (tx) => {
    await tx.paymentRecord.update({
      where: { id: payment.id },
      data: { status }
    });
    await tx.entitlement.updateMany({
      where: { paymentId: payment.id, status: "active" },
      data: { status: "revoked" }
    });
  });

  await revokeEntitlement({ paymentId: payment.id });
}

async function handleDispute(dispute: Stripe.Dispute) {
  const paymentIntentId =
    typeof dispute.payment_intent === "string"
      ? dispute.payment_intent
      : dispute.payment_intent?.id;
  if (!paymentIntentId) return;

  const charge = { payment_intent: paymentIntentId } as Stripe.Charge;
  await handleChargeReversal(charge, "disputed");
}
