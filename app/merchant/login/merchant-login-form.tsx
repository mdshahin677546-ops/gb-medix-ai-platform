"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MerchantLoginForm() {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [form, setForm] = useState({
    email: "",
    storeName: "",
    contactName: "",
    country: ""
  });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("正在创建商家账号...");

    const response = await fetch("/api/merchant/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });

    if (!response.ok) {
      setStatus("提交失败，请检查邮箱和店铺信息。");
      return;
    }

    setStatus("入驻成功，正在进入商家后台...");
    router.push("/merchant/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-mint/70">
          Merchant Portal
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-ink">商家注册 / 登录</h2>
      </div>

      <input
        required
        type="email"
        value={form.email}
        onChange={(event) => setForm({ ...form, email: event.target.value })}
        placeholder="merchant@example.com"
        className="premium-input rounded-md px-3 py-3"
      />
      <input
        required
        value={form.storeName}
        onChange={(event) => setForm({ ...form, storeName: event.target.value })}
        placeholder="店铺名称 / Store name"
        className="premium-input rounded-md px-3 py-3"
      />
      <input
        required
        value={form.contactName}
        onChange={(event) => setForm({ ...form, contactName: event.target.value })}
        placeholder="联系人 / Contact name"
        className="premium-input rounded-md px-3 py-3"
      />
      <input
        required
        value={form.country}
        onChange={(event) => setForm({ ...form, country: event.target.value })}
        placeholder="国家 / Country"
        className="premium-input rounded-md px-3 py-3"
      />

      <button className="premium-button rounded-md px-5 py-3 font-semibold">
        进入商家后台
      </button>
      {status ? <p className="text-sm text-mint">{status}</p> : null}
    </form>
  );
}
