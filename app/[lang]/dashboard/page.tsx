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
    en: ["Free Assessment", "AI wellness intake", "3 min", "start"]
    ,zh: ["\u514d\u8d39\u8bc4\u4f30", "AI \u5065\u5eb7\u95ee\u5377", "3 min", "\u7acb\u5373\u5f00\u59cb"]
  },
  {
    en: ["Free Result", "Basic health insights", "Free", "after intake"],
    zh: ["\u514d\u8d39\u7ed3\u679c", "\u57fa\u7840\u5065\u5eb7\u6d1e\u5bdf", "Free", "\u8bc4\u4f30\u540e\u67e5\u770b"]
  },
  {
    en: ["Premium Report", "Lifestyle guidance", "$9.99", "optional"],
    zh: ["Premium \u62a5\u544a", "\u751f\u6d3b\u65b9\u5f0f\u5efa\u8bae", "$9.99", "\u53ef\u9009\u5347\u7ea7"]
  },
  {
    en: ["Consent Gate", "Third-party AI notice", "Ready", "required before AI"],
    zh: ["AI \u540c\u610f\u95e8", "\u7b2c\u4e09\u65b9 AI \u5904\u7406\u544a\u77e5", "Ready", "AI \u524d\u786e\u8ba4"]
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
  const providerName = getConfiguredAIProviderName();
  const aiConsentStatus = user
    ? await getAIConsentStatus(user.id, providerName)
    : null;
  const consentLabel = aiConsentStatus
    ? aiConsentStatus.required
      ? aiConsentStatus.accepted
        ? lang === "zh" ? "\u5df2\u540c\u610f" : "Accepted"
        : lang === "zh" ? "\u9700\u786e\u8ba4" : "Action needed"
      : lang === "zh" ? "\u5df2\u51c6\u5907" : "Ready"
    : user
      ? lang === "zh" ? "\u68c0\u67e5\u4e2d" : "Checking"
      : lang === "zh" ? "\u767b\u5f55\u540e\u786e\u8ba4" : "Confirm after sign-in";
  const reportReadyLabel = tcmRecords.length
    ? lang === "zh" ? "\u5df2\u6709\u8bc4\u4f30\u6570\u636e" : "Assessment data ready"
    : lang === "zh" ? "\u5c1a\u672a\u5f00\u59cb\u8bc4\u4f30" : "Assessment not started";
  const nextActionHref = user ? `/${lang}/tcm-check` : `/${lang}/account`;
  const nextActionLabel = user
    ? lang === "zh" ? "\u7ee7\u7eed\u5065\u5eb7\u8bc4\u4f30" : "Continue assessment"
    : lang === "zh" ? "\u5f00\u59cb\u514d\u8d39 AI \u5065\u5eb7\u8bc4\u4f30" : "Start free AI assessment";
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
        <section className="glass-panel overflow-hidden rounded-md p-5 sm:p-6">
          <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-md border border-mint/20 bg-mint/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-mint">
                <span className="h-2 w-2 rounded-full bg-mint shadow-[0_0_18px_rgba(99,245,215,0.95)]" />
                GB Medix Health OS
              </div>
              <h1 className="mt-4 max-w-3xl text-3xl font-semibold text-ink sm:text-4xl">
                {lang === "zh" ? zh.title : "User Health Center"}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/65">
                {lang === "zh"
                  ? zh.subtitle
                  : "Review your AI health assessments, reports, payments, and next health management steps."}
              </p>

              {!user ? (
                <div className="mt-5 rounded-md border border-mint/20 bg-mint/10 p-4 text-sm text-ink/75">
                  <p className="font-medium text-mint">
                    {lang === "zh" ? "\u514d\u8d39\u4f53\u9a8c\u5df2\u5c31\u7eea" : "Free assessment is ready"}
                  </p>
                  <p className="mt-2">
                    {lang === "zh"
                      ? zh.signedOutCopy
                      : "Sign in to see your reports, payments, and health management records."}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      href={`/${lang}/account`}
                      className="premium-button rounded-md px-4 py-2 font-semibold"
                    >
                      {nextActionLabel}
                    </Link>
                    <Link
                      href={`/${lang}/account`}
                      className="rounded-md border border-white/10 bg-white/5 px-4 py-2 font-medium text-ink/70 transition hover:border-mint/30 hover:text-mint"
                    >
                      {lang === "zh" ? zh.account : "Go to account"}
                    </Link>
                  </div>
                </div>
              ) : null}
            </div>

            <StatusModule
              lang={lang}
              email={user?.email ?? null}
              providerName={providerName}
              consentLabel={consentLabel}
              reportReadyLabel={reportReadyLabel}
              nextActionHref={nextActionHref}
              nextActionLabel={nextActionLabel}
            />
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {localizedMetrics.map(([label, sublabel, value, trend], index) => (
            <MetricTile
              key={label}
              label={label}
              sublabel={sublabel}
              value={value}
              trend={trend}
              index={index}
            />
          ))}
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="glass-panel rounded-md p-5">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-ink">
                {lang === "zh" ? "\u5065\u5eb7\u7ba1\u7406\u8def\u5f84" : "Health Management Path"}
              </h2>
              <span className="rounded-md border border-white/10 px-3 py-1 text-xs text-ink/60">
                Personal
              </span>
            </div>
            <div className="grid gap-3">
              {localizedPipeline.map(([label, progress, detail], index) => (
                <PathStep
                  key={label}
                  label={label}
                  progress={progress}
                  detail={detail}
                  index={index}
                  isActive={user ? index === Math.min(tcmRecords.length ? 2 : 0, 3) : index === 0}
                />
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

function StatusModule({
  lang,
  email,
  providerName,
  consentLabel,
  reportReadyLabel,
  nextActionHref,
  nextActionLabel
}: {
  lang: string;
  email: string | null;
  providerName: string;
  consentLabel: string;
  reportReadyLabel: string;
  nextActionHref: string;
  nextActionLabel: string;
}) {
  const rows = [
    [lang === "zh" ? "AI Provider" : "AI Provider", providerName],
    [lang === "zh" ? "\u5904\u7406\u540c\u610f" : "Processing consent", consentLabel],
    [lang === "zh" ? "\u62a5\u544a\u51c6\u5907" : "Report readiness", reportReadyLabel]
  ];

  return (
    <aside className="relative overflow-hidden rounded-md border border-cyan-300/15 bg-[#061827]/80 p-4 shadow-[0_0_46px_rgba(25,211,197,0.08)]">
      <span className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-mint/70 to-transparent" />
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-mint/70">
            Live Control
          </p>
          <p className="mt-2 text-sm font-medium text-ink">
            {email ?? (lang === "zh" ? "\u8bbf\u5ba2\u9884\u89c8" : "Guest preview")}
          </p>
        </div>
        <span className="grid h-12 w-12 place-items-center rounded-md border border-mint/25 bg-mint/10 text-xs font-semibold text-mint shadow-[0_0_26px_rgba(99,245,215,0.16)]">
          AI
        </span>
      </div>

      <div className="mt-4 grid gap-2">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2"
          >
            <span className="text-xs text-ink/60">{label}</span>
            <span className="max-w-[54%] truncate text-right text-xs font-medium text-ink/80">
              {value}
            </span>
          </div>
        ))}
      </div>

      <Link
        href={nextActionHref}
        className="mt-4 flex items-center justify-center rounded-md border border-mint/30 bg-mint/10 px-4 py-3 text-sm font-semibold text-mint transition hover:bg-mint/15"
      >
        {nextActionLabel}
      </Link>
    </aside>
  );
}

function MetricTile({
  label,
  sublabel,
  value,
  trend,
  index
}: {
  label: string;
  sublabel: string;
  value: string;
  trend: string;
  index: number;
}) {
  const accent = index % 2 === 0 ? "from-mint/80" : "from-cyan-300/70";

  return (
    <div className="metric-tile relative overflow-hidden rounded-md p-5 transition hover:border-mint/35 hover:bg-mint/[0.04]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink/70">{label}</p>
          <p className="mt-1 text-xs text-ink/35">{sublabel}</p>
        </div>
        <span className="mt-1 h-2 w-2 rounded-full bg-mint shadow-[0_0_16px_rgba(99,245,215,0.9)]" />
      </div>
      <p className="mt-4 text-4xl font-semibold text-ink">{value}</p>
      <p className="mt-2 inline-flex rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-mint">
        {trend}
      </p>
      <span
        className={`absolute inset-x-0 bottom-0 h-px bg-gradient-to-r ${accent} via-sky-300/50 to-transparent`}
      />
    </div>
  );
}

function PathStep({
  label,
  progress,
  detail,
  index,
  isActive
}: {
  label: string;
  progress: string;
  detail: string;
  index: number;
  isActive: boolean;
}) {
  return (
    <div
      className={
        isActive
          ? "rounded-md border border-mint/30 bg-mint/10 p-4 shadow-[0_0_34px_rgba(99,245,215,0.1)]"
          : "rounded-md border border-white/10 bg-white/[0.04] p-4"
      }
    >
      <div className="flex items-center gap-3">
        <span
          className={
            isActive
              ? "grid h-8 w-8 shrink-0 place-items-center rounded-md border border-mint/35 bg-mint/15 text-xs font-semibold text-mint"
              : "grid h-8 w-8 shrink-0 place-items-center rounded-md border border-white/10 bg-white/5 text-xs font-semibold text-ink/60"
          }
        >
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-ink">{label}</span>
            <span className={isActive ? "text-mint" : "text-ink/60"}>{progress}</span>
          </div>
          <div className="mt-3 h-2 rounded-md bg-white/10">
            <div
              className={
                isActive
                  ? "h-2 rounded-md bg-gradient-to-r from-mint to-cyan-300"
                  : "h-2 rounded-md bg-white/20"
              }
              style={{ width: progress }}
            />
          </div>
          <p className="mt-2 text-xs text-ink/55">{detail}</p>
        </div>
      </div>
    </div>
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
        <p className="mt-3 text-sm text-ink/60">{empty}</p>
      )}
    </section>
  );
}
