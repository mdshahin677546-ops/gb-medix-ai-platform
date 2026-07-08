import { Shell } from "@/components/Shell";
import { getLang } from "@/lib/lang";
import { AccountForm } from "./account-form";

export default function AccountPage({ params }: { params: { lang: string } }) {
  const lang = getLang(params.lang);

  return (
    <Shell lang={lang}>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
        <div className="glass-panel rounded-md p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-leaf">
            Secure Session
          </p>
          <h1 className="mt-3 text-4xl font-semibold text-ink">
            {lang === "zh" ? "\u6211\u7684\u8d26\u6237" : "My Account"}
          </h1>
          <p className="mt-3 max-w-2xl text-ink/70">
            {lang === "zh"
              ? "\u7528\u90ae\u7bb1\u7ed1\u5b9a\u4f60\u7684\u62a5\u544a\u3001\u652f\u4ed8\u548c\u8be2\u76d8\u8bb0\u5f55\u3002"
              : "Use your email to bind reports, payments, and RFQ records."}
          </p>
          <AccountForm lang={lang} />
        </div>
        <div className="dark-panel rounded-md p-5 text-white">
          <p className="text-xs uppercase tracking-[0.16em] text-mint/70">
            Account Graph
          </p>
          <h2 className="mt-2 text-2xl font-semibold">One profile, all flows</h2>
          <div className="mt-5 grid gap-3 text-sm text-white/70">
            <p>AI assistant sessions</p>
            <p>Body type reports</p>
            <p>Payment unlock status</p>
            <p>B2B RFQ records</p>
          </div>
        </div>
      </div>
    </Shell>
  );
}
