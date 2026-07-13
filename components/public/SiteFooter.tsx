import Link from "next/link";
import type { Lang } from "@/lib/lang";
import type { FunnelCopy } from "@/lib/public-funnel/i18n";
import { MedicalDisclaimer } from "./medical";

/** Public global footer: business-priority links, medical disclaimer, review-process note. No supply-chain links. */
export function SiteFooter({ lang, copy }: { lang: Lang; copy: FunnelCopy }) {
  const links = [
    { href: `/${lang}/roundtable`, label: copy.footer.roundtable },
    { href: `/${lang}/ai-consult`, label: copy.footer.consult },
    { href: `/${lang}/services`, label: copy.footer.services },
    { href: `/${lang}/knowledge`, label: copy.footer.knowledge },
    { href: `/${lang}/products`, label: copy.footer.products }
  ];
  return (
    <footer className="mt-8 border-t border-ink/10 bg-night/60">
      <div className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:justify-between">
          <div className="max-w-sm">
            <p className="text-base font-semibold text-ink">GB Medix AI</p>
            <p className="mt-2 text-sm text-ink/60">{copy.brandTagline}</p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-8 gap-y-2">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="text-sm text-ink/70 hover:text-mint focus:outline-none focus-visible:ring-2 focus-visible:ring-mint">{l.label}</Link>
            ))}
          </nav>
        </div>
        <div className="mt-8">
          <MedicalDisclaimer copy={copy} full />
        </div>
        <p className="mt-4 text-xs text-ink/50">{copy.disclaimer.reviewNote}</p>
        <p className="mt-4 text-xs text-ink/40">© {copy.footer.copyright}</p>
      </div>
    </footer>
  );
}
