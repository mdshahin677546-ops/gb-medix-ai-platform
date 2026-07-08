import Link from "next/link";
import Stripe from "stripe";
import { Shell } from "@/components/Shell";
import { getCurrentUser } from "@/lib/auth";
import { ensureDatabase } from "@/lib/db";
import { getLang } from "@/lib/lang";
import { prisma } from "@/lib/prisma";

const days = [
  "Day 1: Warm breakfast, steady hydration, and a gentle evening walk.",
  "Day 2: Reduce late stimulants and add a 10-minute screen-free wind-down.",
  "Day 3: Choose cooked vegetables, balanced protein, and regular meal timing.",
  "Day 4: Add light stretching and observe cold, heat, or heaviness patterns.",
  "Day 5: Protect sleep timing and keep dinner simple.",
  "Day 6: Practice a calm breathing reset after work or study.",
  "Day 7: Review your strongest signals and keep the routines that improved energy."
];

export default async function SuccessPage({
  params,
  searchParams
}: {
  params: { lang: string };
  searchParams: { session_id?: string; demo?: string; provider?: string };
}) {
  const lang = getLang(params.lang);
  const unlocked = await verifyUnlock(searchParams);

  return (
    <Shell lang={lang}>
      {unlocked ? (
        <div className="grid gap-5">
          <h1 className="text-3xl font-semibold text-ink">
            Your Full 7-Day Body Reset Plan
          </h1>
          <PlanSection title="Full 7-day wellness plan" items={days} />
          <PlanSection
            title="Diet suggestions"
            items={[
              "Favor warm, cooked meals and consistent meal timing.",
              "Pair carbohydrates with protein or healthy fats for steadier energy.",
              "Keep evening meals simple and avoid heavy late snacking."
            ]}
          />
          <PlanSection
            title="Lifestyle reset plan"
            items={[
              "Use short daily walks to support circulation and decompression.",
              "Create a repeatable morning rhythm before checking messages.",
              "Track sleep, meals, and body sensations for seven days."
            ]}
          />
          <PlanSection
            title="Sleep improvement plan"
            items={[
              "Keep a stable bedtime window.",
              "Dim lights 45 minutes before bed.",
              "Use a short breathing routine when your mind feels active."
            ]}
          />
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

async function verifyUnlock(searchParams: {
  session_id?: string;
  demo?: string;
  provider?: string;
}) {
  if (searchParams.demo === "1") return true;
  await ensureDatabase();

  const user = await getCurrentUser();
  if (user) {
    const paid = await prisma.paymentRecord.findFirst({
      where: {
        userId: user.id,
        status: "paid"
      }
    });
    if (paid) return true;
  }

  if (!searchParams.session_id || !process.env.STRIPE_SECRET_KEY) return false;

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-02-24.acacia"
  });
  const session = await stripe.checkout.sessions.retrieve(searchParams.session_id);
  const paid = session.payment_status === "paid";

  await prisma.paymentRecord.updateMany({
    where: { sessionId: session.id },
    data: { status: session.payment_status || (paid ? "paid" : "unpaid") }
  });

  return paid;
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
