import { Shell } from "@/components/Shell";
import { getLang } from "@/lib/lang";

const products = [
  "Herbal tea",
  "Sleep support products",
  "Wellness kits",
  "Relaxation tools"
];

export default function ShopPage({ params }: { params: { lang: string } }) {
  const lang = getLang(params.lang);

  return (
    <Shell lang={lang}>
      <h1 className="text-3xl font-semibold text-ink">Shop</h1>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {products.map((product) => (
          <article
            key={product}
            className="rounded-md border border-black/10 bg-white p-5"
          >
            <h2 className="text-xl font-semibold text-ink">{product}</h2>
            <p className="mt-2 text-sm text-ink/65">
              Placeholder product recommendation for wellness routines.
            </p>
          </article>
        ))}
      </div>
    </Shell>
  );
}
