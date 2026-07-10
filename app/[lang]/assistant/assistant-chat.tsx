"use client";

import { useEffect, useState } from "react";
import type { Lang } from "@/lib/lang";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type FamilyMember = {
  id: string;
  name: string;
  age?: string;
  note?: string;
};

type AssistantMode = "chat" | "report" | "product";

const starters = [
  "Why do I feel tired in the afternoon?",
  "Help me understand cold hands and low energy.",
  "Summarize what my sleep pattern may suggest.",
  "Should I take the body type test?"
];

const modeLabels: Record<AssistantMode, string> = {
  chat: "Wellness chat",
  report: "Report image",
  product: "Product image"
};

export function AssistantChat({ lang }: { lang: Lang }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        lang === "zh"
          ? "\u4f60\u597d\uff0c\u6211\u662f GB Medix AI\u3002\u4f60\u53ef\u4ee5\u95ee\u7761\u7720\u3001\u75b2\u52b3\u3001\u996e\u98df\u8282\u5f8b\u3001\u8eab\u4f53\u51b7\u70ed\u6c89\u91cd\u611f\uff0c\u4e5f\u53ef\u4ee5\u4e0a\u4f20\u62a5\u544a\u6216\u4ea7\u54c1\u56fe\u7247\u3002\u6211\u53ea\u505a\u5065\u5eb7\u79d1\u666e\u548c\u751f\u6d3b\u65b9\u5f0f\u53c2\u8003\uff0c\u4e0d\u505a\u8bca\u65ad\u3002"
          : "Hi, I am GB Medix AI. Ask about sleep, energy, diet rhythm, body sensations, or upload a report/product image. I provide wellness education, not diagnosis."
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<AssistantMode>("chat");
  const [imageData, setImageData] = useState("");
  const [imageName, setImageName] = useState("");
  const [error, setError] = useState("");
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [activeMemberId, setActiveMemberId] = useState("self");
  const [newMemberName, setNewMemberName] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("gbmedix:family");
    if (stored) setMembers(JSON.parse(stored));
  }, []);

  function saveMembers(nextMembers: FamilyMember[]) {
    setMembers(nextMembers);
    localStorage.setItem("gbmedix:family", JSON.stringify(nextMembers));
  }

  function addMember() {
    const name = newMemberName.trim();
    if (!name) return;
    const nextMembers = [
      ...members,
      { id: crypto.randomUUID(), name, note: "Family wellness profile" }
    ];
    saveMembers(nextMembers);
    setNewMemberName("");
  }

  async function onImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Please upload a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError("Please upload an image under 4MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImageData(String(reader.result));
      setImageName(file.name);
      setError("");
      if (mode === "chat") setMode("report");
    };
    reader.readAsDataURL(file);
  }

  async function send(content = input) {
    const trimmed = content.trim();
    if ((!trimmed && !imageData) || loading) return;

    const member =
      activeMemberId === "self"
        ? { name: "Self" }
        : members.find((item) => item.id === activeMemberId);
    const userText =
      trimmed ||
      (mode === "product"
        ? "Please identify this wellness product image."
        : "Please explain this report image in plain language.");
    const nextMessages: Message[] = [
      ...messages,
      {
        role: "user",
        content: imageName ? `${userText}\n[Image: ${imageName}]` : userText
      }
    ];

    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError("");

    const response = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lang,
        mode,
        imageData,
        familyMember: member,
        messages: nextMessages
      })
    });
    const data = await response.json();

    if (!response.ok) {
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: data.error || "The request could not be completed."
        }
      ]);
      setLoading(false);
      return;
    }

    setMessages([...nextMessages, { role: "assistant", content: data.reply }]);
    setImageData("");
    setImageName("");
    setLoading(false);
  }

  return (
    <section className="glass-panel overflow-hidden rounded-md">
      <div className="grid gap-4 border-b border-white/10 bg-white/[0.03] p-4 md:grid-cols-[1fr_260px]">
        <div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(modeLabels) as AssistantMode[]).map((item) => (
              <button
                key={item}
                onClick={() => setMode(item)}
                className={
                  mode === item
                    ? "premium-button rounded-md px-3 py-2 text-sm"
                    : "rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-ink/75 transition hover:border-leaf"
                }
              >
                {modeLabels[item]}
              </button>
            ))}
          </div>
          <label className="mt-3 inline-flex cursor-pointer rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-ink/75 transition hover:border-leaf">
            Upload image
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onImageChange}
              className="hidden"
            />
          </label>
          {imageName ? (
            <p className="mt-2 text-xs text-ink/60">Attached: {imageName}</p>
          ) : null}
          {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
        </div>
        <div className="rounded-md border border-white/10 bg-mist/70 p-3">
          <label className="text-xs font-medium uppercase tracking-[0.12em] text-ink/55">
            Family profile
          </label>
          <select
            value={activeMemberId}
            onChange={(event) => setActiveMemberId(event.target.value)}
            className="premium-input mt-2 w-full rounded-md px-3 py-2 text-sm"
          >
            <option value="self">Self</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
          <div className="mt-2 flex gap-2">
            <input
              value={newMemberName}
              onChange={(event) => setNewMemberName(event.target.value)}
              placeholder="Add name"
              className="premium-input min-w-0 flex-1 rounded-md px-2 py-2 text-sm"
            />
            <button
              onClick={addMember}
              className="rounded-md bg-leaf px-3 py-2 text-sm font-medium text-[#03101c] transition hover:bg-mint"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      <div className="grid max-h-[560px] min-h-[420px] content-start gap-3 overflow-y-auto bg-night/40 p-5">
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
          <div className="mr-auto rounded-md border border-white/10 bg-mist/80 px-4 py-3 text-sm text-ink/70 shadow-sm">
            Thinking...
          </div>
        ) : null}
      </div>
      <div className="border-t border-white/10 bg-mist/70 p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          {starters.map((starter) => (
            <button
              key={starter}
              onClick={() => send(starter)}
              className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-ink/75 transition hover:border-leaf hover:bg-white/10"
            >
              {starter}
            </button>
          ))}
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={
              lang === "zh"
                ? "\u8f93\u5165\u5065\u5eb7\u95ee\u9898\uff0c\u6216\u4e0a\u4f20\u56fe\u7247\u540e\u63d0\u95ee..."
                : "Ask a wellness question..."
            }
            className="premium-input min-w-0 flex-1 rounded-md px-3 py-3"
          />
          <button className="premium-button rounded-md px-5 py-3 font-medium">
            {lang === "zh" ? "\u53d1\u9001" : "Send"}
          </button>
        </form>
      </div>
    </section>
  );
}
