import Link from "next/link";

export default function AdminPage() {
  return (
    <main className="ambient-grid min-h-screen px-5 py-8 text-ink">
      <section className="mx-auto max-w-4xl rounded-md border border-white/10 bg-[#030914]/90 p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-mint">
          Operations
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-white">GB Medix Admin</h1>
        <p className="mt-3 max-w-2xl leading-7 text-ink/70">
          Internal entry for operations, payments, AI usage, and platform monitoring.
          Consumer health assessment traffic starts at the public Landing page.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link className="rounded-md border border-mint/30 px-4 py-2 text-mint" href="/en/dashboard">
            User health center
          </Link>
          <Link className="rounded-md border border-white/10 px-4 py-2 text-ink/70" href="/api/admin/ai-usage">
            AI usage API
          </Link>
        </div>
      </section>
    </main>
  );
}
