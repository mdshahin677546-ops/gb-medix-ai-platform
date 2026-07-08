import Link from "next/link";

export default function HomePage() {
  return (
    <main className="ambient-grid min-h-screen px-6 py-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl content-center gap-10">
        <section className="grid gap-8 lg:grid-cols-[1fr_380px] lg:items-center">
          <div className="grid gap-5">
            <div className="inline-flex w-fit rounded-md border border-leaf/20 bg-white/65 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-leaf shadow-sm backdrop-blur">
              GB Medix AI Wellness Assistant
            </div>
            <h1 className="max-w-4xl text-5xl font-semibold tracking-normal text-ink sm:text-7xl">
              Your AI wellness command center
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-ink/70">
              Ask wellness questions, understand daily body signals, preview
              TCM-inspired patterns, and unlock a focused 7-day reset plan.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/en/assistant"
                className="premium-button inline-flex rounded-md px-6 py-3 text-base font-medium"
              >
                Open AI Assistant
              </Link>
              <Link
                href="/en/tcm-check"
                className="inline-flex rounded-md border border-black/15 bg-white/75 px-6 py-3 text-base font-medium text-ink shadow-sm backdrop-blur transition hover:border-leaf hover:bg-white"
              >
                Start Body Type Test
              </Link>
            </div>
          </div>
          <div className="dark-panel rounded-md p-5 text-white">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-mint/70">
                  Live Signal
                </p>
                <h2 className="mt-1 text-2xl font-semibold">Body Pattern Scan</h2>
              </div>
              <span className="rounded-md bg-mint/15 px-3 py-2 text-sm text-mint">
                AI Ready
              </span>
            </div>
            <div className="mt-5 grid gap-3">
              {[
                ["Sleep rhythm", "84%"],
                ["Energy stability", "68%"],
                ["Diet pattern clarity", "76%"]
              ].map(([label, value]) => (
                <div key={label}>
                  <div className="mb-2 flex justify-between text-sm text-white/70">
                    <span>{label}</span>
                    <span>{value}</span>
                  </div>
                  <div className="h-2 rounded-md bg-white/10">
                    <div
                      className="h-2 rounded-md bg-mint"
                      style={{ width: value }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="grid gap-3 sm:grid-cols-3">
          {[
            "Wellness Q&A",
            "Body signal reflection",
            "7-day plan upgrade"
          ].map((item) => (
            <div key={item} className="glass-panel rounded-md p-5">
              <p className="font-medium text-ink">{item}</p>
              <p className="mt-2 text-sm text-ink/60">
                Structured, safe, and conversion-ready.
              </p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
