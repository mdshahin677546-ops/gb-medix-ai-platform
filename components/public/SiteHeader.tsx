"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Lang } from "@/lib/lang";
import type { FunnelCopy } from "@/lib/public-funnel/i18n";

/** Public global header: business-priority nav, active state, search, language, login, and the primary consult CTA. */
export function SiteHeader({ lang, copy }: { lang: Lang; copy: FunnelCopy }) {
  const pathname = usePathname() || `/${lang}`;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const nav = [
    { href: `/${lang}/roundtable`, label: copy.nav.roundtable },
    { href: `/${lang}/ai-consult`, label: copy.nav.consult },
    { href: `/${lang}/services`, label: copy.nav.services },
    { href: `/${lang}/knowledge`, label: copy.nav.knowledge },
    { href: `/${lang}/products`, label: copy.nav.products }
  ];
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const otherLang: Lang = lang === "zh" ? "en" : "zh";
  const swapLang = () => {
    const parts = pathname.split("/");
    if (parts[1]) parts[1] = otherLang;
    router.push(parts.join("/") || `/${otherLang}`);
  };
  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    router.push(`/${lang}/roundtable${q ? `?query=${encodeURIComponent(q)}` : ""}`);
    setOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-ink/10 bg-night/85 backdrop-blur">
      <div className="mx-auto flex max-w-[1280px] items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link href={`/${lang}`} className="shrink-0 text-base font-semibold text-ink focus:outline-none focus-visible:text-mint">
          GB&nbsp;Medix&nbsp;AI
        </Link>

        <nav aria-label="Primary" className="ml-4 hidden items-center gap-1 lg:flex">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} aria-current={isActive(item.href) ? "page" : undefined}
              className={`rounded-lg px-3 py-2 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-mint ${isActive(item.href) ? "text-mint" : "text-ink/75 hover:text-ink"}`}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-2 lg:flex">
          <form role="search" onSubmit={submitSearch} className="flex items-center">
            <label htmlFor="site-search" className="sr-only">{copy.nav.search}</label>
            <input id="site-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={copy.list.searchPlaceholder}
              className="w-40 rounded-lg border border-ink/15 bg-mist/50 px-3 py-1.5 text-sm text-ink placeholder:text-ink/40 focus:border-mint focus:outline-none" />
          </form>
          <button type="button" onClick={swapLang} className="rounded-lg px-2 py-1.5 text-sm text-ink/75 hover:text-mint focus:outline-none focus-visible:ring-2 focus-visible:ring-mint">
            {otherLang === "zh" ? "中文" : "EN"}
          </button>
          <Link href={`/${lang}/account`} className="rounded-lg px-3 py-1.5 text-sm text-ink/75 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-mint">{copy.nav.login}</Link>
          <Link href={`/${lang}/consult`} data-event="roundtable_to_consult_click" className="rounded-xl bg-leaf px-4 py-2 text-sm font-semibold text-night transition hover:bg-mint focus:outline-none focus-visible:ring-2 focus-visible:ring-mint">
            {copy.nav.startConsult}
          </Link>
        </div>

        <button type="button" aria-expanded={open} aria-controls="mobile-drawer" onClick={() => setOpen((v) => !v)}
          className="ml-auto rounded-lg border border-ink/15 px-3 py-2 text-sm text-ink lg:hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-mint">
          {open ? copy.nav.close : copy.nav.menu}
        </button>
      </div>

      {open ? (
        <div id="mobile-drawer" className="border-t border-ink/10 bg-night/95 px-4 py-4 lg:hidden">
          <form role="search" onSubmit={submitSearch} className="mb-3">
            <label htmlFor="m-search" className="sr-only">{copy.nav.search}</label>
            <input id="m-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={copy.list.searchPlaceholder}
              className="w-full rounded-lg border border-ink/15 bg-mist/50 px-3 py-2 text-sm text-ink placeholder:text-ink/40 focus:border-mint focus:outline-none" />
          </form>
          <nav aria-label="Mobile" className="flex flex-col">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)} aria-current={isActive(item.href) ? "page" : undefined}
                className={`rounded-lg px-3 py-3 text-sm ${isActive(item.href) ? "text-mint" : "text-ink/80"}`}>{item.label}</Link>
            ))}
          </nav>
          <div className="mt-3 flex items-center gap-2">
            <Link href={`/${lang}/consult`} onClick={() => setOpen(false)} className="flex-1 rounded-xl bg-leaf px-4 py-3 text-center text-sm font-semibold text-night">{copy.nav.startConsult}</Link>
            <button type="button" onClick={swapLang} className="rounded-lg border border-ink/15 px-3 py-3 text-sm text-ink/80">{otherLang === "zh" ? "中文" : "EN"}</button>
          </div>
        </div>
      ) : null}
    </header>
  );
}
