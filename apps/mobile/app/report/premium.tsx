import { Screen } from "../../components/Screen";

/** Premium report placeholder. Access is gated by Entitlement (402) on the backend. */
export default function PremiumReportScreen() {
  return (
    <Screen
      title="Premium Report"
      subtitle="Personalized plan, lifestyle guidance, and follow-up."
      note="Premium requires an active Entitlement (ENTITLEMENT_REQUIRED / 402). No in-app purchase in batch 1."
    />
  );
}
