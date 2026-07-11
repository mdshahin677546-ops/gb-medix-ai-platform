import { Screen } from "../components/Screen";

/** Splash / entry. In batch 1 this is a static screen; no session restore. */
export default function SplashScreen() {
  return (
    <Screen
      title="GB MEDIX AI"
      subtitle="AI health management · TCM constitution + modern lifestyle"
      note="Static foundation (batch 1). Sign-in and session restore are not implemented."
    />
  );
}
