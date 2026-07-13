import type { Metadata } from "next";
import { getLang } from "@/lib/lang";
import { getFunnelCopy } from "@/lib/public-funnel/i18n";
import { PublicSiteLayout } from "@/components/public/PublicSiteLayout";
import { Container, SectionHeading, Card, Badge, ButtonLink } from "@/components/public/ui";
import { MedicalDisclaimer } from "@/components/public/medical";

export function generateMetadata({ params }: { params: { lang: string } }): Metadata {
  const copy = getFunnelCopy(getLang(params.lang));
  return { title: `${copy.services.title} · GB Medix AI`, description: copy.home.servicesTitle };
}

export default function ServicesPage({ params }: { params: { lang: string } }) {
  const lang = getLang(params.lang);
  const copy = getFunnelCopy(lang);
  const zh = lang === "zh";

  const tiers = [
    { name: copy.services.basic, aiRole: zh ? "AI 预问诊整理" : "AI pre-consult", boundary: zh ? "非诊断" : "Not a diagnosis" },
    { name: copy.services.deep, aiRole: zh ? "结构化健康报告" : "Structured report", boundary: zh ? "非诊断" : "Not a diagnosis" },
    { name: copy.services.human, aiRole: zh ? "专业人工复核（预留）" : "Human review (reserved)", boundary: zh ? "以专业意见为准" : "Professional opinion prevails" }
  ];

  return (
    <PublicSiteLayout lang={lang}>
      <div className="py-10 sm:py-14">
        <Container>
          <SectionHeading eyebrow={copy.nav.services} title={copy.services.title} subtitle={copy.home.servicesTitle} />
          <div className="mb-6"><MedicalDisclaimer copy={copy} /></div>
          <div className="grid gap-5 sm:grid-cols-3">
            {tiers.map((t) => (
              <Card key={t.name} className="flex h-full flex-col p-5">
                <h2 className="text-base font-semibold text-ink">{t.name}</h2>
                <dl className="mt-3 grid gap-2 text-xs text-ink/70">
                  <div><dt className="inline font-semibold">{copy.services.aiRole}: </dt><dd className="inline">{t.aiRole}</dd></div>
                  <div><dt className="inline font-semibold">{copy.services.boundary}: </dt><dd className="inline">{t.boundary}</dd></div>
                </dl>
                <div className="mt-3"><Badge tone="neutral">{copy.services.priceTbd}</Badge></div>
                <div className="mt-auto pt-4">
                  <ButtonLink href={`/${lang}/consult`} variant="secondary" className="w-full text-xs" onClickEventName="service_to_consult_click">{copy.services.next}</ButtonLink>
                </div>
              </Card>
            ))}
          </div>
        </Container>
      </div>
    </PublicSiteLayout>
  );
}
