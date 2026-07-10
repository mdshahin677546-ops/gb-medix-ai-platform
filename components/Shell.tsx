import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { GBLogo } from "@/components/GBLogo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { copy, type Lang } from "@/lib/lang";

const shellCopy = {
  en: {
    dashboard: "Dashboard",
    assistant: "AI Assistant",
    consult: "Health Planning",
    bodyTest: "Body Test",
    shop: "Shop",
    rfq: "Supply Chain",
    merchant: "Merchant",
    account: "Account",
    console: "AI health management",
    status: "System status: Normal",
    ops: "AI Health Center"
  },
  zh: {
    dashboard: "\u6570\u636e\u770b\u677f",
    assistant: "AI \u52a9\u624b",
    consult: "\u5065\u5eb7\u65b9\u6848",
    bodyTest: "\u8eab\u4f53\u68c0\u6d4b",
    shop: "\u5546\u57ce",
    rfq: "\u4f9b\u5e94\u94fe",
    merchant: "\u5546\u5bb6\u7aef",
    account: "\u8d26\u6237",
    console: "AI \u5065\u5eb7\u7ba1\u7406",
    status: "\u7cfb\u7edf\u72b6\u6001\uff1a\u6b63\u5e38",
    ops: "AI \u5065\u5eb7\u4e2d\u5fc3"
  }
};

export function Shell({
  lang,
  children
}: {
  lang: Lang;
  children: React.ReactNode;
}) {
  const text = lang === "zh" ? shellCopy.zh : shellCopy.en;
  const navItems = [
    { label: text.dashboard, href: `/${lang}/dashboard` },
    { label: text.assistant, href: `/${lang}/assistant` },
    { label: text.consult, href: `/${lang}/consult` },
    { label: text.bodyTest, href: `/${lang}/tcm-check` },
    { label: text.shop, href: `/${lang}/shop` },
    { label: text.rfq, sublabel: "RFQ", href: `/${lang}/rfq` },
    { label: text.merchant, href: "/merchant/dashboard" },
    { label: text.account, href: `/${lang}/account` }
  ];

  return (
    <main className="ambient-grid min-h-screen overflow-x-hidden">
      <div className="signal-strip fixed inset-x-0 top-0 z-40" />
      <div className="grid min-h-screen lg:grid-cols-[260px_1fr]">
        <aside className="hidden border-r border-white/10 bg-[#030914]/90 backdrop-blur-xl print:hidden lg:block">
          <div className="flex h-full flex-col px-4 py-6">
            <Link
              href={`/${lang}/dashboard`}
              className="flex items-center gap-3 px-2 text-lg font-semibold text-ink"
            >
              <GBLogo />
            </Link>

            <AppNav items={navItems} className="mt-8 grid gap-1 text-sm" />

            <div className="mt-auto grid gap-3 border-t border-white/10 pt-5 text-xs text-ink/55">
              <div className="rounded-md border border-white/10 bg-white/5 p-3">
                <p className="font-semibold text-ink">GB Medix Hospital</p>
                <p className="mt-1">
                  {text.console}
                </p>
              </div>
              <p>{copy[lang].disclaimer}</p>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-30 border-b border-white/10 bg-[#06111d]/80 backdrop-blur-xl print:hidden">
            <nav className="flex items-center justify-between gap-4 px-5 py-4">
              <Link
                href={`/${lang}/assistant`}
                className="flex items-center gap-3 text-lg font-semibold text-ink lg:hidden"
              >
                <GBLogo size="sm" />
              </Link>

              <div className="hidden items-center gap-3 text-sm text-ink/65 lg:flex">
                <span className="h-2 w-2 rounded-full bg-mint shadow-[0_0_16px_rgba(99,245,215,0.95)]" />
                <span>{text.status}</span>
                <span className="text-white/20">|</span>
                <span>{text.ops}</span>
              </div>

              <div className="flex items-center gap-3 text-sm text-ink/70">
                <span className="rounded-md border border-mint/20 bg-mint/10 px-3 py-2 text-mint">
                  AI Ready
                </span>
                <LanguageSwitcher lang={lang} />
              </div>
            </nav>

            <AppNav
              items={navItems}
              compact
              className="flex gap-1 overflow-x-auto border-t border-white/10 px-5 py-2 text-sm text-ink/75 lg:hidden"
            />
          </header>

          <section className="mx-auto max-w-[1500px] px-5 py-6 sm:py-8">
            {children}
          </section>
          <p className="px-5 pb-8 text-xs text-ink/60 print:hidden lg:hidden">
            {copy[lang].disclaimer}
          </p>
        </div>
      </div>
    </main>
  );
}
