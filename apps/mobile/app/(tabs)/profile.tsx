import { Screen } from "../../components/Screen";

/** Profile / account. Entitlement status is read from backend (single source of truth). */
export default function ProfileTab() {
  return (
    <Screen
      title="Me"
      subtitle="Account, entitlement status, language, and sign-out."
      note="Single/all-device sign-out and Entitlement status shown here once auth is Codex-approved."
    />
  );
}
