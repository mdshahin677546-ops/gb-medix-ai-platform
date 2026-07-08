import Link from "next/link";
import { copy, type Lang } from "@/lib/lang";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export function Shell({
  lang,
  children
}: {
  lang: Lang;
  children: React.ReactNode;
}) {
  return (
    <main className="ambient-grid min-h-screen">
      <header className="sticky top-0 z-30 border-b border-black/10 bg-pearl/75 backdrop-blur-xl">
        <div className="signal-strip" />
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <Link
            href={`/${lang}/assistant`}
            className="flex items-center gap-3 text-lg font-semibold text-ink"
          >
            <span className="brand-mark rounded-md text-sm font-bold">GB</span>
            <span className="hidden sm:inline">GB Medix AI</span>
          </Link>
          <div className="flex max-w-[72vw] gap-1 overflow-x-auto rounded-md border border-black/10 bg-white/55 p-1 text-sm text-ink/75 shadow-sm">
            {[
              ["Assistant", `/${lang}/assistant`],
              ["Consult", `/${lang}/consult`],
              ["Body Test", `/${lang}/tcm-check`],
              ["Shop", `/${lang}/shop`],
              ["RFQ", `/${lang}/rfq`],
              ["Dashboard", `/${lang}/dashboard`],
              ["Account", `/${lang}/account`]
            ].map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className="whitespace-nowrap rounded-md px-3 py-2 transition hover:bg-ink hover:text-white"
              >
                {label}
              </Link>
            ))}
          </div>
          <LanguageSwitcher lang={lang} />
        </nav>
      </header>
      <section className="mx-auto max-w-6xl px-5 py-8 sm:py-10">{children}</section>
      <p className="mx-auto max-w-6xl px-5 pb-8 text-xs text-ink/55">
        {copy[lang].disclaimer}
      </p>
    </main>
  );
}
