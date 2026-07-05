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
    const payload = Object.fromEntries(formData.entries());

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
      className="grid max-w-2xl gap-4 rounded-md border border-black/10 bg-white p-5 shadow-sm"
    >
      {children}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button
        disabled={loading}
        className="rounded-md bg-clay px-5 py-3 font-medium text-white transition hover:bg-ink disabled:opacity-60"
      >
        {loading ? "Analyzing..." : copy[lang].analyze}
      </button>
    </form>
  );
}
