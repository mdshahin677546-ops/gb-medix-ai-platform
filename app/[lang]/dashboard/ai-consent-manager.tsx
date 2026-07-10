"use client";

import Link from "next/link";
import { useState } from "react";
import type { Lang } from "@/lib/lang";

type ConsentStatus = {
  provider: string;
  required: boolean;
  accepted: boolean;
  consentVersion: string;
  acceptedAt: string | null;
};

export function AIConsentManager({
  lang,
  initialStatus
}: {
  lang: Lang;
  initialStatus: ConsentStatus | null;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  if (!status) return null;

  async function revoke() {
    setLoading(true);
    setMessage("");
    const response = await fetch("/api/ai-consent/revoke", { method: "POST" });
    const data = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setMessage(data.error || "Consent could not be updated.");
      return;
    }

    setStatus(data);
    setMessage(
      lang === "zh"
        ? "\u5df2\u64a4\u56de\u7b2c\u4e09\u65b9 AI \u5904\u7406\u540c\u610f\u3002"
        : "Third-party AI processing consent has been revoked."
    );
  }

  return (
    <section className="glass-panel rounded-md p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-ink">
            {lang === "zh" ? "AI \u5904\u7406\u540c\u610f\u7ba1\u7406" : "Manage AI Processing Consent"}
          </h2>
          <p className="mt-2 text-sm text-ink/60">
            {lang === "zh"
              ? "\u67e5\u770b\u6216\u64a4\u56de\u5f53\u524d AI Provider \u7684\u7b2c\u4e09\u65b9\u5904\u7406\u540c\u610f\u3002"
              : "Review or revoke consent for the current AI provider."}
          </p>
          <Link
            href={`/${lang}/third-party-ai-privacy`}
            className="mt-2 inline-flex text-sm font-medium text-mint underline-offset-4 hover:underline"
          >
            {lang === "zh"
              ? "\u67e5\u770b\u7b2c\u4e09\u65b9 AI \u5904\u7406\u8bf4\u660e"
              : "Read third-party AI processing notice"}
          </Link>
        </div>
        <span className="rounded-md border border-white/10 px-3 py-1 text-xs text-ink/60">
          {status.provider}
        </span>
      </div>
      <div className="mt-4 grid gap-2 text-sm text-ink/70 sm:grid-cols-3">
        <StatusPill
          label={lang === "zh" ? "\u9700\u8981\u540c\u610f" : "Required"}
          value={status.required ? "yes" : "no"}
          active={status.required}
        />
        <StatusPill
          label={lang === "zh" ? "\u72b6\u6001" : "Status"}
          value={status.accepted ? "accepted" : "not accepted"}
          active={status.accepted}
        />
        <StatusPill label="Version" value={status.consentVersion} active />
      </div>
      {status.acceptedAt ? (
        <p className="mt-3 text-xs text-ink/50">Accepted at: {status.acceptedAt}</p>
      ) : null}
      {status.required && status.accepted ? (
        <p className="mt-4 rounded-md border border-amber/20 bg-amber/10 px-3 py-2 text-sm text-ink/65">
          {lang === "zh"
            ? "\u64a4\u56de\u540e\uff0c\u4f7f\u7528\u7b2c\u4e09\u65b9 AI Provider \u65f6\u9700\u8981\u91cd\u65b0\u540c\u610f\u3002"
            : "After revoking, third-party AI provider features will ask for consent again before processing."}
        </p>
      ) : null}
      {status.required && status.accepted ? (
        <button
          type="button"
          onClick={revoke}
          disabled={loading}
          className="mt-4 rounded-md border border-red-300/40 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-60"
        >
          {loading ? "Updating..." : lang === "zh" ? "\u64a4\u56de\u540c\u610f" : "Revoke consent"}
        </button>
      ) : null}
      {message ? <p className="mt-3 text-sm text-ink/65">{message}</p> : null}
    </section>
  );
}

function StatusPill({
  label,
  value,
  active
}: {
  label: string;
  value: string;
  active: boolean;
}) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2">
      <p className="text-xs uppercase tracking-[0.12em] text-ink/40">{label}</p>
      <p className="mt-1 flex items-center gap-2 font-medium text-ink">
        <span className={active ? "h-2 w-2 rounded-full bg-leaf" : "h-2 w-2 rounded-full bg-white/25"} />
        {value}
      </p>
    </div>
  );
}
