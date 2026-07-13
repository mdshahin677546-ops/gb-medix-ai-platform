import type { FunnelCopy } from "@/lib/public-funnel/i18n";
import { publicStatusPresentation } from "@/lib/public-funnel/gate";
import type { RoundtablePublicationStatus, EvidenceLevel, EvidenceStatus, RiskTier, RiskSignal, ActionRecommendation, ActionTier } from "@/lib/public-funnel/types";
import { Badge } from "./ui";

export function MedicalDisclaimer({ copy, full = false }: { copy: FunnelCopy; full?: boolean }) {
  return (
    <p role="note" className="rounded-xl border border-ink/15 bg-mist/60 px-4 py-3 text-xs leading-relaxed text-ink/70">
      <span className="font-semibold text-ink/80">ⓘ </span>
      {full ? copy.disclaimer.full : copy.disclaimer.short}
    </p>
  );
}

export function ReviewStatusBadge({ status, copy }: { status: RoundtablePublicationStatus; copy: FunnelCopy }) {
  const pres = publicStatusPresentation(status);
  const label =
    pres.labelKey === "status.reviewed" ? copy.status.reviewed :
    pres.labelKey === "status.updateRequired" ? copy.status.updateRequired :
    pres.labelKey === "status.archived" ? copy.status.archived : copy.status.unavailable;
  return <Badge tone={pres.tone} icon={<span aria-hidden="true">✓</span>}>{label}</Badge>;
}

export function VersionBadge({ version, copy }: { version: number; copy: FunnelCopy }) {
  return <Badge tone="neutral">{copy.card.version}{version}</Badge>;
}

const evidenceLevelTone: Record<EvidenceLevel, "success" | "attention" | "critical" | "neutral"> = {
  high: "success", moderate: "attention", low: "critical", unrated: "neutral"
};
export function EvidenceLevelBadge({ level }: { level: EvidenceLevel }) {
  return <Badge tone={evidenceLevelTone[level]}>{level}</Badge>;
}

const evidenceStatusLabel: Record<EvidenceStatus, string> = {
  supported: "supported", supported_with_limitations: "supported*", conflicting_evidence: "conflicting", insufficient_evidence: "insufficient", expert_opinion_only: "expert opinion", rejected: "rejected"
};
export function EvidenceStatusBadge({ status }: { status: EvidenceStatus }) {
  const tone = status === "supported" ? "success" : status === "rejected" ? "critical" : "attention";
  return <Badge tone={tone}>{evidenceStatusLabel[status]}</Badge>;
}

export function PerspectiveBadge({ label }: { label: string }) {
  return <Badge tone="info">{label}</Badge>;
}

const riskTone: Record<RiskTier, "neutral" | "info" | "attention" | "critical"> = {
  routine: "neutral", info: "info", attention: "attention", urgent: "critical"
};
const riskIcon: Record<RiskTier, string> = { routine: "•", info: "ℹ", attention: "▲", urgent: "⚠" };
export function RiskTierBadge({ tier, copy }: { tier: RiskTier; copy: FunnelCopy }) {
  const label = tier === "urgent" ? copy.risk.urgent : tier === "attention" ? copy.risk.attention : tier === "info" ? copy.risk.info : copy.risk.routine;
  return <Badge tone={riskTone[tier]} icon={<span aria-hidden="true">{riskIcon[tier]}</span>}>{label}</Badge>;
}

/** High-visibility danger-signals panel. Communicates via text + icon + color + status label. */
export function RiskSignalPanel({ signals, copy }: { signals: RiskSignal[]; copy: FunnelCopy }) {
  if (signals.length === 0) return null;
  const hasUrgent = signals.some((s) => s.tier === "urgent");
  return (
    <div role="alert" className={`rounded-2xl border-2 p-5 ${hasUrgent ? "border-clay/60 bg-clay/10" : "border-amber/50 bg-amber/10"}`}>
      <div className="mb-3 flex items-center gap-2">
        <span aria-hidden="true" className={`text-lg ${hasUrgent ? "text-clay" : "text-amber"}`}>⚠</span>
        <h3 className="text-sm font-semibold text-ink">{copy.risk.heading}</h3>
      </div>
      <ul className="space-y-2">
        {signals.map((s, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-ink/85">
            <span className="mt-0.5"><RiskTierBadge tier={s.tier} copy={copy} /></span>
            <span>{s.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const actionTone: Record<ActionTier, "neutral" | "info" | "attention" | "critical"> = {
  self_monitor: "neutral", continue_consult: "info", book_professional: "attention", seek_care_soon: "critical"
};
export function ActionRecommendationList({ items, copy }: { items: ActionRecommendation[]; copy: FunnelCopy }) {
  if (items.length === 0) return null;
  const label = (t: ActionTier) => copy.action[t];
  return (
    <ul className="space-y-2">
      {items.map((a, i) => (
        <li key={i} className="flex items-start gap-3 rounded-xl border border-ink/10 bg-mist/40 px-4 py-3 text-sm text-ink/85">
          <span className="shrink-0"><Badge tone={actionTone[a.tier]}>{label(a.tier)}</Badge></span>
          <span>{a.text}</span>
        </li>
      ))}
    </ul>
  );
}
