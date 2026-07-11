import { Screen } from "../../components/Screen";

/** AI health consultation entry. Requires Consent + active account (enforced by backend). */
export default function AiHealthTab() {
  return (
    <Screen
      title="AI Health"
      subtitle="Multi-turn wellness check-in and assessment."
      note="Requires third-party AI consent (AI_CONSENT_REQUIRED) and email-verified account. Not implemented in batch 1."
    />
  );
}
