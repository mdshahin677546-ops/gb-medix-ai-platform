import { Shell } from "@/components/Shell";
import { getLang } from "@/lib/lang";
import { CheckoutButton } from "./checkout-button";

export default function CheckoutPage({ params }: { params: { lang: string } }) {
  const lang = getLang(params.lang);

  return (
    <Shell lang={lang}>
      <div className="max-w-xl rounded-md border border-black/10 bg-white p-6">
        <h1 className="text-3xl font-semibold text-ink">
          Full 7-Day Body Reset Plan
        </h1>
        <p className="mt-3 text-ink/75">
          Unlock the complete wellness plan, diet suggestions, lifestyle reset, and
          sleep improvement plan. Choose Stripe or Alipay where available.
        </p>
        <p className="mt-5 text-2xl font-semibold text-leaf">$9.99</p>
        <CheckoutButton lang={lang} />
      </div>
    </Shell>
  );
}
