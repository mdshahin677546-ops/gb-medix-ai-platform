import Link from "next/link";
import { Shell } from "@/components/Shell";
import { getCurrentUser } from "@/lib/auth";
import { getConfiguredAIProviderName } from "@/lib/ai/provider-factory";
import { getAIConsentStatus } from "@/lib/ai-consent/consent-service";
import { getLang } from "@/lib/lang";
import { prisma } from "@/lib/prisma";
import { AIConsentManager } from "./ai-consent-manager";

const zh = {
  title: "\u7528\u6237\u5065\u5eb7\u4e2d\u5fc3",
  subtitle: "\u67e5\u770b\u4f60\u7684 AI \u5065\u5eb7\u8bc4\u4f30\u3001\u62a5\u544a\u3001\u652f\u4ed8\u548c\u4e0b\u4e00\u6b65\u5065\u5eb7\u7ba1\u7406\u5efa\u8bae\u3002",
  signedOut: "\u672a\u767b\u5f55\u6a21\u5f0f",
  signedOutCopy: "\u767b\u5f55\u540e\u53ef\u4ee5\u67e5\u770b\u4f60\u7684\u771f\u5b9e\u62a5\u544a\u3001\u652f\u4ed8\u548c\u5065\u5eb7\u7ba1\u7406\u8bb0\u5f55\u3002",
  account: "\u524d\u5f80\u8d26\u6237",
  records: "\u6211\u7684\u8bb0\u5f55 / My Records",
  noRecords: "\u6682\u65e0\u8bb0\u5f55",
  viewAssistant: "\u6253\u5f00 AI \u52a9\u624b",
  premium: "\u67e5\u770b Premium \u62a5\u544a",
  bodyTest: "\u8eab\u4f53\u68c0\u6d4b"
};

const fallbackMetrics = [
  {
    en: ["Health Reports", "AI health assessment", "0", "sign in"]
    ,zh: ["\u5065\u5eb7\u62a5\u544a", "AI \u5065\u5eb7\u8bc4\u4f30", "0", "\u8bf7\u767b\u5f55"]
  },
  {
    en: ["Premium Reports", "Unlocked reports", "0", "sign in"],
    zh: ["Premium \u62a5\u544a", "\u5df2\u89e3\u9501\u62a5\u544a", "0", "\u8bf7\u767b\u5f55"]
  },
  {
    en: ["Payments", "Payment records", "0", "sign in"],
    zh: ["\u652f\u4ed8\u8bb0\u5f55", "\u4ed8\u6b3e\u72b6\u6001", "0", "\u8bf7\u767b\u5f55"]
  },
  {
    en: ["Next Steps", "Health management", "0", "start free"],
    zh: ["\u4e0b\u4e00\u6b65", "\u5065\u5eb7\u7ba1\u7406\u5efa\u8bae", "0", "\u514d\u8d39\u5f00\u59cb"]
  }
];

const pipeline = [
  {
    en: ["Free assessment", "25%", "Start a short wellness intake"],
    zh: ["\u514d\u8d39\u8bc4\u4f30", "25%", "\u5f00\u59cb\u7b80\u77ed\u5065\u5eb7\u95ee\u5377"]
  },
  {
    en: ["Free result", "50%", "Review basic insights"],
    zh: ["\u514d\u8d39\u7ed3\u679c", "50%", "\u67e5\u770b\u57fa\u7840\u5065\u5eb7\u6d1e\u5bdf"]
  },
  {
    en: ["Premium report", "75%", "Unlock deeper lifestyle guidance"],
    zh: ["Premium \u62a5\u544a", "75%", "\u89e3\u9501\u66f4\u5b8c\u6574\u7684\u751f\u6d3b\u65b9\u5f0f\u5efa\u8bae"]
  },
  {
    en: ["Follow-up", "100%", "Track health management actions"],
    zh: ["\u8ddf\u8fdb\u7ba1\u7406", "100%", "\u8ffd\u8e2a\u5065\u5eb7\u7ba1\u7406\u884c\u52a8"]
  }
];

export default async function DashboardPage({
  params
}: {
  params: { lang: string };
}) {
  const lang = getLang(params.lang);
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
      ])
    : [[], [], []];

  const [tcmRecords, assistantSessions, payments] = records;
  const aiConsentStatus = user
    ? await getAIConsentStatus(user.id, getConfiguredAIProviderName())
    : null;
  const metrics = user
    ? [
        {
          en: ["Health chats", "Assistant sessions", String(assistantSessions.length), "latest 5"],
          zh: ["\u5065\u5eb7\u5bf9\u8bdd", "\u52a9\u624b\u4f1a\u8bdd", String(assistantSessions.length), "\u6700\u8fd1 5 \u6761"]
        },
        {
          en: ["Health Reports", "AI health assessments", String(tcmRecords.length), "latest 5"],
          zh: ["\u4f53\u8d28\u62a5\u544a", "\u8eab\u4f53\u68c0\u6d4b", String(tcmRecords.length), "\u6700\u8fd1 5 \u6761"]
        },
        {
          en: ["Payments", "Payment Records", String(payments.length), "latest 5"],
          zh: ["\u652f\u4ed8\u8bb0\u5f55", "\u4ed8\u6b3e\u72b6\u6001", String(payments.length), "\u6700\u8fd1 5 \u6761"]
        },
        {
          en: ["Next Steps", "Health management", String(tcmRecords.length), "latest 5"],
          zh: ["\u4e0b\u4e00\u6b65", "\u5065\u5eb7\u7ba1\u7406\u5efa\u8bae", String(tcmRecords.length), "\u6700\u8fd1 5 \u6761"]
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
                GB Medix Health Center
              </p>
              <h1 className="mt-3 text-3xl font-semibold text-ink sm:text-4xl">
                {lang === "zh" ? zh.title : "User Health Center"}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/65">
                {lang === "zh"
                  ? zh.subtitle
                  : "Review your AI health assessments, reports, payments, and next health management steps."}
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
                  : "Sign in to see your reports, payments, and health management records."}
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
                {lang === "zh" ? "\u5065\u5eb7\u7ba1\u7406\u8def\u5f84" : "Health Management Path"}
              </h2>
              <span className="rounded-md border border-white/10 px-3 py-1 text-xs text-ink/50">
                Personal
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
            </div>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          {[
            [lang === "zh" ? zh.viewAssistant : "Open AI Assistant", `/${lang}/assistant`],
            [lang === "zh" ? zh.bodyTest : "Start Body Test", `/${lang}/tcm-check`],
            [lang === "zh" ? zh.premium : "View Premium Reports", `/${lang}/checkout`]
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

        <AIConsentManager lang={lang} initialStatus={aiConsentStatus} />
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
