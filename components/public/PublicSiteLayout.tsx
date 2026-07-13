import type { ReactNode } from "react";
import type { Lang } from "@/lib/lang";
import { getFunnelCopy } from "@/lib/public-funnel/i18n";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";

/**
 * Public growth-funnel chrome (distinct from the internal app Shell). Supply chain
 * is intentionally absent from public navigation. Header/mobile-nav are client;
 * footer and this wrapper are server components.
 */
export function PublicSiteLayout({ lang, children }: { lang: Lang; children: ReactNode }) {
  const copy = getFunnelCopy(lang);
  return (
    <div className="ambient-grid flex min-h-screen flex-col overflow-x-hidden bg-night text-ink">
      <SiteHeader lang={lang} copy={copy} />
      <main id="main" className="flex-1">{children}</main>
      <SiteFooter lang={lang} copy={copy} />
    </div>
  );
}
