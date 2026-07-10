import Link from "next/link";
import { GBLogo } from "@/components/GBLogo";
import { MerchantLoginForm } from "./merchant-login-form";

export default function MerchantLoginPage() {
  return (
    <main className="ambient-grid min-h-screen px-5 py-8">
      <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-5xl items-center gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <GBLogo />
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-mint/70">
            Supplier Onboarding
          </p>
          <h1 className="mt-3 text-4xl font-semibold text-ink">
            商家入驻 / Open your wellness shop
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-ink/65">
            供应商可以用邮箱快速注册，上传健康产品、营养品、睡眠支持工具和家庭健康套装。
            当前是平台审核前的轻量版本，适合先跑通招商和产品上架流程。
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <Link
              href="/zh/shop"
              className="rounded-md border border-white/10 bg-white/5 px-4 py-2 text-ink transition hover:border-mint/30"
            >
              查看商城
            </Link>
            <Link
              href="/zh/rfq"
              className="rounded-md border border-mint/25 bg-mint/10 px-4 py-2 text-mint transition hover:bg-mint/15"
            >
              供应链 RFQ
            </Link>
          </div>
        </div>

        <div className="glass-panel rounded-md p-5 sm:p-6">
          <MerchantLoginForm />
        </div>
      </section>
    </main>
  );
}
