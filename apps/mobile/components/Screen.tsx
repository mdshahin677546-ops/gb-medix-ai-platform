import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../theme/theme";

type ScreenState = "ready" | "loading" | "empty" | "error";

/**
 * Reusable static screen scaffold for the batch-1 foundation. Renders title,
 * optional body, and safe empty/loading/error placeholders. No data fetching.
 */
export function Screen(props: {
  title: string;
  subtitle?: string;
  state?: ScreenState;
  note?: string;
}) {
  const { title, subtitle, state = "ready", note } = props;
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {state === "loading" ? <Text style={styles.muted}>Loading...</Text> : null}
        {state === "empty" ? <Text style={styles.muted}>Nothing here yet.</Text> : null}
        {state === "error" ? <Text style={styles.error}>Something went wrong. Please try again.</Text> : null}
        {note ? <Text style={styles.note}>{note}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  container: { flex: 1, padding: theme.spacing.lg, gap: theme.spacing.sm },
  title: { color: theme.colors.ink, fontSize: 24, fontWeight: "700" },
  subtitle: { color: theme.colors.inkMuted, fontSize: 15 },
  muted: { color: theme.colors.inkMuted },
  error: { color: theme.colors.danger },
  note: { color: theme.colors.inkMuted, fontSize: 12, marginTop: theme.spacing.md }
});
