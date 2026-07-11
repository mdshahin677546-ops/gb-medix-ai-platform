import { Screen } from "../../components/Screen";

/** Conversational home. Batch 1: static. Real chat is gated by Consent + backend API. */
export default function HomeTab() {
  return (
    <Screen
      title="How are you feeling today?"
      subtitle="A calm, conversational health companion — one question at a time."
      note="Health management, not diagnosis. Static placeholder in batch 1."
    />
  );
}
