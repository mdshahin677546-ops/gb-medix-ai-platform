"use client";

import { useState } from "react";

type Product = {
  id: string;
  name: string;
  category: string;
  price: string;
  stock: string;
  imageUrl: string;
  description: string;
  status: string;
};

const categories = [
  "Herbal tea",
  "Sleep support",
  "Wellness kit",
  "Nutrition",
  "Relaxation tools",
  "Home health"
];

export function MerchantProductManager({
  initialProducts
}: {
  initialProducts: Product[];
}) {
  const [products, setProducts] = useState(initialProducts);
  const [status, setStatus] = useState("");
  const [form, setForm] = useState({
    name: "",
    category: categories[0],
    price: "",
    stock: "",
    imageUrl: "",
    description: ""
  });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("正在上传产品...");

    const response = await fetch("/api/merchant/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const data = await response.json();

    if (!response.ok) {
      setStatus(data.error || "上传失败，请检查产品信息。");
      return;
    }

    setProducts([data.product, ...products]);
    setForm({
      name: "",
      category: categories[0],
      price: "",
      stock: "",
      imageUrl: "",
      description: ""
    });
    setStatus("产品已上传，商城会展示该商品。");
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[420px_1fr]">
      <form onSubmit={submit} className="glass-panel rounded-md p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-mint/70">
          Product Upload
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-ink">上传产品</h2>

        <div className="mt-5 grid gap-3">
          <input
            required
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder="产品名称 / Product name"
            className="premium-input rounded-md px-3 py-3"
          />
          <select
            value={form.category}
            onChange={(event) => setForm({ ...form, category: event.target.value })}
            className="premium-input rounded-md px-3 py-3"
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <input
            required
            value={form.price}
            onChange={(event) => setForm({ ...form, price: event.target.value })}
            placeholder="价格 / Price, e.g. $29 or RFQ"
            className="premium-input rounded-md px-3 py-3"
          />
          <input
            required
            value={form.stock}
            onChange={(event) => setForm({ ...form, stock: event.target.value })}
            placeholder="库存 / Stock, e.g. Ready stock"
            className="premium-input rounded-md px-3 py-3"
          />
          <input
            value={form.imageUrl}
            onChange={(event) => setForm({ ...form, imageUrl: event.target.value })}
            placeholder="图片 URL / Image URL"
            className="premium-input rounded-md px-3 py-3"
          />
          <textarea
            required
            value={form.description}
            onChange={(event) =>
              setForm({ ...form, description: event.target.value })
            }
            placeholder="产品描述 / Product description"
            rows={5}
            className="premium-input rounded-md px-3 py-3"
          />
        </div>

        <button className="premium-button mt-4 rounded-md px-5 py-3 font-semibold">
          发布到平台商城
        </button>
        {status ? <p className="mt-3 text-sm text-mint">{status}</p> : null}
      </form>

      <div className="glass-panel rounded-md p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-mint/70">
              Store Catalog
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">我的产品</h2>
          </div>
          <span className="rounded-md border border-mint/20 bg-mint/10 px-3 py-2 text-sm text-mint">
            {products.length} SKUs
          </span>
        </div>

        <div className="mt-5 grid gap-3">
          {products.length ? (
            products.map((product) => (
              <article
                key={product.id}
                className="rounded-md border border-white/10 bg-white/5 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-ink">{product.name}</h3>
                    <p className="mt-1 text-sm text-ink/50">{product.category}</p>
                  </div>
                  <span className="rounded-md border border-white/10 px-3 py-1 text-xs text-ink/60">
                    {product.status}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-ink/65">
                  {product.description}
                </p>
                <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                  <span className="rounded-md bg-white/5 px-3 py-2 text-amber">
                    {product.price}
                  </span>
                  <span className="rounded-md bg-white/5 px-3 py-2 text-ink/65">
                    {product.stock}
                  </span>
                  <span className="rounded-md bg-white/5 px-3 py-2 text-mint">
                    RFQ ready
                  </span>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-md border border-dashed border-white/15 p-8 text-center text-sm text-ink/55">
              还没有产品。上传第一个商品后，商城会开始展示你的店铺商品。
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
