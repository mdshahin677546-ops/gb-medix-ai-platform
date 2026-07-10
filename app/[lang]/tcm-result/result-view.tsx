"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fallbackResult, type TCMResult } from "@/lib/tcm";
import type { Lang } from "@/lib/lang";

export function ResultView({ lang }: { lang: Lang }) {
  const [result, setResult] = useState<TCMResult>(fallbackResult);
  const [recordId, setRecordId] = useState("");

  useEffect(() => {
    const stored = sessionStorage.getItem("gbmedix:lastResult");
    if (stored) setResult(JSON.parse(stored));
    setRecordId(sessionStorage.getItem("gbmedix:lastRecordId") || "");
  }, []);

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
          Unlock Full Plan
        </Link>
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
