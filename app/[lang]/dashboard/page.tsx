import Link from "next/link";
import { Shell } from "@/components/Shell";
import { getCurrentUser } from "@/lib/auth";
import { ensureDatabase } from "@/lib/db";
import { getLang } from "@/lib/lang";
import { prisma } from "@/lib/prisma";

const zh = {
  title: "\u6570\u636e\u770b\u677f",
  subtitle: "\u805a\u5408 AI \u95ee\u8bca\u3001\u4f53\u8d28\u68c0\u6d4b\u3001\u652f\u4ed8\u548c RFQ \u8bb0\u5f55\uff0c\u7528\u4e00\u4e2a\u63a7\u5236\u53f0\u8ddf\u8fdb\u5065\u5eb7\u4e0e\u4f9b\u5e94\u94fe\u72b6\u6001\u3002",
  signedOut: "\u672a\u767b\u5f55\u6a21\u5f0f",
  signedOutCopy: "\u767b\u5f55\u540e\u53ef\u4ee5\u67e5\u770b\u4f60\u7684\u771f\u5b9e\u62a5\u544a\u3001\u652f\u4ed8\u548c\u8be2\u76d8\u8bb0\u5f55\u3002\u5f53\u524d\u5c55\u793a\u4e3a\u8fd0\u8425\u9884\u89c8\u6570\u636e\u3002",
  account: "\u524d\u5f80\u8d26\u6237",
  records: "\u6211\u7684\u8bb0\u5f55 / My Records",
  noRecords: "\u6682\u65e0\u8bb0\u5f55",
  viewAssistant: "\u6253\u5f00 AI \u52a9\u624b",
  submitRfq: "\u63d0\u4ea4 RFQ",
  bodyTest: "\u8eab\u4f53\u68c0\u6d4b"
};

const fallbackMetrics = [
  {
    en: ["AI Consults", "Assistant Sessions", "24", "+18%"],
    zh: ["AI \u95ee\u8bca", "\u52a9\u624b\u4f1a\u8bdd", "24", "+18%"]
  },
  {
    en: ["Body Reports", "Body Pattern Scans", "12", "+6%"],
    zh: ["\u4f53\u8d28\u62a5\u544a", "\u8eab\u4f53\u68c0\u6d4b", "12", "+6%"]
  },
  {
    en: ["Supply RFQs", "Supplier Requests", "8", "+3"],
    zh: ["RFQ \u8be2\u76d8", "\u4f9b\u5e94\u94fe\u8bf7\u6c42", "8", "+3"]
  },
  {
    en: ["Payments", "Payment Records", "5", "stable"],
    zh: ["\u652f\u4ed8\u8bb0\u5f55", "\u4ed8\u6b3e\u72b6\u6001", "5", "\u7a33\u5b9a"]
  }
];

const pipeline = [
  {
    en: ["AI pre-consult", "82%", "Initial analysis completed"],
    zh: ["AI \u9884\u95ee\u8bca", "82%", "\u5df2\u5b8c\u6210\u521d\u6b65\u5206\u6790"]
  },
  {
    en: ["Body pattern", "72%", "Body pattern data available"],
    zh: ["\u4f53\u8d28\u6570\u636e", "72%", "\u4f53\u8d28\u6570\u636e\u53ef\u7528"]
  },
  {
    en: ["RFQ review", "64%", "Supplier quotes in progress"],
    zh: ["RFQ \u590d\u6838", "64%", "\u4f9b\u5e94\u5546\u62a5\u4ef7\u4e2d"]
  },
  {
    en: ["Doctor handoff", "38%", "Waiting for clinical review"],
    zh: ["\u533b\u751f\u4ea4\u63a5", "38%", "\u7b49\u5f85\u4e13\u4eba\u590d\u6838"]
  }
];

export default async function DashboardPage({
  params
}: {
  params: { lang: string };
}) {
  const lang = getLang(params.lang);
  await ensureDatabase();
  const user = await getCurrentUser();

  const records = user
    ? await Promise.all([
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
      ])
    : [[], [], [], []];

  const [tcmRecords, assistantSessions, payments, rfqs] = records;
  const metrics = user
    ? [
        {
          en: ["AI Consults", "Assistant Sessions", String(assistantSessions.length), "latest 5"],
          zh: ["AI \u95ee\u8bca", "\u52a9\u624b\u4f1a\u8bdd", String(assistantSessions.length), "\u6700\u8fd1 5 \u6761"]
        },
        {
          en: ["Body Reports", "Body Pattern Scans", String(tcmRecords.length), "latest 5"],
          zh: ["\u4f53\u8d28\u62a5\u544a", "\u8eab\u4f53\u68c0\u6d4b", String(tcmRecords.length), "\u6700\u8fd1 5 \u6761"]
        },
        {
          en: ["Supply RFQs", "Supplier Requests", String(rfqs.length), "latest 5"],
          zh: ["RFQ \u8be2\u76d8", "\u4f9b\u5e94\u94fe\u8bf7\u6c42", String(rfqs.length), "\u6700\u8fd1 5 \u6761"]
        },
        {
          en: ["Payments", "Payment Records", String(payments.length), "latest 5"],
          zh: ["\u652f\u4ed8\u8bb0\u5f55", "\u4ed8\u6b3e\u72b6\u6001", String(payments.length), "\u6700\u8fd1 5 \u6761"]
        }
      ]
    : fallbackMetrics;
  const localizedMetrics = metrics.map((item) => (lang === "zh" ? item.zh : item.en));
  const localizedPipeline = pipeline.map((item) => (lang === "zh" ? item.zh : item.en));

  return (
    <Shell lang={lang}>
      <div className="grid gap-5">
        <section className="glass-panel rounded-md p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-mint/70">
                GB Medix Command Center
              </p>
              <h1 className="mt-3 text-3xl font-semibold text-ink sm:text-4xl">
                {lang === "zh" ? zh.title : "Operations Dashboard"}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/65">
                {lang === "zh"
                  ? zh.subtitle
                  : "Unify AI consultation, body pattern scans, payments, and RFQ records in one clinical operations dashboard."}
              </p>
            </div>
            <div className="rounded-md border border-mint/20 bg-mint/10 px-4 py-3 text-sm text-mint">
              {user ? user.email : lang === "zh" ? zh.signedOut : "Signed-out preview"}
            </div>
          </div>

          {!user ? (
            <div className="mt-5 rounded-md border border-amber/25 bg-amber/10 p-4 text-sm text-ink/75">
              <p className="font-medium text-amber">
                {lang === "zh" ? zh.signedOut : "Signed-out mode"}
              </p>
              <p className="mt-2">
                {lang === "zh"
                  ? zh.signedOutCopy
                  : "Sign in to see your real reports, payments, and RFQ records. This view is using operational preview data."}
              </p>
              <Link
                href={`/${lang}/account`}
                className="mt-4 inline-flex rounded-md border border-mint/25 bg-mint/10 px-4 py-2 font-medium text-mint transition hover:bg-mint/15"
              >
                {lang === "zh" ? zh.account : "Go to account"}
              </Link>
            </div>
          ) : null}
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {localizedMetrics.map(([label, sublabel, value, trend]) => (
            <div key={label} className="metric-tile rounded-md p-5">
              <p className="text-sm text-ink/55">{label}</p>
              <p className="mt-1 text-xs text-ink/35">{sublabel}</p>
              <p className="mt-4 text-4xl font-semibold text-ink">{value}</p>
              <p className="mt-2 text-xs text-mint">{trend}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="glass-panel rounded-md p-5">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-ink">
                {lang === "zh" ? "\u8fd0\u8425\u6d41\u7a0b / Care Pipeline" : "Care Pipeline"}
              </h2>
              <span className="rounded-md border border-white/10 px-3 py-1 text-xs text-ink/50">
                Live Ops
              </span>
            </div>
            <div className="grid gap-4">
              {localizedPipeline.map(([label, progress, detail]) => (
                <div key={label} className="rounded-md border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-ink">{label}</span>
                    <span className="text-mint">{progress}</span>
                  </div>
                  <div className="mt-3 h-2 rounded-md bg-white/10">
                    <div
                      className="h-2 rounded-md bg-mint"
                      style={{ width: progress }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-ink/55">{detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel rounded-md p-5">
            <h2 className="text-xl font-semibold text-ink">
              {lang === "zh" ? zh.records : "My Records"}
            </h2>
            <div className="mt-4 grid gap-3">
              <RecordSection
                title="Body reports"
                items={tcmRecords.map((item) => item.kind)}
                empty={lang === "zh" ? zh.noRecords : "No records yet."}
              />
              <RecordSection
                title="Assistant sessions"
                items={assistantSessions.map((item) =>
                  `${item.mode}${item.hasImage ? " + image" : ""}`
                )}
                empty={lang === "zh" ? zh.noRecords : "No records yet."}
              />
              <RecordSection
                title="Payments"
                items={payments.map((item) => `${item.provider}: ${item.status}`)}
                empty={lang === "zh" ? zh.noRecords : "No records yet."}
              />
              <RecordSection
                title="RFQs"
                items={rfqs.map((item) => `${item.company}: ${item.productInterest}`)}
                empty={lang === "zh" ? zh.noRecords : "No records yet."}
              />
            </div>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          {[
            [lang === "zh" ? zh.viewAssistant : "Open AI Assistant", `/${lang}/assistant`],
            [lang === "zh" ? zh.bodyTest : "Start Body Test", `/${lang}/tcm-check`],
            [lang === "zh" ? zh.submitRfq : "Submit RFQ", `/${lang}/rfq`]
          ].map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="rounded-md border border-white/10 bg-white/5 px-5 py-4 font-medium text-ink transition hover:border-mint/40 hover:bg-mint/10"
            >
              {label}
            </Link>
          ))}
        </section>
      </div>
    </Shell>
  );
}

function RecordSection({
  title,
  items,
  empty
}: {
  title: string;
  items: string[];
  empty: string;
}) {
  return (
    <section className="rounded-md border border-white/10 bg-white/5 p-4">
      <h3 className="font-semibold text-ink">{title}</h3>
      {items.length ? (
        <ul className="mt-3 grid gap-2 text-sm text-ink/70">
          {items.map((item, index) => (
            <li key={`${item}-${index}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-ink/45">{empty}</p>
      )}
    </section>
  );
}
