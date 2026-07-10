import Link from "next/link";
import { redirect } from "next/navigation";
import { GBLogo } from "@/components/GBLogo";
import { getCurrentMerchant } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MerchantProductManager } from "./product-manager";

export default async function MerchantDashboardPage() {
  const merchant = await getCurrentMerchant();

  if (!merchant) {
    redirect("/merchant/login");
  }

  const products = await prisma.product.findMany({
    where: { merchantId: merchant.id },
    orderBy: { createdAt: "desc" }
  });

  return (
    <main className="ambient-grid min-h-screen px-5 py-6">
      <section className="mx-auto grid max-w-[1400px] gap-5">
        <header className="glass-panel rounded-md p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link href="/zh/dashboard" className="flex items-center gap-3">
              <GBLogo />
            </Link>
            <div className="flex flex-wrap gap-3 text-sm">
              <Link
                href="/zh/shop"
                className="rounded-md border border-white/10 bg-white/5 px-4 py-2 text-ink transition hover:border-mint/30"
              >
                前台商城
              </Link>
              <Link
                href="/zh/rfq"
                className="rounded-md border border-mint/25 bg-mint/10 px-4 py-2 text-mint transition hover:bg-mint/15"
              >
                RFQ 询价
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_320px] lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-mint/70">
                Merchant Console
              </p>
              <h1 className="mt-3 text-3xl font-semibold text-ink sm:text-4xl">
                {merchant.storeName} 商家后台
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/65">
                上传产品后会进入 GB Medix 商城展示。当前版本用于供应链招商、产品陈列和询价转化，
                后续可以继续接入库存、订单、物流和商家结算。
              </p>
            </div>
            <div className="rounded-md border border-mint/20 bg-mint/10 p-4 text-sm text-ink/75">
              <p className="font-semibold text-mint">{merchant.email}</p>
              <p className="mt-2">{merchant.contactName}</p>
              <p className="mt-1">{merchant.country}</p>
              <p className="mt-3 text-xs text-ink/60">Status: {merchant.status}</p>
            </div>
          </div>
        </header>

        <MerchantProductManager initialProducts={products} />
      </section>
    </main>
  );
}
