"use client";

import { useEffect, useState } from "react";
import type { Lang } from "@/lib/lang";

export function AccountForm({ lang }: { lang: Lang }) {
  const [email, setEmail] = useState("");
  const [currentEmail, setCurrentEmail] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetch("/api/session")
      .then((response) => response.json())
      .then((data) => setCurrentEmail(data.user?.email || ""));
  }, []);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const data = await response.json();
    setCurrentEmail(data.user?.email || "");
    setStatus(lang === "zh" ? "\u5df2\u767b\u5f55" : "Signed in");
  }

  async function logout() {
    await fetch("/api/session", { method: "DELETE" });
    setCurrentEmail("");
    setStatus(lang === "zh" ? "\u5df2\u9000\u51fa" : "Signed out");
  }

  return (
    <div className="mt-5 grid gap-4">
      {currentEmail ? (
        <div className="rounded-md border border-leaf/20 bg-white/70 p-4 shadow-sm">
          <p className="text-sm text-ink/65">
            {lang === "zh" ? "\u5f53\u524d\u90ae\u7bb1" : "Current email"}
          </p>
          <p className="mt-1 font-medium text-ink">{currentEmail}</p>
          <button
            onClick={logout}
            className="mt-4 rounded-md border border-black/10 bg-white/75 px-4 py-2 text-sm transition hover:border-leaf"
          >
            {lang === "zh" ? "\u9000\u51fa" : "Sign out"}
          </button>
        </div>
      ) : (
        <form onSubmit={login} className="grid gap-3">
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            required
            placeholder="you@example.com"
            className="premium-input rounded-md px-3 py-3"
          />
          <button className="premium-button rounded-md px-5 py-3 font-medium">
            {lang === "zh" ? "\u767b\u5f55 / \u521b\u5efa\u8d26\u6237" : "Sign in / Create account"}
          </button>
        </form>
      )}
      {status ? <p className="text-sm text-leaf">{status}</p> : null}
    </div>
  );
}
