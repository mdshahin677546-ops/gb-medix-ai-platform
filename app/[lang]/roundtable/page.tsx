import type { Metadata } from "next";
import Link from "next/link";
import { getLang } from "@/lib/lang";
import { getFunnelCopy, funnelLocale } from "@/lib/public-funnel/i18n";
import { listPublicRoundtables, type RoundtableSort } from "@/lib/public-funnel/repository";
import { PublicSiteLayout } from "@/components/public/PublicSiteLayout";
import { Container, SectionHeading, ButtonLink } from "@/components/public/ui";
import { RoundtableCard } from "@/components/public/roundtable";
import { MedicalDisclaimer } from "@/components/public/medical";

export function generateMetadata({ params }: { params: { lang: string } }): Metadata {
  const copy = getFunnelCopy(getLang(params.lang));
  return { title: `${copy.list.title} · GB Medix AI`, description: copy.list.subtitle };
}

const SORTS: RoundtableSort[] = ["popular", "latest", "controversial", "needs_attention"];

export default function RoundtableListPage({
  params,
  searchParams
}: {
  params: { lang: string };
  searchParams: { query?: string; category?: string; sort?: string };
}) {
  const lang = getLang(params.lang);
  const copy = getFunnelCopy(lang);
  const locale = funnelLocale(lang);

  const query = typeof searchParams.query === "string" ? searchParams.query : "";
  const category = typeof searchParams.category === "string" ? searchParams.category : "all";
  const sort = (SORTS as string[]).includes(searchParams.sort ?? "") ? (searchParams.sort as RoundtableSort) : "popular";

  const all = listPublicRoundtables(locale, {});
  const categories = Array.from(new Set(all.map((c) => c.category)));
  const cards = listPublicRoundtables(locale, { query, category, sort });

  const buildHref = (patch: { category?: string; sort?: string }) => {
    const sp = new URLSearchParams();
    if (query) sp.set("query", query);
    const c = patch.category ?? category;
    const s = patch.sort ?? sort;
    if (c && c !== "all") sp.set("category", c);
    if (s && s !== "popular") sp.set("sort", s);
    const qs = sp.toString();
    return `/${lang}/roundtable${qs ? `?${qs}` : ""}`;
  };

  const sortLabel: Record<RoundtableSort, string> = {
    popular: copy.list.popular, latest: copy.list.latest, updated: copy.list.updated,
    controversial: copy.list.controversial, needs_attention: copy.list.needsAttention, all: copy.list.all
  };

  return (
    <PublicSiteLayout lang={lang}>
      <div className="py-10 sm:py-14">
        <Container>
          <SectionHeading eyebrow={copy.nav.roundtable} title={copy.list.title} subtitle={copy.list.subtitle} />
          <div className="mb-6"><MedicalDisclaimer copy={copy} /></div>

          {/* Category filter */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink/50">{copy.list.category}</span>
            <Link href={buildHref({ category: "all" })} aria-current={category === "all" ? "true" : undefined}
              className={`rounded-full border px-3 py-1 text-xs ${category === "all" ? "border-mint text-mint" : "border-ink/15 text-ink/70 hover:border-mint/50"}`}>{copy.list.all}</Link>
            {categories.map((c) => (
              <Link key={c} href={buildHref({ category: c })} aria-current={category === c ? "true" : undefined}
                className={`rounded-full border px-3 py-1 text-xs ${category === c ? "border-mint text-mint" : "border-ink/15 text-ink/70 hover:border-mint/50"}`}>{c}</Link>
            ))}
          </div>

          {/* Sort filter */}
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink/50">{copy.list.filters}</span>
            {SORTS.map((s) => (
              <Link key={s} href={buildHref({ sort: s })} aria-current={sort === s ? "true" : undefined}
                className={`rounded-full border px-3 py-1 text-xs ${sort === s ? "border-mint text-mint" : "border-ink/15 text-ink/70 hover:border-mint/50"}`}>{sortLabel[s]}</Link>
            ))}
          </div>

          {query ? <p className="mb-4 text-sm text-ink/60">“{query}” · {cards.length}</p> : null}

          {cards.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {cards.map((card) => <RoundtableCard key={card.id} lang={lang} copy={copy} card={card} />)}
            </div>
          ) : (
            <div className="rounded-2xl border border-ink/10 bg-mist/40 px-6 py-12 text-center">
              <p className="text-base font-semibold text-ink">{copy.list.noResults}</p>
              <p className="mt-2 text-sm text-ink/60">{copy.list.noResultsBody}</p>
              <div className="mt-5 flex justify-center gap-3">
                <ButtonLink href={`/${lang}/roundtable`} variant="secondary">{copy.list.all}</ButtonLink>
                <ButtonLink href={`/${lang}/consult`} variant="primary" onClickEventName="roundtable_to_consult_click">{copy.nav.startConsult}</ButtonLink>
              </div>
            </div>
          )}
        </Container>
      </div>
    </PublicSiteLayout>
  );
}
