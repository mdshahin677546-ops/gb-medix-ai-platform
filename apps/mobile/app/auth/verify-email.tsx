import { Screen } from "../../components/Screen";

/**
 * Email verification notice (static). Real verification uses a single-use,
 * short-lived deep-link token — never a long-lived access/refresh token.
 */
export default function VerifyEmailScreen() {
  return (
    <Screen
      title="Verify your email"
      subtitle="Open the link we sent to finish setting up your account."
      note="Deep-link verification carries a single-use short-lived token only; not implemented in batch 1."
    />
  );
}
