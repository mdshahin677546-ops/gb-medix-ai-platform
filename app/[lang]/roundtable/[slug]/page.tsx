import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLang } from "@/lib/lang";
import { getFunnelCopy, funnelLocale } from "@/lib/public-funnel/i18n";
import { getPublicRoundtable } from "@/lib/public-funnel/repository";
import { publicStatusPresentation } from "@/lib/public-funnel/gate";
import { PublicSiteLayout } from "@/components/public/PublicSiteLayout";
import { Container, Card, Badge, ButtonLink } from "@/components/public/ui";
import { DetailToc } from "@/components/public/DetailToc";
import {
  ReviewStatusBadge, VersionBadge, PerspectiveBadge, RiskSignalPanel, ActionRecommendationList, MedicalDisclaimer
} from "@/components/public/medical";
import { ConsensusList, DisagreementPanel, ClaimEvidenceCard, ConsultationCTA } from "@/components/public/roundtable";

export function generateMetadata({ params }: { params: { lang: string; slug: string } }): Metadata {
  const locale = funnelLocale(getLang(params.lang));
  const rt = getPublicRoundtable(locale, params.slug);
  if (!rt) return { title: "GB Medix AI", robots: { index: false } };
  const copy = getFunnelCopy(getLang(params.lang));
  return {
    title: `${rt.title} · ${copy.nav.roundtable}`,
    description: rt.oneMinute.conclusion.slice(0, 150),
    // Caveated (update_required/archived) content is public but should not be indexed.
    robots: publicStatusPresentation(rt.reviewStatus).showCaveat ? { index: false } : undefined
  };
}

export default function RoundtableDetailPage({ params }: { params: { lang: string; slug: string } }) {
  const lang = getLang(params.lang);
  const copy = getFunnelCopy(lang);
  const locale = funnelLocale(lang);
  const rt = getPublicRoundtable(locale, params.slug);
  if (!rt) notFound();

  const pres = publicStatusPresentation(rt.reviewStatus);
  const caveatText = rt.reviewStatus === "archived" ? copy.status.caveatArchived : copy.status.caveatUpdate;

  const toc = [
    { id: "one-minute", title: copy.detail.oneMinute },
    { id: "background", title: copy.detail.background },
    { id: "perspectives", title: copy.detail.perspectives },
    { id: "consensus", title: copy.detail.consensus },
    { id: "disagreements", title: copy.detail.disagreements },
    { id: "claims", title: copy.detail.claims },
    { id: "risk", title: copy.detail.risk },
    { id: "actions", title: copy.detail.actions },
    { id: "version", title: copy.detail.versionRecord },
    { id: "related", title: copy.detail.related }
  ];

  return (
    <PublicSiteLayout lang={lang}>
      <div className="py-8 sm:py-10">
        <Container>
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="mb-4 text-xs text-ink/50">
            <Link href={`/${lang}`} className="hover:text-mint">GB Medix AI</Link>
            <span className="mx-2">/</span>
            <Link href={`/${lang}/roundtable`} className="hover:text-mint">{copy.nav.roundtable}</Link>
          </nav>

          {/* Header */}
          <header>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral">{rt.category}</Badge>
              <ReviewStatusBadge status={rt.reviewStatus} copy={copy} />
              <VersionBadge version={rt.version} copy={copy} />
              {rt.isDemo ? <Badge tone="info">{copy.common.demoBadge}</Badge> : null}
            </div>
            <h1 className="mt-3 text-2xl font-semibold text-ink sm:text-3xl">{rt.title}</h1>
            <p className="mt-2 text-sm text-ink/70">{rt.coreQuestion}</p>
            <p className="mt-2 text-xs text-ink/50">{copy.card.updated} {rt.updatedAt}</p>
          </header>

          {/* Caveat for update_required / archived */}
          {pres.showCaveat ? (
            <div role="status" className="mt-4 rounded-xl border-2 border-amber/50 bg-amber/10 px-4 py-3 text-sm text-amber">
              <span aria-hidden="true">▲ </span>{caveatText}
            </div>
          ) : null}

          <div className="mt-4"><MedicalDisclaimer copy={copy} /></div>

          <div className="mt-8 grid gap-8 lg:grid-cols-[220px_1fr]">
            <aside><DetailToc label={copy.detail.toc} items={toc} /></aside>

            <div className="min-w-0 space-y-10">
              {/* One-minute summary */}
              <section id="one-minute" className="scroll-mt-24">
                <Card className="p-5">
                  <h2 className="text-lg font-semibold text-ink">{copy.detail.oneMinute}</h2>
                  <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div><dt className="text-xs font-semibold text-ink/50">{copy.detail.conclusion}</dt><dd className="mt-1 text-sm text-ink/85">{rt.oneMinute.conclusion}</dd></div>
                    <div><dt className="text-xs font-semibold text-ink/50">{copy.detail.keyLimitation}</dt><dd className="mt-1 text-sm text-ink/85">{rt.oneMinute.keyLimitation}</dd></div>
                    <div><dt className="text-xs font-semibold text-ink/50">{copy.detail.topRisk}</dt><dd className="mt-1 text-sm text-ink/85">{rt.oneMinute.topRiskSignal}</dd></div>
                    <div><dt className="text-xs font-semibold text-ink/50">{copy.detail.nextStep}</dt><dd className="mt-1 text-sm text-ink/85">{rt.oneMinute.nextStep}</dd></div>
                  </dl>
                </Card>
              </section>

              {/* Background */}
              <section id="background" className="scroll-mt-24">
                <h2 className="text-lg font-semibold text-ink">{copy.detail.background}</h2>
                <p className="mt-3 text-sm leading-relaxed text-ink/80">{rt.background}</p>
              </section>

              {/* Perspectives */}
              <section id="perspectives" className="scroll-mt-24">
                <h2 className="text-lg font-semibold text-ink">{copy.detail.perspectives}</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {rt.perspectives.map((p) => <PerspectiveBadge key={p.key} label={p.label} />)}
                </div>
              </section>

              {/* Consensus (structured, not merged prose) */}
              <section id="consensus" className="scroll-mt-24">
                <h2 className="text-lg font-semibold text-ink">{copy.detail.consensus}</h2>
                <div className="mt-3"><ConsensusList items={rt.consensusItems} copy={copy} /></div>
              </section>

              {/* Disagreements (structured, not merged prose) */}
              <section id="disagreements" className="scroll-mt-24">
                <h2 className="text-lg font-semibold text-ink">{copy.detail.disagreements}</h2>
                <div className="mt-3"><DisagreementPanel items={rt.disagreements} copy={copy} /></div>
              </section>

              {/* Mid-body consult CTA (exactly one) */}
              <div className="rounded-2xl border border-mint/25 bg-mint/5 px-5 py-4">
                <ConsultationCTA lang={lang} copy={copy} variant="secondary" label={copy.detail.ctaMid} topic={rt.category} />
              </div>

              {/* Claims & evidence (collapsible) */}
              <section id="claims" className="scroll-mt-24">
                <h2 className="text-lg font-semibold text-ink">{copy.detail.claims}</h2>
                <div className="mt-3 space-y-3">
                  {rt.claims.map((c, i) => <ClaimEvidenceCard key={i} claim={c} copy={copy} />)}
                </div>
              </section>

              {/* Danger signals — high visibility, NO product CTA here */}
              <section id="risk" className="scroll-mt-24">
                <RiskSignalPanel signals={rt.riskSignals} copy={copy} />
              </section>

              {/* Actions */}
              <section id="actions" className="scroll-mt-24">
                <h2 className="text-lg font-semibold text-ink">{copy.detail.actions}</h2>
                <div className="mt-3"><ActionRecommendationList items={rt.actionRecommendations} copy={copy} /></div>
              </section>

              {/* Version & review record */}
              <section id="version" className="scroll-mt-24">
                <h2 className="text-lg font-semibold text-ink">{copy.detail.versionRecord}</h2>
                <Card className="mt-3 p-4">
                  <dl className="grid gap-2 text-sm text-ink/75 sm:grid-cols-3">
                    <div><dt className="text-xs text-ink/50">{copy.card.version.trim()}</dt><dd>v{rt.version}</dd></div>
                    <div><dt className="text-xs text-ink/50">{copy.status.reviewed}</dt><dd>{copy.status[rt.reviewStatus === "approved" || rt.reviewStatus === "published" ? "reviewed" : rt.reviewStatus === "archived" ? "archived" : "updateRequired"]}</dd></div>
                    <div><dt className="text-xs text-ink/50">{copy.card.updated}</dt><dd>{rt.updatedAt}</dd></div>
                  </dl>
                  <p className="mt-3 text-xs text-ink/50">{copy.disclaimer.reviewNote}</p>
                </Card>
              </section>

              {/* Related roundtables */}
              {rt.relatedRoundtables.length > 0 ? (
                <section id="related" className="scroll-mt-24">
                  <h2 className="text-lg font-semibold text-ink">{copy.detail.related}</h2>
                  <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                    {rt.relatedRoundtables.map((r) => (
                      <li key={r.slug}><Link href={`/${lang}/roundtable/${r.slug}`} className="block rounded-xl border border-ink/10 px-4 py-3 text-sm text-ink/80 hover:border-mint/50 hover:text-mint">{r.title}</Link></li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {/* Related services (BEFORE products) */}
              <section className="scroll-mt-24">
                <h2 className="text-lg font-semibold text-ink">{copy.detail.relatedServices}</h2>
                <Card className="mt-3 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-ink/75">{copy.services.title}</p>
                  <ButtonLink href={`/${lang}/services`} variant="secondary" className="text-xs">{copy.services.next} →</ButtonLink>
                </Card>
              </section>

              {/* Optional products (AFTER services) */}
              <section className="scroll-mt-24">
                <h2 className="text-lg font-semibold text-ink">{copy.detail.relatedProducts}</h2>
                <p className="mt-1 text-xs text-ink/50">{copy.products.disclaimer}</p>
                <Card className="mt-3 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-ink/70">{copy.products.note}</p>
                  <ButtonLink href={`/${lang}/products`} variant="ghost" className="text-xs">{copy.products.viewDetails} →</ButtonLink>
                </Card>
              </section>

              {/* End-of-body consult CTA (exactly one) */}
              <div className="rounded-2xl border border-mint/30 bg-gradient-to-r from-mint/10 to-transparent px-6 py-6 text-center">
                <p className="text-base font-semibold text-ink">{copy.detail.nextStep}</p>
                <div className="mt-4 flex justify-center">
                  <ConsultationCTA lang={lang} copy={copy} variant="primary" label={copy.detail.ctaEnd} topic={rt.category} />
                </div>
              </div>
            </div>
          </div>
        </Container>
      </div>
    </PublicSiteLayout>
  );
}
