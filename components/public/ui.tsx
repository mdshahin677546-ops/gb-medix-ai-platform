import Link from "next/link";
import type { ReactNode } from "react";

/** Shared public-funnel visual primitives (server components, token-based). */

export function Container({ children, className = "", narrow = false }: { children: ReactNode; className?: string; narrow?: boolean }) {
  return <div className={`mx-auto w-full ${narrow ? "max-w-[800px]" : "max-w-[1280px]"} px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>;
}

export function Section({ children, id, className = "" }: { children: ReactNode; id?: string; className?: string }) {
  return (
    <section id={id} className={`py-10 sm:py-14 ${className}`}>
      <Container>{children}</Container>
    </section>
  );
}

export function SectionHeading({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <div className="mb-6 max-w-2xl">
      {eyebrow ? <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-mint/80">{eyebrow}</p> : null}
      <h2 className="text-2xl font-semibold text-ink sm:text-3xl">{title}</h2>
      {subtitle ? <p className="mt-2 text-sm text-ink/70 sm:text-base">{subtitle}</p> : null}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost";
const buttonClasses: Record<ButtonVariant, string> = {
  primary: "bg-leaf text-night hover:bg-mint focus-visible:ring-mint",
  secondary: "border border-mint/40 text-ink hover:border-mint hover:text-mint focus-visible:ring-mint",
  ghost: "text-ink/80 hover:text-mint focus-visible:ring-mint"
};

export function ButtonLink({ href, children, variant = "primary", className = "", onClickEventName }: { href: string; children: ReactNode; variant?: ButtonVariant; className?: string; onClickEventName?: string }) {
  return (
    <Link
      href={href}
      data-event={onClickEventName}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-night ${buttonClasses[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`glass-panel rounded-2xl p-5 ${className}`}>{children}</div>;
}

type BadgeTone = "success" | "review" | "attention" | "critical" | "info" | "neutral";
const toneClasses: Record<BadgeTone, string> = {
  success: "bg-leaf/15 text-leaf border-leaf/40",
  review: "bg-amber/15 text-amber border-amber/40",
  attention: "bg-amber/15 text-amber border-amber/40",
  critical: "bg-clay/15 text-clay border-clay/50",
  info: "bg-mint/15 text-mint border-mint/40",
  neutral: "bg-ink/10 text-ink/80 border-ink/20"
};

export function Badge({ children, tone = "neutral", icon }: { children: ReactNode; tone?: BadgeTone; icon?: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${toneClasses[tone]}`}>
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      {children}
    </span>
  );
}

export function DemoBadge({ label }: { label: string }) {
  return <Badge tone="info">{label}</Badge>;
}
