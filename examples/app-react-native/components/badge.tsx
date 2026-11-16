import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "../lib/theme";

export type BadgeTone = "neutral" | "positive" | "warning" | "danger";

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
}

/** Small status pill — entitlement state, flag state, purchase outcome. */
export function Badge(props: BadgeProps) {
  const theme = useTheme();
  const tone = props.tone ?? "neutral";
  const color =
    tone === "positive"
      ? theme.positive
      : tone === "warning"
        ? theme.warning
        : tone === "danger"
          ? theme.danger
          : theme.mutedText;

  return (
    <View style={[styles.badge, { backgroundColor: theme.subtleBackground, borderColor: color }]}>
      <Text style={[styles.label, { color }]}>{props.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
  },
});
