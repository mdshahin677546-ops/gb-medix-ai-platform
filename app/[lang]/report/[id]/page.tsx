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
          <Link className="mt-4 inline-flex rounded-md bg-leaf px-5 py-3 text-white" href={`/${lang}/account`}>
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
        <div className="rounded-md border border-white/10 bg-white p-5 text-ink">
          <p className="text-sm font-semibold text-leaf">
            {report.type === "premium_health_report" ? "Premium AI Health Report" : "Free AI Health Result"}
          </p>
          <h1 className="mt-2 text-3xl font-semibold">AI Health Assessment</h1>
          <p className="mt-3 text-ink/70">{report.summary}</p>
          <div className="mt-5 flex flex-wrap gap-3 text-sm">
            <Badge label="Health score" value={`${report.score}/100`} />
            <Badge label="Constitution" value={String(analysis.constitution || "Wellness pattern")} />
            <Badge label="Status" value={report.status} />
          </div>
        </div>

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
          <Panel title="Premium report">
            <p>
              Unlock the full AI health management report for deeper lifestyle guidance,
              follow-up planning, and wellness product recommendations connected to this
              assessment.
            </p>
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
              <StringList items={followUpPlan} />
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

function Panel({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-black/10 bg-white p-5 text-ink">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-3 text-ink/75">{children}</div>
    </section>
  );
}

function Badge({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-md border border-black/10 bg-ink/5 px-3 py-2">
      <span className="text-ink/50">{label}: </span>
      <span className="font-medium">{value}</span>
    </span>
  );
}

function StringList({ items }: { items: string[] }) {
  if (!items.length) return <p>No guidance is available yet.</p>;
  return (
    <ul className="grid gap-2">
      {items.map((item) => (
        <li key={item}>{item}</li>
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
        <li key={`${item.category}-${item.content}`}>
          <span className="font-medium">{item.category}: </span>
          {item.content}
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
    <ul className="grid gap-3">
      {items.map((item) => (
        <li key={`${item.category}-${item.title}`} className="rounded-md border border-black/10 p-3">
          <p className="font-medium">{item.productName || item.title}</p>
          <p className="mt-1 text-sm text-ink/60">{item.category}</p>
          <p className="mt-2">{item.reason}</p>
        </li>
      ))}
    </ul>
  );
}
