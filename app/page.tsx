import Image from "next/image";
import Link from "next/link";

const entryCards = [
  {
    title: "AI Health Assessment",
    description: "Answer a short wellness intake and receive a free AI health result.",
    href: "/en/tcm-check"
  },
  {
    title: "Health Management Center",
    description: "Review your reports, plans, and next wellness steps in one place.",
    href: "/en/dashboard"
  },
  {
    title: "Wellness Products",
    description: "Explore health product options after your assessment guidance.",
    href: "/en/shop"
  }
];

export default function HomePage() {
  return (
    <main className="ambient-grid min-h-screen text-ink">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
        <Link href="/" className="flex items-center gap-3 text-lg font-semibold">
          <span className="brand-mark rounded-md text-sm font-bold">GB</span>
          <span>GB Medix AI</span>
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/en/account" className="rounded-md border border-white/10 px-4 py-2 text-ink/75 hover:text-white">
            Sign in
          </Link>
          <Link href="/en/tcm-check" className="premium-button rounded-md px-4 py-2 font-semibold">
            Start free
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-88px)] max-w-7xl items-center gap-10 px-5 pb-10 pt-4 lg:grid-cols-[1.02fr_0.98fr]">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-mint">
            AI health management
          </p>
          <h1 className="mt-4 text-5xl font-semibold leading-tight text-white sm:text-6xl">
            AI Health Assessment
          </h1>
          <p className="mt-5 text-xl leading-8 text-ink/78">
            Understand your body patterns in about 3 minutes, receive a free AI health
            result, and choose whether to unlock a Premium health management report.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/en/tcm-check" className="premium-button rounded-md px-6 py-3 font-semibold">
              Start free health assessment
            </Link>
            <Link href="/zh/tcm-check" className="rounded-md border border-mint/30 px-6 py-3 font-semibold text-mint hover:bg-mint/10">
              中文免费检测
            </Link>
          </div>
          <p className="mt-6 flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs uppercase tracking-wide text-ink/60">
            <span>
              <span className="text-mint">01</span> Verify your email
            </span>
            <span>
              <span className="text-mint">02</span> Complete the 3-minute intake
            </span>
            <span>
              <span className="text-mint">03</span> Read your AI report
            </span>
          </p>
          <p className="mt-6 rounded-md border border-amber/25 bg-amber/10 p-4 text-sm leading-6 text-ink/72">
            GB Medix AI provides wellness education and health management suggestions.
            It is not a medical diagnosis, treatment plan, emergency service, or a
            replacement for a licensed healthcare professional.
          </p>
        </div>

        <div className="glass-panel overflow-hidden rounded-md p-5">
          <div className="relative min-h-[430px] overflow-hidden rounded-md border border-white/10 bg-[#061522]">
            <Image
              src="/assets/medical-body-scan.png"
              alt="AI health assessment visualization"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 48vw"
              className="object-contain p-8 opacity-90"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#061522] to-transparent p-5">
              <div className="grid gap-3 rounded-md border border-white/10 bg-black/30 p-4 backdrop-blur">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-ink/65">Free result</span>
                  <span className="rounded-md bg-mint/10 px-3 py-1 text-sm text-mint">Ready after intake</span>
                </div>
                <div className="h-2 rounded-md bg-white/10">
                  <div className="h-2 w-3/4 rounded-md bg-mint" />
                </div>
                <p className="text-sm text-ink/68">
                  Health score, constitution pattern, basic insights, and limited
                  health management suggestions.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-[#030914]/70 px-5 py-10">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-3">
          {entryCards.map((card) => (
            <Link
              key={card.title}
              href={card.href}
              className="rounded-md border border-white/10 bg-white/[0.04] p-5 transition hover:border-mint/40 hover:bg-mint/[0.06]"
            >
              <h2 className="text-xl font-semibold text-white">{card.title}</h2>
              <p className="mt-3 leading-6 text-ink/65">{card.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
