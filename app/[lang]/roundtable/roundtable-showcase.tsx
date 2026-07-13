"use client";

// GB MEDIX AI Medical Roundtable — SHOWCASE 1.0 read-only experience.
//
// Local-only interactions (useState): filter mock cases, expand a state note,
// switch a role. No form, no free-text input, no fetch, no Server Action, no
// database write, no provider/network call, no persistence. All content comes
// from the static ./showcase-data view-model. This component never runs the
// real roundtable and never renders a real medical conclusion.

import { useState } from "react";
import {
  getShowcaseData,
  type GateVerdict,
  type ShowcaseLang,
  type StageKind,
} from "./showcase-data";

const KIND_STYLES: Record<StageKind, string> = {
  completed: "border-leaf/40 bg-leaf/10 text-mint",
  current: "border-mint/60 bg-mint/15 text-mint",
  awaiting_review: "border-amber/50 bg-amber/10 text-amber",
  blocked: "border-clay/50 bg-clay/10 text-clay",
  planned: "border-white/15 bg-white/5 text-ink/70",
};

function DemoBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-amber/40 bg-amber/10 px-3 py-1 text-xs font-semibold text-amber">
      {label}
    </span>
  );
}

function DisclaimerNote({ text }: { text: string }) {
  return (
    <p className="rounded-md border border-clay/30 bg-clay/5 px-4 py-3 text-xs leading-relaxed text-ink/75">
      {text}
    </p>
  );
}

function SectionHeading({ title, note, disclaimer, demoBadge }: { title: string; note: string; disclaimer: string; demoBadge: string }) {
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold text-ink sm:text-2xl">{title}</h2>
        <DemoBadge label={demoBadge} />
      </div>
      <p className="text-sm text-ink/70">{note}</p>
      <DisclaimerNote text={disclaimer} />
    </div>
  );
}

export function RoundtableShowcase({ lang }: { lang: ShowcaseLang }) {
  const data = getShowcaseData(lang);
  const { chrome, gate, stateMachine, consensus } = data;

  const [gateFilter, setGateFilter] = useState<"all" | GateVerdict>("all");
  const [openStage, setOpenStage] = useState<string>(
    stateMachine.stages.find((s) => s.kind === "current")?.id ?? stateMachine.stages[0].id
  );
  const [openRole, setOpenRole] = useState<string>(consensus.roles[0].id);

  const gateExamples = gate.examples.filter((e) => gateFilter === "all" || e.verdict === gateFilter);
  const activeRole = consensus.roles.find((r) => r.id === openRole) ?? consensus.roles[0];

  const filterLabels: Record<"all" | GateVerdict, string> =
    lang === "zh"
      ? { all: "全部", allowed: gate.allowedHeading, blocked: gate.blockedHeading }
      : { all: "All", allowed: gate.allowedHeading, blocked: gate.blockedHeading };

  return (
    <div className="grid gap-10">
      <header className="grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.2em] text-mint/80">{chrome.eyebrow}</p>
          <DemoBadge label={chrome.demoBadge} />
        </div>
        <h1 className="font-display text-2xl font-semibold text-ink sm:text-3xl">{chrome.title}</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-ink/75 sm:text-base">{chrome.intro}</p>
        <DisclaimerNote text={chrome.disclaimer} />
      </header>

      <section className="grid gap-5">
        <SectionHeading title={gate.heading} note={gate.note} disclaimer={chrome.disclaimer} demoBadge={chrome.demoBadge} />
        <div className="flex flex-wrap gap-2">
          {(["all", "allowed", "blocked"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setGateFilter(key)}
              aria-pressed={gateFilter === key}
              className={`rounded-full border px-4 py-1.5 text-sm transition ${
                gateFilter === key ? "border-mint/60 bg-mint/15 text-mint" : "border-white/15 bg-white/5 text-ink/70"
              }`}
            >
              {filterLabels[key]}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-ink/50">
                <th className="border-b border-white/10 px-3 py-2 font-medium">{gate.columns.topic}</th>
                <th className="border-b border-white/10 px-3 py-2 font-medium">{gate.columns.category}</th>
                <th className="border-b border-white/10 px-3 py-2 font-medium">{gate.columns.result}</th>
                <th className="border-b border-white/10 px-3 py-2 font-medium">{gate.columns.reason}</th>
                <th className="border-b border-white/10 px-3 py-2 font-medium">{gate.columns.status}</th>
              </tr>
            </thead>
            <tbody>
              {gateExamples.map((e) => (
                <tr key={e.id} className="align-top">
                  <td className="border-b border-white/5 px-3 py-3 text-ink/85">{e.topic}</td>
                  <td className="border-b border-white/5 px-3 py-3 text-ink/60">{e.category}</td>
                  <td className="border-b border-white/5 px-3 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                        e.verdict === "allowed" ? "border-leaf/40 bg-leaf/10 text-mint" : "border-clay/50 bg-clay/10 text-clay"
                      }`}
                    >
                      {e.verdict === "allowed" ? gate.allowedHeading : gate.blockedHeading}
                    </span>
                  </td>
                  <td className="border-b border-white/5 px-3 py-3 text-ink/60">{e.detail}</td>
                  <td className="border-b border-white/5 px-3 py-3 text-ink/70">{e.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-5">
        <SectionHeading title={stateMachine.heading} note={stateMachine.note} disclaimer={chrome.disclaimer} demoBadge={chrome.demoBadge} />
        <div className="flex flex-wrap gap-3 text-xs text-ink/60">
          {(Object.keys(stateMachine.legend) as StageKind[]).map((k) => (
            <span key={k} className={`inline-flex items-center rounded-full border px-3 py-1 ${KIND_STYLES[k]}`}>
              {stateMachine.legend[k]}
            </span>
          ))}
        </div>
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {stateMachine.stages.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setOpenStage(s.id)}
                aria-expanded={openStage === s.id}
                className={`w-full rounded-xl border px-4 py-3 text-left transition ${KIND_STYLES[s.kind]} ${
                  openStage === s.id ? "ring-1 ring-mint/40" : ""
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <span className="text-ink/40">{i + 1}.</span>
                  {s.label}
                </span>
                {openStage === s.id ? <span className="mt-1 block text-xs text-ink/70">{s.note}</span> : null}
              </button>
            </li>
          ))}
        </ol>
        <div className="grid gap-2">
          <h3 className="text-sm font-semibold text-clay">{stateMachine.blockedHeading}</h3>
          <div className="flex flex-wrap gap-2">
            {stateMachine.blocked.map((b) => (
              <span key={b.id} className={`inline-flex flex-col rounded-lg border px-3 py-2 text-xs ${KIND_STYLES.blocked}`}>
                <span className="font-semibold">{b.label}</span>
                <span className="text-ink/60">{b.note}</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-5">
        <SectionHeading title={consensus.heading} note={consensus.note} disclaimer={chrome.disclaimer} demoBadge={chrome.demoBadge} />
        <div className="grid gap-2">
          <h3 className="text-sm font-semibold text-ink/80">{consensus.rolesHeading}</h3>
          <div className="flex flex-wrap gap-2">
            {consensus.roles.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setOpenRole(r.id)}
                aria-pressed={openRole === r.id}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                  openRole === r.id ? "border-mint/60 bg-mint/15 text-mint" : "border-white/15 bg-white/5 text-ink/70"
                }`}
              >
                <span className="font-mono text-xs">{r.role}</span>
                {r.mandatory ? (
                  <span className="rounded-full border border-amber/40 bg-amber/10 px-2 py-0.5 text-[11px] font-semibold text-amber">
                    {consensus.mandatoryBadge}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          <p className="rounded-md border border-white/10 bg-white/5 px-4 py-3 text-sm text-ink/75">{activeRole.description}</p>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="grid gap-2">
            <h3 className="text-sm font-semibold text-ink/80">{consensus.evidenceHeading}</h3>
            <ul className="grid gap-2">
              {consensus.evidence.map((ev) => (
                <li
                  key={ev.id}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                    ev.stance === "supporting" ? "border-leaf/30 bg-leaf/5 text-ink/80" : "border-clay/30 bg-clay/5 text-ink/80"
                  }`}
                >
                  <span>{ev.label}</span>
                  <span className="text-xs text-ink/55">
                    {ev.stance} · {ev.level}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid gap-2">
            <h3 className="text-sm font-semibold text-ink/80">{consensus.flowHeading}</h3>
            <ol className="grid gap-1.5">
              {consensus.flow.map((f, i) => (
                <li key={f.id} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-ink/80">
                  <span className="font-semibold">
                    {i + 1}. {f.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-ink/60">{f.note}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="rounded-xl border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-amber">
          <span className="font-semibold">{consensus.reviewStatusLabel}: </span>
          {consensus.reviewStatusValue}
        </div>
      </section>
    </div>
  );
}
