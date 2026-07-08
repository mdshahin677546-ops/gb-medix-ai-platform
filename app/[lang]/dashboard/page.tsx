import Link from "next/link";
import { Shell } from "@/components/Shell";
import { getCurrentUser } from "@/lib/auth";
import { ensureDatabase } from "@/lib/db";
import { getLang } from "@/lib/lang";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage({ params }: { params: { lang: string } }) {
  const lang = getLang(params.lang);
  await ensureDatabase();
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Shell lang={lang}>
        <div className="max-w-xl rounded-md border border-black/10 bg-white p-6">
          <h1 className="text-3xl font-semibold text-ink">
            {lang === "zh" ? "\u8bf7\u5148\u767b\u5f55" : "Sign in first"}
          </h1>
          <p className="mt-3 text-ink/70">
            {lang === "zh"
              ? "\u767b\u5f55\u540e\u53ef\u4ee5\u67e5\u770b\u4f60\u7684\u62a5\u544a\u3001\u652f\u4ed8\u548c\u8be2\u76d8\u8bb0\u5f55\u3002"
              : "After signing in, you can view your reports, payments, and RFQ records."}
          </p>
          <Link
            href={`/${lang}/account`}
            className="mt-5 inline-flex rounded-md bg-leaf px-5 py-3 font-medium text-white"
          >
            {lang === "zh" ? "\u524d\u5f80\u8d26\u6237" : "Go to account"}
          </Link>
        </div>
      </Shell>
    );
  }

  const [tcmRecords, assistantSessions, payments, rfqs] = await Promise.all([
    prisma.tCMRecord.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5
    }),
    prisma.assistantSession.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5
    }),
    prisma.paymentRecord.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5
    }),
    prisma.rFQRecord.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5
    })
  ]);

  return (
    <Shell lang={lang}>
      <div className="grid gap-5">
        <div>
          <h1 className="text-3xl font-semibold text-ink">
            {lang === "zh" ? "\u6211\u7684\u5065\u5eb7\u8bb0\u5f55" : "My Wellness Records"}
          </h1>
          <p className="mt-2 text-ink/70">{user.email}</p>
        </div>
        <RecordSection title="Body reports" items={tcmRecords.map((item) => item.kind)} />
        <RecordSection
          title="Assistant sessions"
          items={assistantSessions.map((item) =>
            `${item.mode}${item.hasImage ? " + image" : ""}`
          )}
        />
        <RecordSection
          title="Payments"
          items={payments.map((item) => `${item.provider}: ${item.status}`)}
        />
        <RecordSection
          title="RFQs"
          items={rfqs.map((item) => `${item.company}: ${item.productInterest}`)}
        />
      </div>
    </Shell>
  );
}

function RecordSection({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-md border border-black/10 bg-white p-5">
      <h2 className="text-xl font-semibold text-ink">{title}</h2>
      {items.length ? (
        <ul className="mt-3 grid gap-2 text-ink/75">
          {items.map((item, index) => (
            <li key={`${item}-${index}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-ink/55">No records yet.</p>
      )}
    </section>
  );
}
