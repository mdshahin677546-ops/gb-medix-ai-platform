import { Screen } from "../../components/Screen";

/** Register screen (static). No real account creation in batch 1. */
export default function RegisterScreen() {
  return (
    <Screen
      title="Create account"
      subtitle="Register with your email to start a free assessment."
      note="Static placeholder; real registration is not implemented in batch 1."
    />
  );
}
