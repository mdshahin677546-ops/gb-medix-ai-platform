"use client";

import { useState } from "react";
import type { Lang } from "@/lib/lang";

export function PremiumUnlockButton({
  lang,
  assessmentId
}: {
  lang: Lang;
  assessmentId: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function startCheckout() {
    setLoading(true);
    setError("");
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lang,
        product: "premium_report",
        provider: "stripe",
        assessmentId
      })
    });
    const data = await response.json();
    if (!response.ok || !data.url) {
      setError(data.error || "Checkout is not available.");
      setLoading(false);
      return;
    }
    window.location.href = data.url;
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={startCheckout}
        disabled={loading}
        className="rounded-md bg-clay px-5 py-3 font-medium text-white transition hover:bg-ink disabled:opacity-60"
      >
        {loading ? "Opening Stripe..." : "Unlock Premium Report"}
      </button>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}

export function PremiumGenerateButton({
  lang,
  assessmentId
}: {
  lang: Lang;
  assessmentId: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generatePremium() {
    setLoading(true);
    setError("");
    const response = await fetch("/api/reports/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assessmentId, reportType: "premium_health_report" })
    });
    const data = await response.json();
    if (!response.ok || !data.reportId) {
      setError(data.error || "Premium report could not be generated.");
      setLoading(false);
      return;
    }
    window.location.href = `/${lang}/report/${data.reportId}`;
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={generatePremium}
        disabled={loading}
        className="rounded-md bg-leaf px-5 py-3 font-medium text-white transition hover:bg-ink disabled:opacity-60"
      >
        {loading ? "Generating..." : "Generate Premium Report"}
      </button>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
