import { Shell } from "@/components/Shell";
import { getLang } from "@/lib/lang";
import { ShopExperience } from "./shop-experience";

const products = [
  {
    name: "Herbal Signal Tea",
    zhName: "\u672c\u8349\u8282\u5f8b\u8336",
    image: "/assets/shop/herbal-tea-kit.png",
    tag: "TCM inspired",
    match: 92,
    stock: "Ready stock",
    price: "$28",
    category: "tcm" as const,
    description:
      "Daily tea kit for digestion rhythm, lightness, and evening reset routines."
  },
  {
    name: "Sleep Recovery Kit",
    zhName: "\u7761\u7720\u6062\u590d\u5957\u88c5",
    image: "/assets/shop/sleep-support-kit.png",
    tag: "Sleep protocol",
    match: 88,
    stock: "Ships in 24h",
    price: "$46",
    category: "sleep" as const,
    description:
      "Compact sleep-support pack with calming routine prompts and nighttime support."
  },
  {
    name: "Clinical Wellness Kit",
    zhName: "\u4e34\u5e8a\u5065\u5eb7\u5957\u7ec4",
    image: "/assets/shop/clinical-wellness-kit.png",
    tag: "Family profile",
    match: 84,
    stock: "RFQ available",
    price: "$86",
    category: "rfq" as const,
    description:
      "A family wellness starter kit for signal tracking, body pattern notes, and care planning."
  },
  {
    name: "Relaxation Tools",
    zhName: "\u653e\u677e\u8bad\u7ec3\u5de5\u5177",
    image: "/assets/shop/relaxation-tools-kit.png",
    tag: "Stress care",
    match: 79,
    stock: "Low stock",
    price: "$58",
    category: "stress" as const,
    description:
      "Breathing and relaxation toolkit for stress index improvement and daily recovery."
  }
];

const shopCopy = {
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
        <ShopExperience
          lang={lang}
          products={products}
          addPlanLabel={shopCopy.addPlan}
        />

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
                <div
                  key={item}
                  className="rounded-md border border-white/10 bg-white/5 p-4 transition hover:border-mint/30 hover:bg-mint/10"
                >
                  <p className="font-semibold text-ink">{item}</p>
                  <p className="mt-2 text-xs text-ink/50">
                    Connected commerce workflow
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </Shell>
  );
}
