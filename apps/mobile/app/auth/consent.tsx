import { Screen } from "../../components/Screen";

/** Third-party AI consent notice (static). Real consent write is backend-owned. */
export default function ConsentScreen() {
  return (
    <Screen
      title="Third-party AI processing notice"
      subtitle="We ask for your consent before third-party AI processes your health inputs."
      note="Consent write and the AI gate are backend-owned; this batch shows the notice only."
    />
  );
}
