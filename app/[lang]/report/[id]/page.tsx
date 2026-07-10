import Link from "next/link";
import type React from "react";
import { Shell } from "@/components/Shell";
import { getCurrentUser } from "@/lib/auth";
import {
  PRODUCT_PREMIUM_REPORT,
  RESOURCE_ASSESSMENT,
  checkEntitlement
} from "@/lib/entitlements";
import { getLang } from "@/lib/lang";
import { prisma } from "@/lib/prisma";
import { PremiumGenerateButton, PremiumUnlockButton } from "./premium-actions";
import { PrintButton } from "./print-button";

export default async function ReportPage({
  params
}: {
  params: { lang: string; id: string };
}) {
  const lang = getLang(params.lang);
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Shell lang={lang}>
        <Panel title="Sign in required">
          <p>Please sign in to view your AI health assessment result.</p>
          <Link className="mt-4 inline-flex rounded-md bg-leaf px-5 py-3 font-medium text-[#03101c] transition hover:brightness-110" href={`/${lang}/account`}>
            Go to account
          </Link>
        </Panel>
      </Shell>
    );
  }

  const report = await prisma.aIReport.findFirst({
    where: { id: params.id, userId: user.id },
    include: { productRecommendations: { include: { product: true } } }
  });

  if (!report) {
    return (
      <Shell lang={lang}>
        <Panel title="Report not found">
          This report is unavailable or does not belong to your account.
        </Panel>
      </Shell>
    );
  }

  const assessmentId = report.assessmentId || "";
  const premiumUnlocked = assessmentId
    ? await checkEntitlement({
        userId: user.id,
        productId: PRODUCT_PREMIUM_REPORT,
        resourceType: RESOURCE_ASSESSMENT,
        resourceId: assessmentId
      })
    : false;

  if (report.type === "premium_health_report" && !premiumUnlocked) {
    return (
      <Shell lang={lang}>
        <Panel title="Premium report locked">
          <p>
            Premium report access is tied to the original assessment payment. If a
            payment was refunded, expired, failed, or disputed, access is removed.
          </p>
          {assessmentId ? (
            <div className="mt-4">
              <PremiumUnlockButton lang={lang} assessmentId={assessmentId} />
            </div>
          ) : null}
        </Panel>
      </Shell>
    );
  }

  const analysis = normalizeObject(report.analysis);
  const recommendations = normalizeRecommendations(report.recommendations);
  const lifestylePlan = normalizeStringList(report.lifestylePlan);
  const productSuggestions = normalizeProductSuggestions(report.productSuggestions);
  const followUpPlan = normalizeStringList(report.followUpPlan);

  return (
    <Shell lang={lang}>
      <div className="grid gap-5">
        <header className="dark-panel relative overflow-hidden p-6 text-ink sm:p-8">
          {report.type === "premium_health_report" ? (
            <div className="signal-strip absolute inset-x-0 top-0" />
          ) : null}
          <div className="flex flex-wrap items-end justify-between gap-8">
            <div className="max-w-2xl">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-mint">
                {report.type === "premium_health_report"
                  ? "Premium AI Health Report"
                  : "Free AI Health Result"}
              </p>
              <h1 className="mt-3 text-4xl font-semibold text-white">
                AI Health Assessment
              </h1>
              <p className="mt-4 leading-7 text-ink/75">{report.summary}</p>
              <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
                <Badge label="Constitution" value={String(analysis.constitution || "Wellness pattern")} />
                <Badge label="Status" value={report.status} />
                <PrintButton label={lang === "zh" ? "打印 / 保存 PDF" : "Print / Save as PDF"} />
              </div>
            </div>
            <ScoreDial score={report.score} />
          </div>
        </header>

        <Panel title="Basic insights">
          <StringList
            items={
              Array.isArray(analysis.basicInsights)
                ? analysis.basicInsights.map(String)
                : [report.summary]
            }
          />
        </Panel>

        <Panel title="Health management suggestions">
          <RecommendationList items={recommendations} />
        </Panel>

        {report.type === "free_health_report" ? (
          <Panel accent title="Premium report">
            <p>
              Unlock the full AI health management report for deeper lifestyle guidance,
              follow-up planning, and wellness product recommendations connected to this
              assessment.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <p className="font-mono text-xs uppercase tracking-wide text-ink/60">
                  Free result — included
                </p>
                <ul className="mt-2 grid gap-1.5 text-sm text-ink/75">
                  <li>Health score and constitution pattern</li>
                  <li>Basic insights</li>
                  <li>Starter suggestions</li>
                </ul>
              </div>
              <div className="rounded-lg border border-mint/25 bg-mint/[0.06] p-4">
                <p className="font-mono text-xs uppercase tracking-wide text-mint">
                  Premium — $9.99 one-time
                </p>
                <ul className="mt-2 grid gap-1.5 text-sm text-ink/75">
                  <li>Full lifestyle guidance plan</li>
                  <li>Product recommendations matched to your pattern</li>
                  <li>Numbered follow-up plan</li>
                </ul>
              </div>
            </div>
            <p className="mt-3 text-sm text-ink/60">
              This platform provides AI wellness education and health management support.
              It is not a medical diagnosis, treatment plan, emergency service, or
              replacement for a licensed professional.
            </p>
            <div className="mt-5">
              {premiumUnlocked && assessmentId ? (
                <PremiumGenerateButton lang={lang} assessmentId={assessmentId} />
              ) : assessmentId ? (
                <PremiumUnlockButton lang={lang} assessmentId={assessmentId} />
              ) : null}
            </div>
          </Panel>
        ) : (
          <>
            <Panel title="Lifestyle guidance">
              <StringList items={lifestylePlan} />
            </Panel>
            <Panel title="Product recommendations">
              <ProductList
                items={
                  report.productRecommendations.length
                    ? report.productRecommendations.map((item) => ({
                        title: item.title,
                        category: item.category,
                        reason: item.reason,
                        productName: item.product?.name
                      }))
                    : productSuggestions
                }
              />
            </Panel>
            <Panel title="Follow-up plan">
              <StringList ordered items={followUpPlan} />
            </Panel>
          </>
        )}

        <p className="rounded-md border border-amber/20 bg-amber/10 p-4 text-sm text-ink/70">
          AI health assessment is for wellness education and lifestyle guidance only.
          For urgent or serious concerns, contact local emergency services or a qualified
          healthcare professional.
        </p>
      </div>
    </Shell>
  );
}

function normalizeObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeRecommendations(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (item && typeof item === "object") {
      const record = item as Record<string, unknown>;
      return {
        category: String(record.category || "general"),
        content: String(record.content || "")
      };
    }
    return { category: "general", content: String(item) };
  });
}

function normalizeStringList(value: unknown) {
  return Array.isArray(value) ? value.map(String) : [];
}

function normalizeProductSuggestions(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (item && typeof item === "object") {
      const record = item as Record<string, unknown>;
      return {
        title: String(record.title || "Wellness support"),
        category: String(record.category || "general"),
        reason: String(record.reason || "Supports your lifestyle guidance."),
        productName: undefined
      };
    }
    return {
      title: String(item),
      category: "general",
      reason: "Supports your lifestyle guidance.",
      productName: undefined
    };
  });
}

function ScoreDial({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  return (
    <div className="min-w-[190px]">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink/60">
        Health score
      </p>
      <p className="mt-2 flex items-baseline gap-1">
        <span className="font-mono text-6xl font-semibold leading-none text-white">
          {clamped}
        </span>
        <span className="font-mono text-sm text-ink/60">/100</span>
      </p>
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-leaf to-[#0b7cff]"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

function Panel({
  title,
  accent = false,
  children
}: {
  title: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={
        accent
          ? "rounded-xl border border-mint/25 bg-gradient-to-b from-mint/[0.07] to-mist/85 p-5 text-ink sm:p-6"
          : "rounded-xl border border-white/10 bg-mist/85 p-5 text-ink sm:p-6"
      }
    >
      <h2 className="flex items-center gap-3 text-lg font-semibold text-white">
        <span
          aria-hidden
          className="h-4 w-1 shrink-0 rounded-full bg-gradient-to-b from-mint to-[#0b7cff]"
        />
        {title}
      </h2>
      <div className="mt-3 text-ink/75">{children}</div>
    </section>
  );
}

function Badge({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
      <span className="text-ink/60">{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </span>
  );
}

function StringList({ items, ordered = false }: { items: string[]; ordered?: boolean }) {
  if (!items.length) return <p>No guidance is available yet.</p>;
  if (ordered) {
    return (
      <ol className="grid gap-3">
        {items.map((item, index) => (
          <li key={item} className="flex gap-3">
            <span className="font-mono text-sm leading-6 text-mint/80">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="leading-6">{item}</span>
          </li>
        ))}
      </ol>
    );
  }
  return (
    <ul className="grid gap-2.5">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span aria-hidden className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-mint/70" />
          <span className="leading-6">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function RecommendationList({
  items
}: {
  items: Array<{ category: string; content: string }>;
}) {
  if (!items.length) return <p>No recommendations are available yet.</p>;
  return (
    <ul className="grid gap-3">
      {items.map((item) => (
        <li key={`${item.category}-${item.content}`} className="flex flex-wrap items-start gap-3">
          <span className="mt-0.5 rounded-full border border-mint/25 bg-mint/10 px-2.5 py-0.5 font-mono text-xs uppercase tracking-wide text-mint">
            {item.category}
          </span>
          <p className="min-w-0 flex-1 leading-6">{item.content}</p>
        </li>
      ))}
    </ul>
  );
}

function ProductList({
  items
}: {
  items: Array<{ title: string; category: string; reason: string; productName?: string }>;
}) {
  if (!items.length) return <p>Recommendations will appear after Premium generation.</p>;
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <li
          key={`${item.category}-${item.title}`}
          className="rounded-lg border border-white/10 bg-white/[0.03] p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium text-white">{item.productName || item.title}</p>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 font-mono text-xs uppercase tracking-wide text-ink/60">
              {item.category}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-ink/75">{item.reason}</p>
        </li>
      ))}
    </ul>
  );
}
