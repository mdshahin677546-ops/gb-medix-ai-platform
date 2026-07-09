"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { copy, type Lang } from "@/lib/lang";

type UploadAsset = {
  name: string;
  type: string;
  size: number;
  preview: string;
};

type ConsentStatus = {
  provider: string;
  required: boolean;
  accepted: boolean;
  consentVersion: string;
};

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
  const [asset, setAsset] = useState<UploadAsset | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [consentStatus, setConsentStatus] = useState<ConsentStatus | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [consentLoading, setConsentLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/ai-consent/status")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data) setConsentStatus(data);
      })
      .catch(() => undefined);
  }, []);

  const consentRequired = Boolean(consentStatus?.required && !consentStatus.accepted);

  async function acceptConsent() {
    setConsentLoading(true);
    setError("");
    const response = await fetch("/api/ai-consent/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accepted: true })
    });
    const data = await response.json().catch(() => ({}));
    setConsentLoading(false);

    if (!response.ok) {
      setError(data.error || "AI processing consent could not be saved.");
      return;
    }

    setConsentStatus(data);
  }

  function setUpload(file?: File) {
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAsset({
        name: file.name,
        type: file.type || "unknown",
        size: file.size,
        preview: typeof reader.result === "string" ? reader.result : ""
      });
    };
    reader.readAsDataURL(file);
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragActive(false);
    setUpload(event.dataTransfer.files?.[0]);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (consentRequired) {
      setError(
        lang === "zh"
          ? "\u8bf7\u5148\u786e\u8ba4\u7b2c\u4e09\u65b9 AI \u5904\u7406\u544a\u77e5\u540e\u518d\u5f00\u59cb\u5065\u5eb7\u8bc4\u4f30\u3002"
          : "Please review and accept the third-party AI processing notice before starting the assessment."
      );
      return;
    }

    setLoading(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const payload = Array.from(formData.keys()).reduce<Record<string, string>>(
      (accumulator, key) => {
        const values = formData
          .getAll(key)
          .filter((value) => !(value instanceof File))
          .map(String)
          .filter(Boolean);
        accumulator[key] = values.join(", ");
        return accumulator;
      },
      {}
    );

    if (asset) {
      payload.uploadSummary = `${asset.name} | ${asset.type} | ${Math.round(asset.size / 1024)}KB`;
    }

    const response = await fetch("/api/tcm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, lang })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (data.error === "AI_CONSENT_REQUIRED") {
        setConsentStatus((current) =>
          current ? { ...current, required: true, accepted: false } : current
        );
      }
      setError(data.message || data.error || "Analysis could not be completed. Please try again.");
      setLoading(false);
      return;
    }

    sessionStorage.setItem("gbmedix:lastResult", JSON.stringify(data.result));
    sessionStorage.setItem("gbmedix:lastRecordId", data.id);
    if (data.reportId) {
      router.push(`/${lang}/report/${data.reportId}`);
      return;
    }
    router.push(`/${lang}/tcm-result`);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="glass-panel grid max-w-5xl gap-5 overflow-hidden rounded-md p-5 shadow-sm"
    >
      {consentRequired ? (
        <section className="rounded-md border border-amber/30 bg-amber/10 p-4 text-sm text-ink">
          <p className="font-semibold text-amber">
            {lang === "zh" ? "\u7b2c\u4e09\u65b9 AI \u5904\u7406\u544a\u77e5" : "Third-party AI processing notice"}
          </p>
          <p className="mt-2 leading-6 text-ink/75">
            {lang === "zh"
              ? "\u6211\u540c\u610f GB Medix \u4f7f\u7528\u7b2c\u4e09\u65b9 AI \u670d\u52a1\u5904\u7406\u6211\u63d0\u4ea4\u7684\u5065\u5eb7\u8bc4\u4f30\u4fe1\u606f\uff0c\u7528\u4e8e\u751f\u6210\u5065\u5eb7\u7ba1\u7406\u5efa\u8bae\u3002\u6211\u7406\u89e3\u8be5\u670d\u52a1\u4e0d\u6784\u6210\u533b\u7597\u8bca\u65ad\u3001\u6cbb\u7597\u6216\u5904\u65b9\u3002"
              : "I agree that GB Medix may use third-party AI services to process the health assessment information I submit in order to generate health management guidance. I understand this service does not provide medical diagnosis, treatment, or prescriptions."}
          </p>
          <p className="mt-2 text-xs text-ink/55">
            {lang === "zh" ? "\u5f53\u524d AI Provider" : "Current AI provider"}: {consentStatus?.provider}
          </p>
          <label className="mt-4 flex items-start gap-3 text-sm text-ink/75">
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={(event) => setConsentChecked(event.currentTarget.checked)}
              className="mt-1 accent-leaf"
            />
            <span>
              {lang === "zh"
                ? "\u6211\u5df2\u9605\u8bfb\u5e76\u540c\u610f\u4e0a\u8ff0\u7b2c\u4e09\u65b9 AI \u5904\u7406\u544a\u77e5\u3002"
                : "I have read and agree to the third-party AI processing notice above."}
            </span>
          </label>
          <button
            type="button"
            onClick={acceptConsent}
            disabled={!consentChecked || consentLoading}
            className="mt-4 rounded-md bg-leaf px-4 py-2 font-medium text-white transition hover:bg-ink disabled:opacity-60"
          >
            {consentLoading
              ? lang === "zh"
                ? "\u6b63\u5728\u4fdd\u5b58..."
                : "Saving..."
              : lang === "zh"
                ? "\u540c\u610f\u5e76\u7ee7\u7eed"
                : "Agree and continue"}
          </button>
        </section>
      ) : null}
      {children}
      <div className="grid gap-4 rounded-md border border-cyan-300/15 bg-cyan-300/[0.03] p-4 lg:grid-cols-[1.05fr_0.95fr]">
        <label
          onDragEnter={() => setDragActive(true)}
          onDragLeave={() => setDragActive(false)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={onDrop}
          className={[
            "group relative grid min-h-[220px] cursor-pointer place-items-center overflow-hidden rounded-md border border-dashed p-5 text-center transition",
            dragActive
              ? "border-mint bg-mint/10 shadow-[0_0_34px_rgba(99,245,215,0.18)]"
              : "border-cyan-200/20 bg-night/55 hover:border-mint/70 hover:bg-mint/5"
          ].join(" ")}
        >
          <span className="scanner-line absolute top-1/2" />
          {asset?.preview && asset.type.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={asset.preview}
              alt={asset.name}
              className="absolute inset-0 h-full w-full object-cover opacity-45 transition duration-500 group-hover:scale-105 group-hover:opacity-60"
            />
          ) : null}
          <span className="absolute inset-x-6 top-6 h-px bg-gradient-to-r from-transparent via-mint/60 to-transparent" />
          <span className="relative z-10 grid gap-3">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-md border border-mint/35 bg-mint/10 text-2xl text-mint shadow-[0_0_28px_rgba(99,245,215,0.2)]">
              +
            </span>
            <span className="text-base font-semibold text-white">
              {lang === "zh" ? "\u4e0a\u4f20\u820c\u8c61\u3001\u62a5\u544a\u6216\u4f53\u8d28\u56fe\u7247" : "Upload tongue photo, report, or wellness image"}
            </span>
            <span className="text-sm text-ink/65">
              {lang === "zh" ? "\u652f\u6301\u70b9\u51fb\u6216\u62d6\u62fd\uff0c\u7528\u4e8e\u751f\u6210\u66f4\u5b8c\u6574\u7684 AI \u5206\u6790\u4e0a\u4e0b\u6587\u3002" : "Click or drag a file here to enrich the AI analysis context."}
            </span>
          </span>
          <input
            ref={fileInputRef}
            name="visualUpload"
            type="file"
            accept="image/*,.pdf"
            className="sr-only"
            onChange={(event) => setUpload(event.currentTarget.files?.[0])}
          />
        </label>

        <div className="relative overflow-hidden rounded-md border border-cyan-300/15 bg-night/65 p-4">
          <div className="product-scan pointer-events-none absolute inset-x-0 top-0 h-full opacity-70" />
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-mint">
            {lang === "zh" ? "\u8d44\u6599\u63a5\u5165\u72b6\u6001" : "Data Intake Status"}
          </p>
          <div className="mt-5 grid gap-3">
            <StatusRow
              active
              label={lang === "zh" ? "\u95ee\u5377\u4fe1\u53f7" : "Questionnaire signal"}
              value={lang === "zh" ? "\u5df2\u63a5\u5165" : "Connected"}
            />
            <StatusRow
              active={Boolean(asset)}
              label={lang === "zh" ? "\u4e0a\u4f20\u8d44\u6599" : "Uploaded evidence"}
              value={
                asset
                  ? `${asset.name} · ${Math.round(asset.size / 1024)}KB`
                  : lang === "zh"
                    ? "\u7b49\u5f85\u4e0a\u4f20"
                    : "Awaiting file"
              }
            />
            <StatusRow
              active={Boolean(asset)}
              label={lang === "zh" ? "AI \u626b\u63cf\u51c6\u5907" : "AI scan readiness"}
              value={asset ? (lang === "zh" ? "\u53ef\u5f00\u59cb\u5206\u6790" : "Ready") : "Optional"}
            />
          </div>
          {asset ? (
            <button
              type="button"
              onClick={() => {
                setAsset(null);
                if (fileInputRef.current) {
                  fileInputRef.current.value = "";
                }
              }}
              className="mt-5 rounded-md border border-white/10 px-3 py-2 text-sm text-ink/70 transition hover:border-mint/60 hover:text-mint"
            >
              {lang === "zh" ? "\u79fb\u9664\u4e0a\u4f20" : "Remove upload"}
            </button>
          ) : null}
        </div>
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button
        disabled={loading || consentRequired}
        className="premium-button rounded-md px-5 py-3 font-medium disabled:opacity-60"
      >
        {loading ? "Analyzing..." : copy[lang].analyze}
      </button>
    </form>
  );
}

function StatusRow({
  active,
  label,
  value
}: {
  active: boolean;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2">
      <span className="flex items-center gap-2 text-sm text-ink/70">
        <span
          className={[
            "h-2.5 w-2.5 rounded-full",
            active ? "signal-meter bg-mint" : "bg-white/20"
          ].join(" ")}
        />
        {label}
      </span>
      <span className="truncate text-right text-sm font-medium text-white">{value}</span>
    </div>
  );
}
