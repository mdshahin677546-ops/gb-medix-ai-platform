import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { copy, type Lang } from "@/lib/lang";

export function Shell({
  lang,
  children
}: {
  lang: Lang;
  children: React.ReactNode;
}) {
  const navItems = [
    { label: "数据看板", sublabel: "Dashboard", href: `/${lang}/dashboard` },
    { label: "AI 助手", sublabel: "Assistant", href: `/${lang}/assistant` },
    { label: "AI 问诊", sublabel: "Consult", href: `/${lang}/consult` },
    { label: "身体检测", sublabel: "Body Test", href: `/${lang}/tcm-check` },
    { label: "商城", sublabel: "Shop", href: `/${lang}/shop` },
    { label: "供应链", sublabel: "RFQ", href: `/${lang}/rfq` },
    { label: "账户", sublabel: "Account", href: `/${lang}/account` }
  ];

  return (
    <main className="command-shell ambient-grid min-h-screen">
      <div className="signal-strip fixed inset-x-0 top-0 z-40" />
      <div className="grid min-h-screen lg:grid-cols-[260px_1fr]">
        <aside className="hidden border-r border-white/10 bg-[#030914]/90 backdrop-blur-xl lg:block">
          <div className="flex h-full flex-col px-4 py-6">
            <Link
              href={`/${lang}/dashboard`}
              className="flex items-center gap-3 px-2 text-lg font-semibold text-ink"
            >
              <span className="brand-mark rounded-md text-sm font-bold">GB</span>
              <span>
                <span className="block leading-5">GB Medix</span>
                <span className="block text-xs font-medium text-ink/55">
                  AI Platform
                </span>
              </span>
            </Link>

            <AppNav items={navItems} className="mt-8 grid gap-1 text-sm" />

            <div className="mt-auto grid gap-3 border-t border-white/10 pt-5 text-xs text-ink/55">
              <div className="rounded-md border border-white/10 bg-white/5 p-3">
                <p className="font-semibold text-ink">GB Medix Hospital</p>
                <p className="mt-1">
                  {lang === "zh"
                    ? "临床运营控制台"
                    : "Clinical operations console"}
                </p>
              </div>
              <p>{copy[lang].disclaimer}</p>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-30 border-b border-white/10 bg-[#06111d]/80 backdrop-blur-xl">
            <nav className="flex items-center justify-between gap-4 px-5 py-4">
              <Link
                href={`/${lang}/assistant`}
                className="flex items-center gap-3 text-lg font-semibold text-ink lg:hidden"
              >
                <span className="brand-mark rounded-md text-sm font-bold">GB</span>
                <span>GB Medix AI</span>
              </Link>

              <div className="hidden items-center gap-3 text-sm text-ink/65 lg:flex">
                <span className="h-2 w-2 rounded-full bg-mint shadow-[0_0_16px_rgba(99,245,215,0.95)]" />
                <span>
                  {lang === "zh" ? "系统状态：正常" : "System status: Normal"}
                </span>
                <span className="text-white/20">|</span>
                <span>{lang === "zh" ? "临床 AI 运营" : "Clinical AI Ops"}</span>
              </div>

              <div className="hidden min-w-[320px] rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm text-ink/55 md:block">
                {lang === "zh"
                  ? "搜索患者、订单、RFQ、产品..."
                  : "Search patients, orders, RFQs, products..."}
              </div>

              <div className="flex items-center gap-3 text-sm text-ink/70">
                <span className="rounded-md border border-mint/20 bg-mint/10 px-3 py-2 text-mint">
                  AI Ready
                </span>
                <span className="hidden sm:inline">Dr. Zhang</span>
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
          <p className="px-5 pb-8 text-xs text-ink/50 lg:hidden">
            {copy[lang].disclaimer}
          </p>
        </div>
      </div>
    </main>
  );
}
