import type { Metadata } from "next";
import { getLang } from "@/lib/lang";
import { getFunnelCopy, funnelLocale } from "@/lib/public-funnel/i18n";
import { listPublicRoundtables } from "@/lib/public-funnel/repository";
import { PublicSiteLayout } from "@/components/public/PublicSiteLayout";
import { Container, SectionHeading, Card, Badge, ButtonLink } from "@/components/public/ui";
import { RoundtableCard } from "@/components/public/roundtable";
import { MedicalDisclaimer } from "@/components/public/medical";

export function generateMetadata({ params }: { params: { lang: string } }): Metadata {
  const copy = getFunnelCopy(getLang(params.lang));
  return { title: `${copy.knowledge.title} · GB Medix AI`, description: copy.knowledge.subtitle };
}

export default function KnowledgePage({ params }: { params: { lang: string } }) {
  const lang = getLang(params.lang);
  const copy = getFunnelCopy(lang);
  const related = listPublicRoundtables(funnelLocale(lang), { sort: "popular" }).slice(0, 3);

  return (
    <PublicSiteLayout lang={lang}>
      <div className="py-10 sm:py-14">
        <Container>
          <SectionHeading eyebrow={copy.nav.knowledge} title={copy.knowledge.title} subtitle={copy.knowledge.subtitle} />
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-ink">{copy.knowledge.vsRoundtable.split(":")[0] || copy.nav.knowledge}</h2>
            <p className="mt-2 text-sm text-ink/75">{copy.knowledge.vsRoundtable}</p>
          </Card>

          <div className="mt-6"><Badge tone="info">{copy.common.unavailable}</Badge></div>
          <div className="mt-2"><MedicalDisclaimer copy={copy} /></div>

          <div className="mt-8">
            <SectionHeading title={copy.knowledge.relatedRoundtables} />
            {related.length > 0 ? (
              <div className="grid gap-5 sm:grid-cols-3">
                {related.map((card) => <RoundtableCard key={card.id} lang={lang} copy={copy} card={card} />)}
              </div>
            ) : <p className="text-sm text-ink/60">{copy.common.empty}</p>}
            <div className="mt-6"><ButtonLink href={`/${lang}/roundtable`} variant="ghost">{copy.nav.roundtable} →</ButtonLink></div>
          </div>
        </Container>
      </div>
    </PublicSiteLayout>
  );
}
