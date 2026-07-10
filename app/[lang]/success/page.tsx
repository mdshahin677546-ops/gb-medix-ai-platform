import Link from "next/link";
import type React from "react";
import Stripe from "stripe";
import { Shell } from "@/components/Shell";
import { getCurrentUser } from "@/lib/auth";
import { grantEntitlementForPayment } from "@/lib/entitlements";
import { getLang } from "@/lib/lang";
import { prisma } from "@/lib/prisma";

export default async function SuccessPage({
  params,
  searchParams
}: {
  params: { lang: string };
  searchParams: { session_id?: string };
}) {
  const lang = getLang(params.lang);
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Shell lang={lang}>
        <Panel title="Sign in required">
          Please sign in with the email used at checkout to continue.
          <Link className="mt-5 inline-flex rounded-md bg-leaf px-5 py-3 font-medium text-[#03101c] transition hover:brightness-110" href={`/${lang}/account`}>
            Go to account
          </Link>
        </Panel>
      </Shell>
    );
  }

  const result = await verifyPayment(user.id, searchParams.session_id);
  const report = result.payment?.resourceId
    ? await prisma.aIReport.findFirst({
        where: {
          userId: user.id,
          assessmentId: result.payment.resourceId,
          type: "free_health_report"
        }
      })
    : null;

  return (
    <Shell lang={lang}>
      {result.unlocked ? (
        <Panel title="Premium access unlocked">
          <p>
            Your payment has been verified and Premium access has been granted for
            this assessment.
          </p>
          <p className="mt-3">
            Next step: open your report and press <strong>Generate Premium Report</strong> to
            build the full version for this assessment.
          </p>
          <p className="mt-3 text-sm text-ink/60">
            Refunds, expired payments, failed payments, or disputes will revoke the
            Premium entitlement automatically.
          </p>
          <Link
            href={report ? `/${lang}/report/${report.id}` : `/${lang}/dashboard`}
            className="mt-5 inline-flex rounded-md bg-leaf px-5 py-3 font-medium text-[#03101c] transition hover:brightness-110"
          >
            Continue to report
          </Link>
        </Panel>
      ) : (
        <Panel title="Payment not verified">
          We could not verify a completed payment for this checkout session. Please
          return to checkout or contact support if the payment completed.
          <Link
            href={`/${lang}/checkout`}
            className="mt-5 inline-flex rounded-md bg-leaf px-5 py-3 font-medium text-[#03101c] transition hover:brightness-110"
          >
            Back to checkout
          </Link>
        </Panel>
      )}
    </Shell>
  );
}

async function verifyPayment(userId: string, sessionId?: string) {
  if (!sessionId || !process.env.STRIPE_SECRET_KEY) {
    return { unlocked: false, payment: null };
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-02-24.acacia"
  });
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const payment = await prisma.paymentRecord.findUnique({
    where: { sessionId: session.id }
  });

  if (!payment || payment.userId !== userId) {
    return { unlocked: false, payment: null };
  }

  const paid = session.payment_status === "paid";
  await prisma.paymentRecord.update({
    where: { id: payment.id },
    data: {
      status: paid ? "paid" : session.payment_status || "unpaid",
      paymentIntentId:
        typeof session.payment_intent === "string" ? session.payment_intent : null
    }
  });

  if (!paid) {
    return { unlocked: false, payment };
  }

  await grantEntitlementForPayment(payment.id);
  return { unlocked: true, payment };
}

function Panel({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="max-w-xl rounded-md border border-white/10 bg-mist/85 p-6 text-ink">
      <h1 className="text-3xl font-semibold">{title}</h1>
      <div className="mt-3 text-ink/75">{children}</div>
    </section>
  );
}
