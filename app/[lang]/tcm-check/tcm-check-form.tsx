"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { copy, type Lang } from "@/lib/lang";

export function TCMCheckForm({
  lang,
  children
}: {
  lang: Lang;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const payload = Array.from(formData.keys()).reduce<Record<string, string>>(
      (accumulator, key) => {
        const values = formData.getAll(key).map(String).filter(Boolean);
        accumulator[key] = values.join(", ");
        return accumulator;
      },
      {}
    );

    const response = await fetch("/api/tcm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, lang })
    });

    if (!response.ok) {
      setError("Analysis could not be completed. Please try again.");
      setLoading(false);
      return;
    }

    const data = await response.json();
    sessionStorage.setItem("gbmedix:lastResult", JSON.stringify(data.result));
    sessionStorage.setItem("gbmedix:lastRecordId", data.id);
    router.push(`/${lang}/tcm-result`);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="glass-panel grid max-w-4xl gap-5 rounded-md p-5 shadow-sm"
    >
      {children}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button
        disabled={loading}
        className="premium-button rounded-md px-5 py-3 font-medium disabled:opacity-60"
      >
        {loading ? "Analyzing..." : copy[lang].analyze}
      </button>
    </form>
  );
}
