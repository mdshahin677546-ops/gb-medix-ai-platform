import { Field } from "@/components/Field";
import { Shell } from "@/components/Shell";
import { getLang } from "@/lib/lang";
import { RFQForm } from "./rfq-form";

export default function RFQPage({ params }: { params: { lang: string } }) {
  const lang = getLang(params.lang);

  return (
    <Shell lang={lang}>
      <h1 className="text-3xl font-semibold text-ink">B2B RFQ</h1>
      <RFQForm>
        <Field label="Name" name="name" />
        <Field label="Company" name="company" />
        <Field label="Email" name="email" type="email" />
        <Field label="Country" name="country" />
        <Field label="Product interest" name="productInterest" />
        <Field label="Quantity" name="quantity" type="number" />
      </RFQForm>
    </Shell>
  );
}
