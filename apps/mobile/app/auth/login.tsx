import { Screen } from "../../components/Screen";

/** Login screen (static). No real request, token, or SecureStore write in batch 1. */
export default function LoginScreen() {
  return (
    <Screen
      title="Sign in"
      subtitle="Email sign-in."
      note="BLOCKED: real login / token issuance requires a Codex-approved DeviceSession + refresh design."
    />
  );
}
