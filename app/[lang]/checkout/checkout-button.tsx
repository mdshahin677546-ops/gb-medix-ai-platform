"use client";

import { useState } from "react";
import type { Lang } from "@/lib/lang";

export function CheckoutButton({ lang }: { lang: Lang }) {
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<"stripe" | "alipay">("stripe");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  async function startCheckout() {
    if (!email.includes("@")) {
      setError("Please enter a valid email to unlock your plan.");
      return;
    }
    setLoading(true);
    setError("");
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lang, provider, email })
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
    <div className="mt-5 grid gap-4">
      <label className="grid gap-2 text-sm font-medium text-ink">
        Email for unlock access
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          placeholder="you@example.com"
          className="rounded-md border border-black/15 px-3 py-3 outline-none focus:border-leaf"
        />
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          onClick={() => setProvider("stripe")}
          className={
            provider === "stripe"
              ? "rounded-md bg-leaf px-4 py-3 text-white"
              : "rounded-md border border-black/10 px-4 py-3 text-ink"
          }
        >
          Stripe
        </button>
        <button
          onClick={() => setProvider("alipay")}
          className={
            provider === "alipay"
              ? "rounded-md bg-leaf px-4 py-3 text-white"
              : "rounded-md border border-black/10 px-4 py-3 text-ink"
          }
        >
          Alipay
        </button>
      </div>
      <button
        onClick={startCheckout}
        disabled={loading}
        className="rounded-md bg-clay px-5 py-3 font-medium text-white hover:bg-ink disabled:opacity-60"
      >
        {loading ? "Opening checkout..." : "Continue to Checkout"}
      </button>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
