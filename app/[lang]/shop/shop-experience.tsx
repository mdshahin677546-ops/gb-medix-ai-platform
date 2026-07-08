"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Lang } from "@/lib/lang";

type Product = {
  name: string;
  zhName: string;
  image: string;
  tag: string;
  match: number;
  stock: string;
  price: string;
  category: "all" | "sleep" | "stress" | "tcm" | "rfq";
  description: string;
};

const filters = [
  ["all", "\u5168\u90e8"],
  ["sleep", "\u7761\u7720"],
  ["stress", "\u538b\u529b"],
  ["tcm", "\u4f53\u8d28"],
  ["rfq", "RFQ"]
] as const;

export function ShopExperience({
  lang,
  products,
  addPlanLabel
}: {
  lang: Lang;
  products: Product[];
  addPlanLabel: string;
}) {
  const [activeFilter, setActiveFilter] = useState<(typeof filters)[number][0]>("all");
  const [intensity, setIntensity] = useState(86);
  const [selected, setSelected] = useState<string[]>([]);
  const [spotlight, setSpotlight] = useState(products[0]?.name ?? "");

  const visibleProducts = useMemo(
    () =>
      products.filter((product) => {
        const matchesFilter =
          activeFilter === "all" || product.category === activeFilter;
        const matchesIntensity = product.match >= intensity - 18;
        return matchesFilter && matchesIntensity;
      }),
    [activeFilter, intensity, products]
  );

  function toggleProduct(name: string) {
    setSelected((current) =>
      current.includes(name)
        ? current.filter((item) => item !== name)
        : [...current, name]
    );
  }

  return (
    <div className="grid gap-5">
      <section className="glass-panel relative overflow-hidden rounded-md">
        <div className="scanner-line" />
        <div className="grid gap-5 p-5 sm:p-6 xl:grid-cols-[1fr_360px]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-mint/70">
              AI Product Intelligence
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-ink sm:text-4xl">
              智能健康商城 / Shop
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/65">
              用 AI 体质信号、生活节律和供应链状态组合推荐商品，让商城更像一个医疗科技选品中心。
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href={`/${lang}/assistant`}
                className="premium-button rounded-md px-5 py-3 text-sm font-semibold"
              >
                AI 评估推荐
              </Link>
              <Link
                href={`/${lang}/rfq`}
                className="rounded-md border border-mint/25 bg-mint/10 px-5 py-3 text-sm font-semibold text-mint transition hover:bg-mint/15"
              >
                B2B RFQ
              </Link>
              <span className="rounded-md border border-sky-400/25 bg-sky-400/10 px-5 py-3 text-sm text-sky-200">
                已选 {selected.length} / Selected
              </span>
            </div>
          </div>

          <div className="grid gap-3 rounded-md border border-white/10 bg-white/5 p-4">
            <p className="text-sm font-semibold text-ink">
              实时选品信号 / Live Signals
            </p>
            {[
              ["AI Match", `${intensity}%`, "基于睡眠、压力和体质信号"],
              ["Supply Health", "94%", "供应链库存稳定"],
              ["RFQ Speed", "12h", "平均报价响应"]
            ].map(([label, value, note]) => (
              <div
                key={label}
                className="rounded-md border border-white/10 bg-[#071827]/80 p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-ink/60">{label}</span>
                  <span className="text-xl font-semibold text-mint">{value}</span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-md bg-white/10">
                  <div
                    className="signal-meter h-full rounded-md bg-mint"
                    style={{ width: value.includes("%") ? value : "72%" }}
                  />
                </div>
                <p className="mt-2 text-xs text-ink/45">{note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="glass-panel rounded-md p-4">
        <div className="grid gap-4 xl:grid-cols-[1fr_320px] xl:items-center">
          <div className="flex gap-2 overflow-x-auto">
            {filters.map(([key, label]) => (
              <button
                key={key}
                onClick={() => setActiveFilter(key)}
                className={
                  activeFilter === key
                    ? "rounded-md border border-mint/35 bg-mint/15 px-4 py-2 text-sm font-semibold text-mint"
                    : "rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm text-ink/65 transition hover:border-mint/30 hover:text-mint"
                }
              >
                {label}
              </button>
            ))}
          </div>
          <label className="grid gap-2 text-sm text-ink/65">
            AI 推荐强度 / Recommendation intensity
            <input
              type="range"
              min="70"
              max="96"
              value={intensity}
              onChange={(event) => setIntensity(Number(event.target.value))}
              className="accent-[#63f5d7]"
            />
          </label>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {visibleProducts.map((product, index) => {
          const active = selected.includes(product.name);
          return (
            <article
              key={product.name}
              onMouseEnter={() => setSpotlight(product.name)}
              className="product-card group overflow-hidden rounded-md border border-white/10 bg-[#081827]/80 shadow-2xl shadow-black/20 transition hover:-translate-y-1 hover:border-mint/40 hover:shadow-[0_24px_80px_rgba(25,211,197,0.16)]"
              style={{ animationDelay: `${index * 80}ms` }}
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
                <div className="product-scan absolute inset-0 opacity-0 transition group-hover:opacity-100" />
                <span className="absolute left-3 top-3 rounded-md border border-mint/25 bg-[#06111d]/80 px-3 py-1 text-xs text-mint backdrop-blur">
                  {product.tag}
                </span>
                {spotlight === product.name ? (
                  <span className="absolute bottom-3 right-3 rounded-md border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-xs text-sky-100">
                    Live focus
                  </span>
                ) : null}
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
                    <p className="mt-1 font-semibold text-mint">{product.match}%</p>
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
                  <button
                    onClick={() => toggleProduct(product.name)}
                    className={
                      active
                        ? "flex-1 rounded-md border border-mint/35 bg-mint/15 px-3 py-2 text-center text-sm font-semibold text-mint transition hover:bg-mint/20"
                        : "flex-1 rounded-md bg-mint px-3 py-2 text-center text-sm font-semibold text-[#03101c] transition hover:bg-white"
                    }
                  >
                    {active ? "已加入 / Added" : addPlanLabel}
                  </button>
                  <Link
                    href={`/${lang}/rfq`}
                    className="rounded-md border border-sky-400/30 px-3 py-2 text-sm font-medium text-sky-200 transition hover:bg-sky-400/10"
                  >
                    RFQ
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      {visibleProducts.length === 0 ? (
        <section className="glass-panel rounded-md p-6 text-center text-ink/65">
          当前强度下暂无匹配商品，降低推荐强度试试。
        </section>
      ) : null}
    </div>
  );
}
