import { redirect } from "next/navigation";

export default function MerchantRedirect() {
  redirect("/merchant/dashboard");
}
