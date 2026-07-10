"use client";

import Link from "next/link";
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
  acceptedAt?: string | null;
};

type SessionUser = {
  email: string;
  status: string;
} | null;

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
  const [consentMessage, setConsentMessage] = useState("");
  const [consentStatusLoading, setConsentStatusLoading] = useState(true);
  const [sessionUser, setSessionUser] = useState<SessionUser>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [gateEmail, setGateEmail] = useState("");
  const [gateBusy, setGateBusy] = useState(false);
  const [gateNotice, setGateNotice] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function fetchConsent() {
    setConsentStatusLoading(true);
    try {
      const response = await fetch("/api/ai-consent/status");
      const data = response.ok ? await response.json() : null;
      if (data) setConsentStatus(data);
    } catch {
      // Anonymous or offline: keep the consent step in its default state.
    } finally {
      setConsentStatusLoading(false);
    }
  }

  async function refreshSession(): Promise<SessionUser> {
    try {
      const response = await fetch("/api/session");
      const data = response.ok ? await response.json() : null;
      const user: SessionUser = data?.user
        ? { email: data.user.email, status: data.user.status }
        : null;
      setSessionUser(user);
      return user;
    } catch {
      setSessionUser(null);
      return null;
    } finally {
      setSessionLoading(false);
    }
  }

  useEffect(() => {
    refreshSession();
    fetchConsent();
    // Coming back from the verification email link: confirm success in place.
    const params = new URLSearchParams(window.location.search);
    if (params.get("verified") === "1") {
      setGateNotice(
        lang === "zh"
          ? "邮箱验证成功,可以开始健康评估了。"
          : "Email verified. You can start the health assessment."
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const accountReady = sessionUser?.status === "active";
  const consentRequired = Boolean(consentStatus?.required && !consentStatus.accepted);
  const consentAccepted = Boolean(consentStatus?.required && consentStatus.accepted);
  const submitDisabled =
    loading || sessionLoading || !accountReady || consentStatusLoading || consentRequired;

  // While waiting for the email click, poll so the gate opens by itself.
  useEffect(() => {
    if (sessionLoading || !sessionUser || accountReady) return;
    const timer = setInterval(async () => {
      const user = await refreshSession();
      if (user?.status === "active") {
        fetchConsent();
        setGateNotice(
          lang === "zh"
            ? "邮箱已验证,现在可以开始健康评估。"
            : "Email verified. You can start the health assessment now."
        );
      }
    }, 5000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLoading, sessionUser?.email, accountReady]);

  const analyzeStages =
    lang === "zh"
      ? [
          "正在解析你的睡眠与作息信号...",
          "正在匹配体质模式...",
          "正在生成健康管理建议...",
          "正在整理你的报告..."
        ]
      : [
          "Reading your sleep and rhythm signals...",
          "Matching constitution patterns...",
          "Drafting health management guidance...",
          "Assembling your report..."
        ];
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    if (!loading) {
      setStageIndex(0);
      return;
    }
    const timer = setInterval(
      () => setStageIndex((index) => (index + 1) % analyzeStages.length),
      4000
    );
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  async function startVerification() {
    const email = (sessionUser?.email || gateEmail).trim();
    if (!email) return;
    setGateBusy(true);
    setError("");
    setGateNotice("");

    // Establish a session first so the intake continues on this device.
    const sessionResponse = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    if (!sessionResponse.ok) {
      setGateBusy(false);
      setError(
        lang === "zh" ? "邮箱登录失败,请重试。" : "Sign-in failed. Please try again."
      );
      return;
    }

    const sent = await fetch("/api/auth/send-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, lang })
    });
    const data = await sent.json().catch(() => ({}));
    setGateBusy(false);

    if (!sent.ok) {
      setError(
        data.error ||
          (lang === "zh"
            ? "验证邮件发送失败,请稍后重试。"
            : "The verification email could not be sent. Please try again later.")
      );
      return;
    }

    await refreshSession();
    setGateNotice(
      lang === "zh"
        ? `验证邮件已发送到 ${email}。请点击邮件中的链接完成验证,然后回到本页点击“我已验证”。`
        : `A verification email was sent to ${email}. Click the link inside it, then return here and press "I have verified".`
    );
  }

  async function confirmVerified() {
    setGateBusy(true);
    const user = await refreshSession();
    setGateBusy(false);
    if (user?.status === "active") {
      setGateNotice(
        lang === "zh"
          ? "邮箱已验证,现在可以开始健康评估。"
          : "Email verified. You can start the health assessment now."
      );
      fetchConsent();
    } else {
      setGateNotice(
        lang === "zh"
          ? "还未检测到验证。请先点击邮件中的链接,再刷新状态。"
          : "Verification not detected yet. Click the link in the email first, then refresh."
      );
    }
  }

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
    setConsentChecked(false);
    setConsentMessage(
      lang === "zh"
        ? "\u5df2\u4fdd\u5b58\u540c\u610f\u3002\u73b0\u5728\u53ef\u4ee5\u5f00\u59cb\u5065\u5eb7\u8bc4\u4f30\u3002"
        : "Consent saved. You can now start the health assessment."
    );
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
    if (!accountReady) {
      setError(
        lang === "zh"
          ? "请先在上方完成邮箱验证,再开始健康评估。"
          : "Complete the email verification step above before starting the assessment."
      );
      return;
    }
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
      if (response.status === 401 || response.status === 403) {
        // Session or verification state changed server-side: resync the gate.
        refreshSession();
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
      <section className="grid gap-3 rounded-md border border-white/10 bg-white/[0.04] p-4 sm:grid-cols-2 lg:grid-cols-4">
        <FlowStep
          active
          done={accountReady}
          label={lang === "zh" ? "\u6b65\u9aa4 1" : "Step 1"}
          title={lang === "zh" ? "\u8d26\u6237\u5c31\u7eea" : "Account ready"}
          detail={
            sessionLoading
              ? lang === "zh"
                ? "\u6b63\u5728\u68c0\u67e5"
                : "Checking"
              : accountReady
                ? lang === "zh"
                  ? "\u5df2\u5c31\u7eea"
                  : "Ready"
                : sessionUser
                  ? lang === "zh"
                    ? "\u7b49\u5f85\u90ae\u7bb1\u9a8c\u8bc1"
                    : "Verify your email"
                  : lang === "zh"
                    ? "\u9700\u8981\u90ae\u7bb1\u767b\u5f55"
                    : "Sign in with email"
          }
        />
        <FlowStep
          active={accountReady}
          done={accountReady && !consentRequired && !consentStatusLoading}
          label={lang === "zh" ? "\u6b65\u9aa4 2" : "Step 2"}
          title={lang === "zh" ? "AI \u5904\u7406\u544a\u77e5" : "AI processing notice"}
          detail={
            !accountReady
              ? lang === "zh"
                ? "\u9a8c\u8bc1\u540e\u8fdb\u884c"
                : "After verification"
              : consentStatusLoading
                ? lang === "zh"
                  ? "\u6b63\u5728\u68c0\u67e5"
                  : "Checking"
                : consentRequired
                  ? lang === "zh"
                    ? "\u9700\u8981\u786e\u8ba4"
                    : "Action required"
                  : lang === "zh"
                    ? "\u5df2\u5c31\u7eea"
                    : "Ready"
          }
        />
        <FlowStep
          active={accountReady && !consentRequired}
          done={false}
          label={lang === "zh" ? "\u6b65\u9aa4 3" : "Step 3"}
          title={lang === "zh" ? "\u5b8c\u6210\u95ee\u5377" : "Complete intake"}
          detail={lang === "zh" ? "\u7761\u7720\u3001\u996e\u98df\u3001\u538b\u529b\u7b49" : "Sleep, diet, stress, rhythm"}
        />
        <FlowStep
          active={accountReady && !consentRequired}
          done={false}
          label={lang === "zh" ? "\u6b65\u9aa4 4" : "Step 4"}
          title={lang === "zh" ? "\u67e5\u770b\u62a5\u544a" : "View report"}
          detail={lang === "zh" ? "\u5065\u5eb7\u7ba1\u7406\u5efa\u8bae" : "Health management guidance"}
        />
      </section>

      {accountReady && gateNotice ? (
        <p className="rounded-md border border-leaf/20 bg-leaf/10 px-4 py-3 text-sm font-medium text-leaf">
          {gateNotice}
        </p>
      ) : null}

      {!sessionLoading && !accountReady ? (
        <section className="rounded-md border border-mint/25 bg-mint/[0.06] p-4 text-sm text-ink">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-mint">
            {lang === "zh" ? "\u5f00\u59cb\u524d\u7684\u6700\u540e\u4e00\u6b65" : "One step before you start"}
          </p>
          {!sessionUser ? (
            <>
              <h2 className="mt-1 text-lg font-semibold text-ink">
                {lang === "zh" ? "\u8f93\u5165\u90ae\u7bb1,\u9886\u53d6\u4f60\u7684 AI \u62a5\u544a" : "Enter your email to receive your AI report"}
              </h2>
              <p className="mt-2 leading-6 text-ink/75">
                {lang === "zh"
                  ? "\u62a5\u544a\u4f1a\u7ed1\u5b9a\u5230\u4f60\u7684\u90ae\u7bb1\u3002\u6211\u4eec\u53d1\u9001\u4e00\u5c01\u9a8c\u8bc1\u90ae\u4ef6,\u70b9\u51fb\u94fe\u63a5\u5373\u53ef,\u65e0\u9700\u5bc6\u7801\u3002"
                  : "Your report is tied to your email. We send one verification email \u2014 click the link inside, no password needed."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  type="email"
                  value={gateEmail}
                  onChange={(event) => setGateEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="premium-input min-w-0 flex-1 rounded-md px-3 py-2.5 sm:max-w-xs"
                />
                <button
                  type="button"
                  onClick={startVerification}
                  disabled={gateBusy || !gateEmail.trim()}
                  className="rounded-md bg-leaf px-4 py-2.5 font-medium text-[#03101c] transition hover:brightness-110 disabled:opacity-60"
                >
                  {gateBusy
                    ? lang === "zh"
                      ? "\u6b63\u5728\u53d1\u9001..."
                      : "Sending..."
                    : lang === "zh"
                      ? "\u53d1\u9001\u9a8c\u8bc1\u90ae\u4ef6"
                      : "Send verification email"}
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="mt-1 text-lg font-semibold text-ink">
                {lang === "zh" ? `\u9a8c\u8bc1\u90ae\u7bb1 ${sessionUser.email}` : `Verify ${sessionUser.email}`}
              </h2>
              <p className="mt-2 leading-6 text-ink/75">
                {lang === "zh"
                  ? "\u70b9\u51fb\u9a8c\u8bc1\u90ae\u4ef6\u4e2d\u7684\u94fe\u63a5\u540e,\u56de\u5230\u672c\u9875\u5237\u65b0\u72b6\u6001\u5373\u53ef\u7ee7\u7eed\u3002\u6ca1\u6536\u5230\u90ae\u4ef6\u53ef\u4ee5\u91cd\u53d1\u3002"
                  : "Click the link in the verification email, then refresh your status here to continue. You can resend the email if it did not arrive."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={confirmVerified}
                  disabled={gateBusy}
                  className="rounded-md bg-leaf px-4 py-2.5 font-medium text-[#03101c] transition hover:brightness-110 disabled:opacity-60"
                >
                  {gateBusy
                    ? lang === "zh"
                      ? "\u6b63\u5728\u68c0\u67e5..."
                      : "Checking..."
                    : lang === "zh"
                      ? "\u6211\u5df2\u9a8c\u8bc1,\u5237\u65b0\u72b6\u6001"
                      : "I have verified"}
                </button>
                <button
                  type="button"
                  onClick={startVerification}
                  disabled={gateBusy}
                  className="rounded-md border border-white/10 bg-white/5 px-4 py-2.5 text-ink/75 transition hover:border-mint/60 hover:text-mint disabled:opacity-60"
                >
                  {lang === "zh" ? "\u91cd\u53d1\u9a8c\u8bc1\u90ae\u4ef6" : "Resend email"}
                </button>
              </div>
            </>
          )}
          {gateNotice ? (
            <p className="mt-3 rounded-md border border-mint/20 bg-mint/10 px-3 py-2 text-sm text-mint">
              {gateNotice}
            </p>
          ) : null}
        </section>
      ) : null}

      {consentRequired ? (
        <section className="rounded-md border border-amber/30 bg-amber/10 p-4 text-sm text-ink shadow-[0_0_32px_rgba(245,170,66,0.08)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber">
                {lang === "zh" ? "\u5fc5\u987b\u5b8c\u6210" : "Required before assessment"}
              </p>
              <h2 className="mt-1 text-lg font-semibold text-ink">
                {lang === "zh" ? "\u7b2c\u4e09\u65b9 AI \u5904\u7406\u544a\u77e5" : "Third-party AI processing notice"}
              </h2>
            </div>
            <span className="rounded-md border border-amber/30 bg-white/[0.04] px-3 py-1 text-xs font-medium text-ink">
              {consentStatus?.provider}
            </span>
          </div>
          <p className="mt-2 leading-6 text-ink/75">
            {lang === "zh"
              ? "\u6211\u540c\u610f GB Medix \u4f7f\u7528\u7b2c\u4e09\u65b9 AI \u670d\u52a1\u5904\u7406\u6211\u63d0\u4ea4\u7684\u5065\u5eb7\u8bc4\u4f30\u4fe1\u606f\uff0c\u7528\u4e8e\u751f\u6210\u5065\u5eb7\u7ba1\u7406\u5efa\u8bae\u3002\u6211\u7406\u89e3\u8be5\u670d\u52a1\u4e0d\u6784\u6210\u533b\u7597\u8bca\u65ad\u3001\u6cbb\u7597\u6216\u5904\u65b9\u3002"
              : "I agree that GB Medix may use third-party AI services to process the health assessment information I submit in order to generate health management guidance. I understand this service does not provide medical diagnosis, treatment, or prescriptions."}
          </p>
          <Link
            href={`/${lang}/third-party-ai-privacy`}
            className="mt-3 inline-flex text-sm font-medium text-mint underline-offset-4 hover:underline"
          >
            {lang === "zh"
              ? "\u67e5\u770b\u5b8c\u6574\u7b2c\u4e09\u65b9 AI \u5904\u7406\u8bf4\u660e"
              : "Read the full third-party AI processing notice"}
          </Link>
          <label className="mt-4 flex items-start gap-3 rounded-md border border-amber/20 bg-white/[0.04] p-3 text-sm text-ink/75">
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
            className="mt-4 rounded-md bg-leaf px-4 py-2 font-medium text-[#03101c] transition hover:brightness-110 disabled:opacity-60"
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
      {consentAccepted && consentMessage ? (
        <p className="rounded-md border border-leaf/20 bg-leaf/10 px-4 py-3 text-sm font-medium text-leaf">
          {consentMessage}
        </p>
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
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {loading ? (
        <div className="rounded-md border border-mint/20 bg-mint/[0.06] px-4 py-3 text-sm">
          <p className="font-medium text-mint">
            {lang === "zh" ? "AI 正在分析,约需 20 秒" : "AI is analyzing — about 20 seconds"}
          </p>
          <p className="mt-1 flex items-center gap-2 text-ink/70">
            <span className="signal-meter h-2 w-2 rounded-full bg-mint" />
            {analyzeStages[stageIndex]}
          </p>
        </div>
      ) : null}
      {submitDisabled && !loading ? (
        <p className="text-sm text-ink/55">
          {sessionLoading || consentStatusLoading
            ? lang === "zh"
              ? "\u6b63\u5728\u68c0\u67e5\u8d26\u6237\u4e0e\u6388\u6743\u72b6\u6001..."
              : "Checking account and consent status..."
            : !accountReady
              ? lang === "zh"
                ? "\u5b8c\u6210\u4e0a\u65b9\u90ae\u7bb1\u9a8c\u8bc1\u540e\u5373\u53ef\u63d0\u4ea4\u3002\u4f60\u5df2\u586b\u5199\u7684\u5185\u5bb9\u4f1a\u4fdd\u7559\u5728\u672c\u9875\u3002"
                : "Finish the email verification above to submit. Everything you filled in stays on this page."
              : consentRequired
                ? lang === "zh"
                  ? "\u8bf7\u5148\u5b8c\u6210\u4e0a\u65b9\u540c\u610f\u786e\u8ba4\u3002"
                  : "Complete the consent step above to enable assessment submission."
                : ""}
        </p>
      ) : null}
      <button
        disabled={submitDisabled}
        className="premium-button rounded-md px-5 py-3 font-medium disabled:opacity-60"
      >
        {loading
          ? "Analyzing..."
          : !accountReady && !sessionLoading
            ? lang === "zh"
              ? "\u5148\u9a8c\u8bc1\u90ae\u7bb1\u518d\u5f00\u59cb\u8bc4\u4f30"
              : "Verify email to start assessment"
            : consentRequired
              ? lang === "zh"
                ? "\u5148\u540c\u610f\u518d\u5f00\u59cb\u8bc4\u4f30"
                : "Accept notice to start assessment"
              : copy[lang].analyze}
      </button>
    </form>
  );
}

function FlowStep({
  active,
  done,
  label,
  title,
  detail
}: {
  active: boolean;
  done: boolean;
  label: string;
  title: string;
  detail: string;
}) {
  return (
    <div
      className={[
        "rounded-md border p-3",
        active ? "border-mint/25 bg-mint/10" : "border-white/10 bg-white/[0.03]"
      ].join(" ")}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-mint/70">{label}</p>
      <p className="mt-1 font-semibold text-ink">{title}</p>
      <p className="mt-1 flex items-center gap-2 text-xs text-ink/55">
        <span className={done ? "h-2 w-2 rounded-full bg-leaf" : "h-2 w-2 rounded-full bg-white/20"} />
        {detail}
      </p>
    </div>
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
