import type { Lang } from "@/lib/lang";
import type { FunnelCopy } from "@/lib/public-funnel/i18n";
import type { RoundtableCardModel, ConsensusItem, Disagreement, ClaimEvidence } from "@/lib/public-funnel/types";
import { Card, Badge, ButtonLink, DemoBadge } from "./ui";
import { ReviewStatusBadge, VersionBadge, EvidenceStatusBadge, EvidenceLevelBadge, PerspectiveBadge, RiskTierBadge } from "./medical";

export function ConsultationCTA({ lang, copy, variant = "primary", label, source }: { lang: Lang; copy: FunnelCopy; variant?: "primary" | "secondary"; label?: string; source?: "roundtable" | "service" }) {
  return (
    <ButtonLink href={`/${lang}/consult`} variant={variant} onClickEventName={source === "service" ? "service_to_consult_click" : "roundtable_to_consult_click"}>
      {label ?? copy.detail.ctaEnd}
    </ButtonLink>
  );
}

export function ConsensusList({ items, copy }: { items: ConsensusItem[]; copy: FunnelCopy }) {
  if (items.length === 0) return <p className="text-sm text-ink/60">{copy.common.empty}</p>;
  return (
    <ul className="space-y-3">
      {items.map((c, i) => (
        <li key={i}>
          <Card className="p-4">
            <p className="text-sm font-medium text-ink">{c.claim}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone={c.support === "strong" ? "success" : c.support === "moderate" ? "attention" : "neutral"}>{c.support}</Badge>
              <EvidenceStatusBadge status={c.evidenceStatus} />
            </div>
            <dl className="mt-2 grid gap-1 text-xs text-ink/70">
              <div><dt className="inline font-semibold">{copy.detail.scope}: </dt><dd className="inline">{c.scope}</dd></div>
              <div><dt className="inline font-semibold">{copy.detail.limitation}: </dt><dd className="inline">{c.limitation}</dd></div>
            </dl>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export function DisagreementPanel({ items, copy }: { items: Disagreement[]; copy: FunnelCopy }) {
  if (items.length === 0) return <p className="text-sm text-ink/60">{copy.common.empty}</p>;
  return (
    <ul className="space-y-3">
      {items.map((d, i) => (
        <li key={i}>
          <Card className="p-4">
            <p className="text-sm font-semibold text-ink">{d.question}</p>
            <ul className="mt-2 space-y-1 text-xs text-ink/75">
              {d.positions.map((p, j) => (
                <li key={j}><span className="font-semibold text-mint">{p.perspective}: </span>{p.view}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-ink/60">{d.reason}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge tone={d.evidenceSufficient ? "success" : "attention"}>{d.evidenceSufficient ? "evidence sufficient" : "evidence limited"}</Badge>
              {d.needsClinician ? <Badge tone="attention">needs clinician</Badge> : null}
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export function ClaimEvidenceCard({ claim, copy }: { claim: ClaimEvidence; copy: FunnelCopy }) {
  return (
    <details className="glass-panel group rounded-2xl p-4">
      <summary className="flex cursor-pointer list-none flex-col gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-mint">
        <span className="flex items-start justify-between gap-2 text-sm font-medium text-ink">
          <span>{claim.claim}</span>
          <span aria-hidden="true" className="mt-0.5 shrink-0 text-ink/40 transition group-open:rotate-180">▾</span>
        </span>
        <span className="flex flex-wrap items-center gap-2">
          <EvidenceStatusBadge status={claim.evidenceStatus} />
          <EvidenceLevelBadge level={claim.evidenceLevel} />
        </span>
      </summary>
      <dl className="mt-3 grid gap-1 text-xs text-ink/70">
        <div><dt className="inline font-semibold">{copy.detail.source}: </dt><dd className="inline">{claim.sourceTitle} · {claim.sourceType}{claim.year ? ` · ${claim.year}` : ""}</dd></div>
        <div><dt className="inline font-semibold">{copy.detail.scope}: </dt><dd className="inline">{claim.scope}</dd></div>
        <div><dt className="inline font-semibold">{copy.detail.limitation}: </dt><dd className="inline">{claim.limitation}</dd></div>
      </dl>
      {(claim.supportingPerspectives.length > 0 || claim.challengingPerspectives.length > 0) ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {claim.supportingPerspectives.map((p) => <PerspectiveBadge key={`s-${p}`} label={`${copy.detail.supportedBy}: ${p}`} />)}
          {claim.challengingPerspectives.map((p) => <Badge key={`c-${p}`} tone="attention">{copy.detail.challengedBy}: {p}</Badge>)}
        </div>
      ) : null}
    </details>
  );
}

export function RoundtableCard({ lang, copy, card, featured = false }: { lang: Lang; copy: FunnelCopy; card: RoundtableCardModel; featured?: boolean }) {
  return (
    <article className={`glass-panel flex h-full flex-col rounded-2xl p-5 ${featured ? "border border-mint/30" : ""}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge tone="neutral">{card.category}</Badge>
        <ReviewStatusBadge status={card.reviewStatus} copy={copy} />
        <VersionBadge version={card.version} copy={copy} />
        {card.isDemo ? <DemoBadge label={copy.common.demoBadge} /> : null}
      </div>
      <h3 className={`font-semibold text-ink ${featured ? "text-xl" : "text-base"}`}>
        <a href={`/${lang}/roundtable/${card.slug}`} data-event="roundtable_card_open" className="hover:text-mint focus:outline-none focus-visible:underline">{card.title}</a>
      </h3>
      <p className="mt-1 text-sm text-ink/70">{card.coreQuestion}</p>
      <p className="mt-2 line-clamp-3 text-sm text-ink/60">{card.consensusSummary}</p>
      <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/60">
        <div><dt className="inline">{card.disagreementCount} </dt><dd className="inline">{copy.card.disagreements}</dd></div>
        <div><dt className="inline">{card.perspectiveCount} </dt><dd className="inline">{copy.card.perspectives}</dd></div>
        <div><dt className="inline">{card.evidenceCount} </dt><dd className="inline">{copy.card.evidence}</dd></div>
        <div><dt className="inline">{card.readingTimeMinutes} </dt><dd className="inline">{copy.card.readingTime}</dd></div>
      </dl>
      <div className="mt-2"><RiskTierBadge tier={card.topRiskTier} copy={copy} /></div>
      <div className="mt-4 flex flex-wrap gap-2">
        <ButtonLink href={`/${lang}/roundtable/${card.slug}`} variant="secondary" className="px-4 py-2 text-xs">{copy.card.viewRoundtable}</ButtonLink>
        <ButtonLink href={`/${lang}/consult`} variant="ghost" className="px-4 py-2 text-xs" onClickEventName="roundtable_to_consult_click">{copy.card.startConsult}</ButtonLink>
      </div>
    </article>
  );
}
