import { Screen } from "../../components/Screen";

/** Report history placeholder. Lists only the current user's reports (IDOR-safe backend). */
export default function ReportHistoryScreen() {
  return (
    <Screen
      title="Report history"
      subtitle="Your past reports."
      state="empty"
      note="Only the signed-in user's reports are shown; enforced server-side by { id, userId }."
    />
  );
}
