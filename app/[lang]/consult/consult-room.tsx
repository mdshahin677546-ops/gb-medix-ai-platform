"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Lang } from "@/lib/lang";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export function ConsultRoom({ lang }: { lang: Lang }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        lang === "zh"
          ? "\u8bf7\u5148\u63cf\u8ff0\u4f60\u60f3\u54a8\u8be2\u7684\u5065\u5eb7\u95ee\u9898\u3002\u6211\u4f1a\u5e2e\u4f60\u6574\u7406\u6210\u66f4\u9002\u5408\u540e\u7eed\u533b\u751f\u5bf9\u63a5\u7684\u95ee\u9898\u6e05\u5355\u3002"
          : "Describe the wellness question you want to ask. I will organize it into a clearer summary for future doctor handoff."
    }
  ]);
  const [input, setInput] = useState("");
  const [remaining, setRemaining] = useState(3);
  const [locked, setLocked] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [handoffStatus, setHandoffStatus] = useState("");
  const [conversationId, setConversationId] = useState("");

  useEffect(() => {
    fetch("/api/session")
      .then((response) => response.json())
      .then((data) => setEmail(data.user?.email || ""));
  }, []);

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = input.trim();
    if (!content || loading) return;

    const nextMessages = [...messages, { role: "user" as const, content }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    const response = await fetch("/api/consult", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lang, conversationId: conversationId || undefined, messages: nextMessages })
    });
    const data = await response.json();
    if (data.conversationId) setConversationId(data.conversationId);
    setRemaining(data.remaining ?? remaining);

    if (response.status === 401) {
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content:
            lang === "zh"
              ? "\u8bf7\u5148\u767b\u5f55\u90ae\u7bb1\uff0c\u8fd9\u6837\u624d\u80fd\u8ba1\u7b97\u4f60\u7684 3 \u6761\u514d\u8d39\u54a8\u8be2\u989d\u5ea6\u3002"
              : "Please sign in with email first so we can count your 3 free consultation messages."
        }
      ]);
      setLoading(false);
      return;
    }

    if (response.status === 402) {
      setLocked(true);
      setMessages([...nextMessages, { role: "assistant", content: data.error }]);
      setLoading(false);
      return;
    }

    setMessages([...nextMessages, { role: "assistant", content: data.reply }]);
    setLoading(false);
  }

  async function unlock() {
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lang,
        provider: "stripe",
        product: "consult_pack",
        email
      })
    });
    const data = await response.json();
    if (!response.ok || !data.url) {
      setHandoffStatus(data.error || "Checkout is not available.");
      return;
    }
    window.location.href = data.url;
  }

  async function submitDoctorOrder() {
    const lastUserMessage =
      [...messages].reverse().find((message) => message.role === "user")?.content || "";
    if (!lastUserMessage) {
      setHandoffStatus(
        lang === "zh"
          ? "\u8bf7\u5148\u63d0\u4ea4\u4e00\u4e2a\u54a8\u8be2\u95ee\u9898\u3002"
          : "Please send a consultation question first."
      );
      return;
    }

    const summary = messages
      .slice(-4)
      .map((message) => `${message.role}: ${message.content}`)
      .join("\n");
    const response = await fetch("/api/consult/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: lastUserMessage, summary, conversationId: conversationId || undefined })
    });

    setHandoffStatus(
      response.ok
        ? lang === "zh"
          ? "\u5df2\u63d0\u4ea4\u5230\u533b\u751f\u5185\u6d4b\u961f\u5217\uff0c\u7b49\u5f85\u63a5\u5355\u3002"
          : "Submitted to the doctor beta queue for acceptance."
        : lang === "zh"
          ? "\u8bf7\u5148\u767b\u5f55\u8d26\u6237\uff0c\u518d\u63d0\u4ea4\u7ed9\u533b\u751f\u961f\u5217\u3002"
          : "Please sign in before submitting to the doctor queue."
    );
  }

  return (
    <section className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="glass-panel overflow-hidden rounded-md">
        <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] p-4">
          <div>
            <p className="text-sm font-semibold text-ink">
              {lang === "zh" ? "\u9884\u95ee\u8bca\u5ba4" : "Pre-consult room"}
            </p>
            <p className="text-xs text-ink/55">
              {lang === "zh"
                ? `\u514d\u8d39\u5269\u4f59 ${remaining} \u6761`
                : `${remaining} free messages left`}
            </p>
          </div>
          <span className="rounded-md bg-amber/20 px-3 py-2 text-xs font-medium text-clay">
            {lang === "zh" ? "\u533b\u751f\u5bf9\u63a5\u5185\u6d4b" : "Doctor handoff beta"}
          </span>
        </div>
        <div className="grid min-h-[420px] content-start gap-3 bg-night/40 p-5">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={
                message.role === "user"
                  ? "ml-auto max-w-[82%] rounded-md bg-leaf px-4 py-3 text-white"
                  : "mr-auto max-w-[88%] rounded-md border border-white/10 bg-mist/80 px-4 py-3 text-ink shadow-sm"
              }
            >
              <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
            </div>
          ))}
          {loading ? (
            <div className="mr-auto rounded-md border border-white/10 bg-mist/80 px-4 py-3 text-sm text-ink/70">
              Thinking...
            </div>
          ) : null}
        </div>
        <form onSubmit={send} className="flex gap-2 border-t border-white/10 bg-mist/70 p-4">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={
              lang === "zh"
                ? "\u8f93\u5165\u4f60\u60f3\u54a8\u8be2\u7684\u95ee\u9898..."
                : "Type your consultation question..."
            }
            className="premium-input min-w-0 flex-1 rounded-md px-3 py-3"
          />
          <button className="premium-button rounded-md px-5 py-3 font-medium">
            {lang === "zh" ? "\u53d1\u9001" : "Send"}
          </button>
        </form>
      </div>
      <aside className="grid content-start gap-4">
        <div className="dark-panel rounded-md p-5 text-white">
          <p className="text-xs uppercase tracking-[0.16em] text-mint/70">
            Beta Price
          </p>
          <h2 className="mt-2 text-3xl font-semibold">$0.69</h2>
          <p className="mt-2 text-sm text-white/65">
            {lang === "zh"
              ? "\u7ea6 CNY 4.90\uff0c\u514d\u8d39 3 \u6761\u540e\u89e3\u9501\u7ee7\u7eed\u54a8\u8be2\u3002"
              : "About CNY 4.90 after 3 free messages."}
          </p>
          {locked ? (
            <button onClick={unlock} className="premium-button mt-5 w-full rounded-md px-5 py-3">
              {lang === "zh" ? "\u89e3\u9501\u7ee7\u7eed\u54a8\u8be2" : "Unlock consultation"}
            </button>
          ) : null}
        </div>
        <div className="glass-panel rounded-md p-5">
          <h2 className="font-semibold text-ink">
            {lang === "zh" ? "\u540e\u671f\u533b\u751f\u5bf9\u63a5" : "Future doctor handoff"}
          </h2>
          <p className="mt-3 text-sm text-ink/70">
            {lang === "zh"
              ? "\u540e\u7eed\u53ef\u5bf9\u63a5\u6267\u4e1a\u533b\u751f\u3001\u6392\u73ed\u3001\u56fe\u6587\u95ee\u8bca\u548c\u590d\u8bca\u8bb0\u5f55\u3002\u76ee\u524d\u4e0d\u5f00\u653e\u771f\u4eba\u533b\u751f\u670d\u52a1\u3002"
              : "Later this can connect licensed doctors, scheduling, text consultation, and follow-up records. Human doctor service is not active yet."}
          </p>
          <button
            onClick={submitDoctorOrder}
            className="premium-button mt-4 w-full rounded-md px-5 py-3 text-sm font-medium"
          >
            {lang === "zh" ? "\u63d0\u4ea4\u7ed9\u533b\u751f\u961f\u5217" : "Submit to doctor queue"}
          </button>
          {handoffStatus ? (
            <p className="mt-3 text-sm text-ink/65">{handoffStatus}</p>
          ) : null}
          <Link href={`/${lang}/account`} className="mt-4 inline-flex text-sm text-leaf">
            {lang === "zh" ? "\u5148\u767b\u5f55\u8d26\u6237" : "Sign in first"}
          </Link>
        </div>
      </aside>
    </section>
  );
}
