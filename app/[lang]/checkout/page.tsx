import { Shell } from "@/components/Shell";
import { getLang } from "@/lib/lang";
import { CheckoutButton } from "./checkout-button";

export default function CheckoutPage({
  params,
  searchParams
}: {
  params: { lang: string };
  searchParams: { assessmentId?: string; product?: string };
}) {
  const lang = getLang(params.lang);
  const product =
    searchParams.product === "body_reset_plan" || searchParams.product === "consult_pack"
      ? searchParams.product
      : "premium_report";

  return (
    <Shell lang={lang}>
      <div className="max-w-xl rounded-md border border-black/10 bg-white p-6">
        <h1 className="text-3xl font-semibold text-ink">
          Premium AI Health Management Report
        </h1>
        <p className="mt-3 text-ink/75">
          Unlock deeper lifestyle guidance, follow-up planning, and wellness product
          recommendations for your completed AI health assessment.
        </p>
        <p className="mt-5 text-2xl font-semibold text-leaf">$9.99</p>
        <p className="mt-4 rounded-md border border-amber/20 bg-amber/10 p-3 text-sm text-ink/70">
          This is AI health management guidance only. It is not a medical diagnosis,
          treatment plan, emergency service, or replacement for a licensed professional.
        </p>
        <CheckoutButton lang={lang} product={product} assessmentId={searchParams.assessmentId} />
      </div>
    </Shell>
  );
}
