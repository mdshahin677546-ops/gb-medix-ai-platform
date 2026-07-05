import Link from "next/link";
import { copy, type Lang } from "@/lib/lang";

export function Shell({
  lang,
  children
}: {
  lang: Lang;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-mist">
      <header className="border-b border-black/10 bg-white/80">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <Link href={`/${lang}/tcm-check`} className="text-lg font-semibold text-ink">
            GB Medix AI
          </Link>
          <div className="flex gap-4 text-sm text-ink/75">
            <Link href={`/${lang}/shop`}>Shop</Link>
            <Link href={`/${lang}/rfq`}>RFQ</Link>
          </div>
        </nav>
      </header>
      <section className="mx-auto max-w-5xl px-5 py-8">{children}</section>
      <p className="mx-auto max-w-5xl px-5 pb-8 text-xs text-ink/55">
        {copy[lang].disclaimer}
      </p>
    </main>
  );
}
