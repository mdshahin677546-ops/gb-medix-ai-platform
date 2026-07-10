"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { TCMResult } from "@/lib/tcm";
import type { Lang } from "@/lib/lang";

export function ResultView({ lang }: { lang: Lang }) {
  const [result, setResult] = useState<TCMResult | null>(null);
  const [recordId, setRecordId] = useState("");
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem("gbmedix:lastResult");
    if (stored) {
      setResult(JSON.parse(stored));
      setRecordId(sessionStorage.getItem("gbmedix:lastRecordId") || "");
    } else {
      // Never show fabricated fallback content as if it were the user's result.
      setMissing(true);
    }
  }, []);

  if (missing) {
    return (
      <div className="max-w-xl rounded-xl border border-white/10 bg-mist/85 p-6 text-ink">
        <h1 className="text-2xl font-semibold text-white">
          {lang === "zh" ? "结果已过期" : "This result is no longer available"}
        </h1>
        <p className="mt-3 leading-6 text-ink/75">
          {lang === "zh"
            ? "评估结果只在提交后的浏览器会话中临时保存。重新完成一次评估即可获取最新结果,历史报告可在数据看板中查看。"
            : "Assessment results are held only for the browser session in which they were created. Retake the assessment for a fresh result, or find saved reports on your dashboard."}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={`/${lang}/tcm-check`}
            className="rounded-md bg-leaf px-5 py-3 font-medium text-[#03101c] transition hover:brightness-110"
          >
            {lang === "zh" ? "重新评估" : "Retake assessment"}
          </Link>
          <Link
            href={`/${lang}/dashboard`}
            className="rounded-md border border-white/10 bg-white/5 px-5 py-3 text-ink/75 transition hover:border-mint/60 hover:text-mint"
          >
            {lang === "zh" ? "查看数据看板" : "Go to dashboard"}
          </Link>
        </div>
      </div>
    );
  }

  if (!result) {
    return null;
  }

  return (
    <div className="grid gap-5">
      <h1 className="text-3xl font-semibold text-ink">Your Body Type Insight</h1>
      <Section title="Body Insight">{result.bodyInsight}</Section>
      <Section title="Constitution Type">{result.constitutionType}</Section>
      <Section title="What Your Body Is Telling You">
        {result.whatYourBodyIsTellingYou}
      </Section>
      <List title="Lifestyle Suggestions" items={result.lifestyleSuggestions} />
      <Section title="Risk Level">{result.riskLevel}</Section>
      <List title="Hidden Signals" items={result.hiddenSignals} muted />
      <List title="7-Day Plan Preview (30%)" items={result.sevenDayPlanPreview} />
      <div className="rounded-md border border-leaf/25 bg-mist/85 p-5">
        <h2 className="text-xl font-semibold text-ink">Unlock the full plan</h2>
        <p className="mt-2 text-ink/75">{result.upgradeCta}</p>
        <Link
          href={`/${lang}/checkout${recordId ? `?assessmentId=${recordId}` : ""}`}
          className="mt-4 inline-flex rounded-md bg-leaf px-5 py-3 font-medium text-[#03101c] hover:brightness-110"
        >
          Unlock Full Plan · $9.99
        </Link>
        <p className="mt-2 text-xs text-ink/60">
          {lang === "zh" ? "一次性解锁,绑定本次评估。" : "One-time unlock, tied to this assessment."}
        </p>
      </div>
    </div>
  );
}

function Section({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-white/10 bg-mist/85 p-5">
      <h2 className="text-xl font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-ink/75">{children}</p>
    </section>
  );
}

function List({
  title,
  items,
  muted = false
}: {
  title: string;
  items: string[];
  muted?: boolean;
}) {
  return (
    <section className="rounded-md border border-white/10 bg-mist/85 p-5">
      <h2 className="text-xl font-semibold text-ink">{title}</h2>
      <ul className="mt-3 grid gap-2 text-ink/75">
        {items.map((item) => (
          <li key={item} className={muted ? "blur-[1px]" : ""}>
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
