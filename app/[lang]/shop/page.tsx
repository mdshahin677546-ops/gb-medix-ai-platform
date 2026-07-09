import { Shell } from "@/components/Shell";
import { getLang } from "@/lib/lang";
import { prisma } from "@/lib/prisma";
import { ShopExperience, type ShopProduct } from "./shop-experience";

const defaultProducts: ShopProduct[] = [
  {
    name: "Herbal Signal Tea",
    zhName: "本草节律茶",
    image: "/assets/shop/herbal-tea-kit.png",
    tag: "TCM inspired",
    match: 92,
    stock: "Ready stock",
    price: "$28",
    category: "tcm",
    merchant: "GB Medix Select",
    description:
      "Daily tea kit for digestion rhythm, lightness, and evening reset routines."
  },
  {
    name: "Sleep Recovery Kit",
    zhName: "睡眠恢复套装",
    image: "/assets/shop/sleep-support-kit.png",
    tag: "Sleep protocol",
    match: 88,
    stock: "Ships in 24h",
    price: "$46",
    category: "sleep",
    merchant: "GB Medix Select",
    description:
      "Compact sleep-support pack with calming routine prompts and nighttime support."
  },
  {
    name: "Wellness Support Kit",
    zhName: "家庭健康套组",
    image: "/assets/shop/clinical-wellness-kit.png",
    tag: "Family profile",
    match: 84,
    stock: "RFQ available",
    price: "$86",
    category: "rfq",
    merchant: "GB Medix Select",
    description:
      "A family wellness starter kit for signal tracking, body pattern notes, and care planning."
  },
  {
    name: "Relaxation Tools",
    zhName: "放松训练工具",
    image: "/assets/shop/relaxation-tools-kit.png",
    tag: "Stress care",
    match: 79,
    stock: "Low stock",
    price: "$58",
    category: "stress",
    merchant: "GB Medix Select",
    description:
      "Breathing and relaxation toolkit for stress index improvement and daily recovery."
  }
];

function mapCategory(category: string): ShopProduct["category"] {
  const value = category.toLowerCase();
  if (value.includes("sleep")) return "sleep";
  if (value.includes("relax") || value.includes("stress")) return "stress";
  if (value.includes("tea") || value.includes("herbal")) return "tcm";
  return "rfq";
}

export default async function ShopPage({ params }: { params: { lang: string } }) {
  const lang = getLang(params.lang);

  const merchantProducts = await prisma.product.findMany({
    where: { status: "active" },
    include: { merchant: { select: { storeName: true, country: true } } },
    orderBy: { createdAt: "desc" },
    take: 24
  });

  const products: ShopProduct[] = [
    ...merchantProducts.map((product, index) => ({
      name: product.name,
      zhName: product.name,
      image: product.imageUrl,
      tag: product.category,
      match: Math.max(76, 96 - index * 2),
      stock: product.stock,
      price: product.price,
      category: mapCategory(product.category),
      merchant: `${product.merchant.storeName} / ${product.merchant.country}`,
      description: product.description
    })),
    ...defaultProducts
  ];

  return (
    <Shell lang={lang}>
      <div className="grid gap-5">
        <ShopExperience
          lang={lang}
          products={products}
          addPlanLabel={lang === "zh" ? "加入方案" : "Add to plan"}
        />

        <section className="glass-panel rounded-md p-5">
          <div className="grid gap-4 lg:grid-cols-[280px_1fr] lg:items-center">
            <div>
              <h2 className="text-xl font-semibold text-ink">
                供应链级选品 / Supply-ready catalog
              </h2>
              <p className="mt-2 text-sm leading-6 text-ink/60">
                商家可以在平台上传产品，前台商城负责展示和转化，批量采购继续进入 RFQ 询价流程。
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {["Merchant onboarding", "Product listing", "B2B RFQ"].map((item) => (
                <div
                  key={item}
                  className="rounded-md border border-white/10 bg-white/5 p-4 transition hover:border-mint/30 hover:bg-mint/10"
                >
                  <p className="font-semibold text-ink">{item}</p>
                  <p className="mt-2 text-xs text-ink/50">
                    Connected supply workflow
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
