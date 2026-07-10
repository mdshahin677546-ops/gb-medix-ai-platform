"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Lang } from "@/lib/lang";

export function AccountForm({ lang }: { lang: Lang }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [currentEmail, setCurrentEmail] = useState("");
  const [userStatus, setUserStatus] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/session")
      .then((response) => response.json())
      .then((data) => {
        setCurrentEmail(data.user?.email || "");
        setUserStatus(data.user?.status || "");
      });
  }, []);

  async function sendVerification(targetEmail: string) {
    const response = await fetch("/api/auth/send-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: targetEmail })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(
        data.error ||
          (lang === "zh"
            ? "验证邮件发送失败,请稍后重试。"
            : "The verification email could not be sent. Please try again later.")
      );
      return;
    }
    setStatus(
      lang === "zh"
        ? `验证邮件已发送到 ${targetEmail}。点击邮件中的链接完成验证后,即可开始健康评估。`
        : `A verification email was sent to ${targetEmail}. Click the link inside to activate your account, then start the assessment.`
    );
  }

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus("");
    const response = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const data = await response.json();
    setCurrentEmail(data.user?.email || "");
    setUserStatus(data.user?.status || "");

    // New or unverified account: guide through email verification instead of
    // pushing into a flow that would reject the submission.
    if (data.user?.status !== "active") {
      await sendVerification(email);
      setLoading(false);
      return;
    }

    setLoading(false);
    setStatus(
      lang === "zh"
        ? "\u5df2\u767b\u5f55\uff0c\u6b63\u5728\u524d\u5f80\u5065\u5eb7\u8bc4\u4f30..."
        : "Signed in. Taking you to the health assessment..."
    );
    router.push(`/${lang}/tcm-check`);
  }

  async function logout() {
    await fetch("/api/session", { method: "DELETE" });
    setCurrentEmail("");
    setStatus(lang === "zh" ? "\u5df2\u9000\u51fa" : "Signed out");
  }

  return (
    <div className="mt-5 grid gap-4">
      {currentEmail ? (
        <div className="rounded-md border border-leaf/20 bg-white/5 p-4 shadow-sm">
          <p className="text-sm text-ink/65">
            {lang === "zh" ? "\u5f53\u524d\u90ae\u7bb1" : "Current email"}
          </p>
          <p className="mt-1 font-medium text-ink">{currentEmail}</p>
          {userStatus && userStatus !== "active" ? (
            <p className="mt-3 rounded-md border border-amber/25 bg-amber/10 px-3 py-2 text-sm text-ink/75">
              {lang === "zh"
                ? "邮箱还未验证。点击验证邮件中的链接后即可使用 AI 功能。"
                : "Your email is not verified yet. Click the link in the verification email to unlock AI features."}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={() => router.push(`/${lang}/tcm-check`)}
              className="rounded-md bg-leaf px-4 py-2 text-sm font-medium text-[#03101c] transition hover:brightness-110"
            >
              {lang === "zh" ? "\u7ee7\u7eed\u5065\u5eb7\u8bc4\u4f30" : "Continue assessment"}
            </button>
            {userStatus && userStatus !== "active" ? (
              <button
                onClick={() => sendVerification(currentEmail)}
                className="rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm transition hover:border-leaf"
              >
                {lang === "zh" ? "\u91cd\u53d1\u9a8c\u8bc1\u90ae\u4ef6" : "Resend verification email"}
              </button>
            ) : null}
            <button
              onClick={logout}
              className="rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm transition hover:border-leaf"
            >
              {lang === "zh" ? "\u9000\u51fa" : "Sign out"}
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={login} className="grid gap-3">
          <p className="rounded-md border border-mint/20 bg-mint/10 px-3 py-2 text-sm text-ink/70">
            {lang === "zh"
              ? "\u767b\u5f55\u540e\u5c06\u76f4\u63a5\u8fdb\u5165 AI \u5065\u5eb7\u8bc4\u4f30\u6d41\u7a0b\u3002"
              : "After sign-in, you will continue directly into the AI health assessment flow."}
          </p>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            required
            placeholder="you@example.com"
            className="premium-input rounded-md px-3 py-3"
          />
          <button disabled={loading} className="premium-button rounded-md px-5 py-3 font-medium disabled:opacity-60">
            {loading
              ? lang === "zh"
                ? "\u6b63\u5728\u767b\u5f55..."
                : "Signing in..."
              : lang === "zh"
                ? "\u767b\u5f55\u5e76\u5f00\u59cb\u8bc4\u4f30"
                : "Sign in and start assessment"}
          </button>
        </form>
      )}
      {status ? <p className="text-sm text-leaf">{status}</p> : null}
    </div>
  );
}
