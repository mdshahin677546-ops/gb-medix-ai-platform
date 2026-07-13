"use client";

/** Table of contents: sticky list on desktop, a jump selector on mobile. */
export function DetailToc({ label, items }: { label: string; items: { id: string; title: string }[] }) {
  const go = (id: string) => {
    const el = typeof document !== "undefined" ? document.getElementById(id) : null;
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <>
      {/* Mobile: selector */}
      <div className="lg:hidden">
        <label htmlFor="toc-select" className="sr-only">{label}</label>
        <select id="toc-select" onChange={(e) => { go(e.target.value); e.currentTarget.selectedIndex = 0; }}
          className="w-full rounded-xl border border-ink/15 bg-mist/50 px-3 py-2.5 text-sm text-ink focus:border-mint focus:outline-none">
          <option value="">{label}</option>
          {items.map((it) => <option key={it.id} value={it.id}>{it.title}</option>)}
        </select>
      </div>
      {/* Desktop: sticky list */}
      <nav aria-label={label} className="sticky top-24 hidden lg:block">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink/50">{label}</p>
        <ul className="space-y-1.5 border-l border-ink/10">
          {items.map((it) => (
            <li key={it.id}>
              <a href={`#${it.id}`} className="block border-l-2 border-transparent pl-3 text-sm text-ink/65 hover:border-mint hover:text-mint">{it.title}</a>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
