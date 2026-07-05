"use client";

import { useState } from "react";
import type { Lang } from "@/lib/lang";

export function CheckoutButton({ lang }: { lang: Lang }) {
  const [loading, setLoading] = useState(false);

  async function startCheckout() {
    setLoading(true);
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lang })
    });
    const data = await response.json();
    window.location.href = data.url;
  }

  return (
    <button
      onClick={startCheckout}
      disabled={loading}
      className="mt-5 rounded-md bg-clay px-5 py-3 font-medium text-white hover:bg-ink disabled:opacity-60"
    >
      {loading ? "Opening checkout..." : "Continue to Checkout"}
    </button>
  );
}
