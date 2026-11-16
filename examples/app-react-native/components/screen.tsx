import type { ReactNode } from "react";
import { ScrollView, StyleSheet } from "react-native";

import { useTheme } from "../lib/theme";

export interface ScreenProps {
  children: ReactNode;
}

/** Scrollable, themed page body shared by the three tabs. */
export function Screen(props: ScreenProps) {
  const theme = useTheme();

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: theme.background }}
    >
      {props.children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 16,
    padding: 16,
    paddingBottom: 40,
  },
});
