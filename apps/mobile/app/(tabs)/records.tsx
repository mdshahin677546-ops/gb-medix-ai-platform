import { Screen } from "../../components/Screen";

/** Health records / archive. Family member records will be isolated by userId/familyMemberId. */
export default function RecordsTab() {
  return (
    <Screen
      title="Health Records"
      subtitle="Reports, history, and next steps in one place."
      state="empty"
      note="Report history is a placeholder in batch 1; data is read-only from the backend once wired."
    />
  );
}
