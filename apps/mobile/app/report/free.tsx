import { Screen } from "../../components/Screen";

/** Free report placeholder. Premium fields are desensitized in the free view. */
export default function FreeReportScreen() {
  return (
    <Screen
      title="Free Report"
      subtitle="Health score, constitution pattern, and basic insights."
      note="Placeholder in batch 1; content comes from the backend (premium fields desensitized)."
    />
  );
}
