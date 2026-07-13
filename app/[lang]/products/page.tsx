import type { Metadata } from "next";
import { getLang } from "@/lib/lang";
import { getFunnelCopy } from "@/lib/public-funnel/i18n";
import { PublicSiteLayout } from "@/components/public/PublicSiteLayout";
import { Container, SectionHeading, Card, Badge, ButtonLink } from "@/components/public/ui";
import { MedicalDisclaimer } from "@/components/public/medical";

export function generateMetadata({ params }: { params: { lang: string } }): Metadata {
  const copy = getFunnelCopy(getLang(params.lang));
  return { title: `${copy.products.title} · GB Medix AI`, description: copy.products.note };
}

export default function ProductsPage({ params }: { params: { lang: string } }) {
  const lang = getLang(params.lang);
  const copy = getFunnelCopy(lang);
  const zh = lang === "zh";

  // Discovery only. No fabricated price/stock/qualification/medical effect.
  const topics = zh
    ? ["睡眠与情绪支持", "血压日常记录", "营养与康复辅助"]
    : ["Sleep & mood support", "Blood-pressure tracking", "Nutrition & rehab support"];

  return (
    <PublicSiteLayout lang={lang}>
      <div className="py-10 sm:py-14">
        <Container>
          <SectionHeading eyebrow={copy.nav.products} title={copy.products.title} subtitle={copy.products.note} />
          <div className="mb-6 rounded-xl border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-amber">
            <span aria-hidden="true">ⓘ </span>{copy.products.disclaimer}
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            {topics.map((t) => (
              <Card key={t} className="flex h-full flex-col p-5">
                <h2 className="text-base font-semibold text-ink">{t}</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge tone="neutral">{copy.products.priceTbd}</Badge>
                  <Badge tone="neutral">{copy.products.stockTbd}</Badge>
                </div>
                <p className="mt-3 text-xs text-ink/60">{copy.products.needsGuidance}</p>
                <div className="mt-auto pt-4">
                  <ButtonLink href={`/${lang}/shop`} variant="secondary" className="w-full text-xs" onClickEventName="roundtable_related_product_click">{copy.products.viewDetails}</ButtonLink>
                </div>
              </Card>
            ))}
          </div>

          <div className="mt-6"><MedicalDisclaimer copy={copy} /></div>
        </Container>
      </div>
    </PublicSiteLayout>
  );
}
