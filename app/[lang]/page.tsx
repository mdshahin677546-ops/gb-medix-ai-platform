import type { Metadata } from "next";
import Link from "next/link";
import { getLang } from "@/lib/lang";
import { getFunnelCopy, funnelLocale } from "@/lib/public-funnel/i18n";
import { listFeaturedRoundtables } from "@/lib/public-funnel/repository";
import { PublicSiteLayout } from "@/components/public/PublicSiteLayout";
import { Section, SectionHeading, ButtonLink, Card } from "@/components/public/ui";
import { RoundtableCard } from "@/components/public/roundtable";
import { MedicalDisclaimer } from "@/components/public/medical";

export function generateMetadata({ params }: { params: { lang: string } }): Metadata {
  const copy = getFunnelCopy(getLang(params.lang));
  return { title: `${copy.nav.roundtable} · GB Medix AI`, description: copy.hero.body.slice(0, 150) };
}

export default function HomePage({ params }: { params: { lang: string } }) {
  const lang = getLang(params.lang);
  const copy = getFunnelCopy(lang);
  const locale = funnelLocale(lang);
  const featured = listFeaturedRoundtables(locale, 4);

  return (
    <PublicSiteLayout lang={lang}>
      {/* 1 — Medical Roundtable hero (first visual) */}
      <section className="relative overflow-hidden border-b border-ink/10">
        <div className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-mint/80">{copy.nav.roundtable}</p>
          <h1 className="max-w-3xl text-3xl font-semibold leading-tight text-ink sm:text-4xl lg:text-5xl">{copy.hero.title}</h1>
          <p className="mt-5 max-w-2xl text-base text-ink/75 sm:text-lg">{copy.hero.body}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href={`/${lang}/roundtable`} variant="secondary">{copy.hero.primaryCta}</ButtonLink>
            <ButtonLink href={`/${lang}/consult`} variant="primary" onClickEventName="roundtable_to_consult_click">{copy.hero.secondaryCta}</ButtonLink>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
            {copy.hero.trust.map((t) => (
              <li key={t} className="flex items-center gap-2 text-sm text-ink/60"><span aria-hidden="true" className="text-leaf">✓</span>{t}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* 2 — Featured & popular roundtables (first content section) */}
      <Section id="featured">
        <SectionHeading title={copy.home.featuredTitle} subtitle={copy.home.featuredSubtitle} />
        {featured.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2">
            {featured.map((card) => <RoundtableCard key={card.id} lang={lang} copy={copy} card={card} featured />)}
          </div>
        ) : (
          <p className="text-sm text-ink/60">{copy.common.empty}</p>
        )}
        <div className="mt-6"><ButtonLink href={`/${lang}/roundtable`} variant="ghost">{copy.card.viewRoundtable} →</ButtonLink></div>
      </Section>

      {/* 3 — How the roundtable works */}
      <Section id="how" className="border-t border-ink/10">
        <SectionHeading title={copy.home.howTitle} />
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {copy.home.howSteps.map((step, i) => (
            <li key={i}><Card className="h-full p-4"><span className="text-xs font-semibold text-mint">{String(i + 1).padStart(2, "0")}</span><p className="mt-1 text-sm text-ink/85">{step}</p></Card></li>
          ))}
        </ol>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <span className="rounded-lg border border-amber/40 bg-amber/10 px-3 py-2 text-amber">▲ {copy.home.howNoteA}</span>
          <span className="rounded-lg border border-amber/40 bg-amber/10 px-3 py-2 text-amber">▲ {copy.home.howNoteB}</span>
        </div>
      </Section>

      {/* 4 — Roundtable → personal consultation funnel */}
      <Section id="funnel" className="border-t border-ink/10">
        <SectionHeading title={copy.home.funnelTitle} />
        <ol className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {copy.home.funnelSteps.map((step, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-ink/80">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-mint/40 text-xs text-mint">{i + 1}</span>
              <span>{step}</span>
              {i < copy.home.funnelSteps.length - 1 ? <span aria-hidden="true" className="hidden text-ink/30 sm:inline">→</span> : null}
            </li>
          ))}
        </ol>
        <div className="mt-6"><ButtonLink href={`/${lang}/consult`} variant="primary" onClickEventName="roundtable_to_consult_click">{copy.nav.startConsult}</ButtonLink></div>
      </Section>

      {/* 5 — Health consultation services */}
      <Section id="services" className="border-t border-ink/10">
        <SectionHeading title={copy.home.servicesTitle} />
        <Card className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-sm text-ink/75">{copy.consult.title} · {copy.services.title}</p>
          <ButtonLink href={`/${lang}/services`} variant="secondary">{copy.services.next} →</ButtonLink>
        </Card>
      </Section>

      {/* 6 — Medical knowledge */}
      <Section id="knowledge" className="border-t border-ink/10">
        <SectionHeading title={copy.home.knowledgeTitle} />
        <Card className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-sm text-ink/75">{copy.knowledge.subtitle}</p>
          <ButtonLink href={`/${lang}/knowledge`} variant="ghost">{copy.knowledge.topics} →</ButtonLink>
        </Card>
      </Section>

      {/* 7 — Optional health products (AFTER services) */}
      <Section id="products" className="border-t border-ink/10">
        <SectionHeading title={copy.home.productsTitle} subtitle={copy.home.productsNote} />
        <Card className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-sm text-ink/70">{copy.products.note}</p>
          <ButtonLink href={`/${lang}/products`} variant="ghost">{copy.products.viewDetails} →</ButtonLink>
        </Card>
      </Section>

      {/* 8 — Trust, privacy & disclaimer */}
      <Section id="trust" className="border-t border-ink/10">
        <SectionHeading title={copy.home.trustTitle} />
        <MedicalDisclaimer copy={copy} full />
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <Link href={`/${lang}/third-party-ai-privacy`} className="text-ink/70 hover:text-mint">{copy.footer.privacy}</Link>
        </div>
      </Section>
    </PublicSiteLayout>
  );
}
