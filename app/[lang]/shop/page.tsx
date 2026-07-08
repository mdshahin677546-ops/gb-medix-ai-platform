import Image from "next/image";
import Link from "next/link";
import { Shell } from "@/components/Shell";
import { getLang } from "@/lib/lang";

const products = [
  {
    name: "Herbal Signal Tea",
    zhName: "\u672c\u8349\u8282\u5f8b\u8336",
    image: "/assets/shop/herbal-tea-kit.png",
    tag: "TCM inspired",
    match: "92%",
    stock: "Ready stock",
    price: "$28",
    description:
      "Daily tea kit for digestion rhythm, lightness, and evening reset routines."
  },
  {
    name: "Sleep Recovery Kit",
    zhName: "\u7761\u7720\u6062\u590d\u5957\u88c5",
    image: "/assets/shop/sleep-support-kit.png",
    tag: "Sleep protocol",
    match: "88%",
    stock: "Ships in 24h",
    price: "$46",
    description:
      "Compact sleep-support pack with calming routine prompts and nighttime support."
  },
  {
    name: "Clinical Wellness Kit",
    zhName: "\u4e34\u5e8a\u5065\u5eb7\u5957\u7ec4",
    image: "/assets/shop/clinical-wellness-kit.png",
    tag: "Family profile",
    match: "84%",
    stock: "RFQ available",
    price: "$86",
    description:
      "A family wellness starter kit for signal tracking, body pattern notes, and care planning."
  },
  {
    name: "Relaxation Tools",
    zhName: "\u653e\u677e\u8bad\u7ec3\u5de5\u5177",
    image: "/assets/shop/relaxation-tools-kit.png",
    tag: "Stress care",
    match: "79%",
    stock: "Low stock",
    price: "$58",
    description:
      "Breathing and relaxation toolkit for stress index improvement and daily recovery."
  }
];

const signals = [
  ["AI Match", "86%", "\u57fa\u4e8e\u7761\u7720\u3001\u538b\u529b\u548c\u4f53\u8d28\u4fe1\u53f7"],
  ["Supply Health", "94%", "\u4f9b\u5e94\u94fe\u5e93\u5b58\u7a33\u5b9a"],
  ["RFQ Speed", "12h", "\u5e73\u5747\u62a5\u4ef7\u54cd\u5e94"]
];

const shopCopy = {
  title: "\u667a\u80fd\u5065\u5eb7\u5546\u57ce / Shop",
  subtitle:
    "\u7528 AI \u4f53\u8d28\u4fe1\u53f7\u3001\u751f\u6d3b\u8282\u5f8b\u548c\u4f9b\u5e94\u94fe\u72b6\u6001\u7ec4\u5408\u63a8\u8350\u5546\u54c1\uff0c\u8ba9\u5546\u57ce\u66f4\u50cf\u4e00\u4e2a\u533b\u7597\u79d1\u6280\u9009\u54c1\u4e2d\u5fc3\u3002",
  aiRecommend: "AI \u8bc4\u4f30\u63a8\u8350",
  liveSignals: "\u5b9e\u65f6\u9009\u54c1\u4fe1\u53f7 / Live Signals",
  addPlan: "\u52a0\u5165\u65b9\u6848",
  supplyTitle: "\u4f9b\u5e94\u94fe\u7ea7\u9009\u54c1 / Supply-ready catalog",
  supplyCopy:
    "\u5c06\u4e2a\u4eba\u5065\u5eb7\u63a8\u8350\u548c B2B \u91c7\u8d2d\u6d41\u7a0b\u6253\u901a\uff1a\u96f6\u552e\u5546\u54c1\u53ef\u76f4\u63a5\u8f6c\u4e3a RFQ \u8be2\u4ef7\u3002"
};

export default function ShopPage({ params }: { params: { lang: string } }) {
  const lang = getLang(params.lang);

  return (
    <Shell lang={lang}>
      <div className="grid gap-5">
        <section className="glass-panel overflow-hidden rounded-md">
          <div className="grid gap-5 p-5 sm:p-6 xl:grid-cols-[1fr_360px]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-mint/70">
                AI Product Intelligence
              </p>
              <h1 className="mt-3 text-3xl font-semibold text-ink sm:text-4xl">
                {shopCopy.title}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/65">
                {shopCopy.subtitle}
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href={`/${lang}/assistant`}
                  className="premium-button rounded-md px-5 py-3 text-sm font-semibold"
                >
                  {shopCopy.aiRecommend}
                </Link>
                <Link
                  href={`/${lang}/rfq`}
                  className="rounded-md border border-mint/25 bg-mint/10 px-5 py-3 text-sm font-semibold text-mint transition hover:bg-mint/15"
                >
                  B2B RFQ
                </Link>
              </div>
            </div>

            <div className="grid gap-3 rounded-md border border-white/10 bg-white/5 p-4">
              <p className="text-sm font-semibold text-ink">
                {shopCopy.liveSignals}
              </p>
              {signals.map(([label, value, note]) => (
                <div
                  key={label}
                  className="rounded-md border border-white/10 bg-[#071827]/80 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-ink/60">{label}</span>
                    <span className="text-xl font-semibold text-mint">{value}</span>
                  </div>
                  <p className="mt-2 text-xs text-ink/45">{note}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {products.map((product) => (
            <article
              key={product.name}
              className="group overflow-hidden rounded-md border border-white/10 bg-[#081827]/80 shadow-2xl shadow-black/20 transition hover:-translate-y-1 hover:border-mint/40 hover:shadow-[0_24px_80px_rgba(25,211,197,0.16)]"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-[#04111f]">
                <Image
                  src={product.image}
                  alt={`${product.name} product image`}
                  fill
                  sizes="(min-width: 1280px) 25vw, (min-width: 768px) 50vw, 100vw"
                  className="object-cover transition duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#06111d] via-transparent to-transparent" />
                <span className="absolute left-3 top-3 rounded-md border border-mint/25 bg-[#06111d]/80 px-3 py-1 text-xs text-mint backdrop-blur">
                  {product.tag}
                </span>
              </div>

              <div className="grid gap-4 p-4">
                <div>
                  <h2 className="text-lg font-semibold text-ink">{product.zhName}</h2>
                  <p className="mt-1 text-sm text-ink/50">{product.name}</p>
                  <p className="mt-3 text-sm leading-6 text-ink/65">
                    {product.description}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-md border border-white/10 bg-white/5 p-2">
                    <p className="text-ink/45">AI Match</p>
                    <p className="mt-1 font-semibold text-mint">{product.match}</p>
                  </div>
                  <div className="rounded-md border border-white/10 bg-white/5 p-2">
                    <p className="text-ink/45">Stock</p>
                    <p className="mt-1 font-semibold text-ink">{product.stock}</p>
                  </div>
                  <div className="rounded-md border border-white/10 bg-white/5 p-2">
                    <p className="text-ink/45">From</p>
                    <p className="mt-1 font-semibold text-amber">{product.price}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Link
                    href={`/${lang}/checkout`}
                    className="flex-1 rounded-md bg-mint px-3 py-2 text-center text-sm font-semibold text-[#03101c] transition hover:bg-white"
                  >
                    {shopCopy.addPlan}
                  </Link>
                  <Link
                    href={`/${lang}/rfq`}
                    className="rounded-md border border-sky-400/30 px-3 py-2 text-sm font-medium text-sky-200 transition hover:bg-sky-400/10"
                  >
                    RFQ
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </section>

        <section className="glass-panel rounded-md p-5">
          <div className="grid gap-4 lg:grid-cols-[280px_1fr] lg:items-center">
            <div>
              <h2 className="text-xl font-semibold text-ink">
                {shopCopy.supplyTitle}
              </h2>
              <p className="mt-2 text-sm leading-6 text-ink/60">
                {shopCopy.supplyCopy}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {["AI screening", "Batch RFQ", "Delivery tracking"].map((item) => (
                <div key={item} className="rounded-md border border-white/10 bg-white/5 p-4">
                  <p className="font-semibold text-ink">{item}</p>
                  <p className="mt-2 text-xs text-ink/50">Connected commerce workflow</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </Shell>
  );
}
