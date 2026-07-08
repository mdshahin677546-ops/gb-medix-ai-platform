import Link from "next/link";
import Stripe from "stripe";
import { Shell } from "@/components/Shell";
import { getCurrentUser } from "@/lib/auth";
import {
  grantEntitlementForPayment,
  hasActiveEntitlement,
  PRODUCT_BODY_RESET_PLAN
} from "@/lib/entitlements";
import { getLang } from "@/lib/lang";
import { prisma } from "@/lib/prisma";

export default async function SuccessPage({
  params,
  searchParams
}: {
  params: { lang: string };
  searchParams: { session_id?: string; provider?: string };
}) {
  const lang = getLang(params.lang);
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Shell lang={lang}>
        <div className="max-w-xl rounded-md border border-black/10 bg-white p-6">
          <h1 className="text-3xl font-semibold text-ink">Sign in required</h1>
          <p className="mt-3 text-ink/70">
            Please sign in with the email used at checkout to view your paid AI health
            report.
          </p>
          <Link
            href={`/${lang}/account`}
            className="mt-5 inline-flex rounded-md bg-leaf px-5 py-3 font-medium text-white"
          >
            Go to account
          </Link>
        </div>
      </Shell>
    );
  }

  const unlocked = await verifyUnlock(user.id, searchParams);
  const report = unlocked
    ? await prisma.aIReport.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" }
      })
    : null;
  const analysis = normalizeAnalysis(report?.analysis);
  const recommendations = normalizeRecommendations(report?.recommendations);
  const lifestylePlan = normalizeStringList(report?.lifestylePlan);

  return (
    <Shell lang={lang}>
      {unlocked ? (
        <div className="grid gap-5">
          <h1 className="text-3xl font-semibold text-ink">
            Your AI Health Report
          </h1>
          {report ? (
            <>
              <ReportSection title="Body Insight">
                {report.summary || "No body insight available."}
              </ReportSection>
              <ReportSection title="Constitution Type">
                {analysis.constitution || "No constitution type available."}
              </ReportSection>
              <ReportSection title="What Your Body Is Telling You">
                {analysis.summary || report.summary || "No body signal explanation available."}
              </ReportSection>
              <PlanSection title="Lifestyle Suggestions" items={recommendations} />
              <PlanSection title="7-Day Plan Preview" items={lifestylePlan} />
              <PlanSection title="Recommendations" items={recommendations} />
              <ReportSection title="AI Score">{String(report.score)}/100</ReportSection>
            </>
          ) : (
            <ReportSection title="No Report Found">
              Complete the AI body assessment first so your paid report can be generated from
              your own intake results.
            </ReportSection>
          )}
        </div>
      ) : (
        <div className="max-w-xl rounded-md border border-black/10 bg-white p-6">
          <h1 className="text-3xl font-semibold text-ink">Plan Locked</h1>
          <p className="mt-3 text-ink/70">
            We could not verify a completed payment for this unlock link. Please
            return to checkout to complete access.
          </p>
          <Link
            href={`/${lang}/checkout`}
            className="mt-5 inline-flex rounded-md bg-leaf px-5 py-3 font-medium text-white"
          >
            Back to checkout
          </Link>
        </div>
      )}
    </Shell>
  );
}

async function verifyUnlock(
  userId: string,
  searchParams: {
    session_id?: string;
    provider?: string;
  }
): Promise<boolean> {
  if (await hasActiveEntitlement(userId, PRODUCT_BODY_RESET_PLAN)) {
    return true;
  }

  if (!searchParams.session_id || !process.env.STRIPE_SECRET_KEY) {
    return false;
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-02-24.acacia"
  });
  const session = await stripe.checkout.sessions.retrieve(searchParams.session_id);
  const payment = await prisma.paymentRecord.findUnique({
    where: { sessionId: session.id }
  });

  // The session id must belong to the current user's own body-reset purchase.
  // Never trust a session id alone: it can leak via history, referrer, or logs.
  if (
    !payment ||
    payment.userId !== userId ||
    payment.product !== PRODUCT_BODY_RESET_PLAN
  ) {
    return false;
  }

  const paid = session.payment_status === "paid";
  await prisma.paymentRecord.update({
    where: { id: payment.id },
    data: { status: session.payment_status || (paid ? "paid" : "unpaid") }
  });

  if (!paid) {
    return false;
  }

  await grantEntitlementForPayment(payment.id);
  return hasActiveEntitlement(userId, PRODUCT_BODY_RESET_PLAN);
}

function normalizeAnalysis(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as { constitution?: string; summary?: string };
  }
  return {};
}

function normalizeRecommendations(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (item && typeof item === "object" && "content" in item) {
      return String((item as { content: unknown }).content);
    }
    return String(item);
  });
}

function normalizeStringList(value: unknown) {
  return Array.isArray(value) ? value.map(String) : [];
}

function ReportSection({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-black/10 bg-white p-5">
      <h2 className="text-xl font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-ink/75">{children}</p>
    </section>
  );
}

function PlanSection({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-md border border-black/10 bg-white p-5">
      <h2 className="text-xl font-semibold text-ink">{title}</h2>
      <ul className="mt-3 grid gap-2 text-ink/75">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
