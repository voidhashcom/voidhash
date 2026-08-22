import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "../lib/theme";

export interface CardProps {
  children?: ReactNode;
  subtitle?: string;
  title?: string;
}

/** Rounded surface with an optional title and subtitle. */
export function Card(props: CardProps) {
  const theme = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      {props.title === undefined ? null : (
        <Text style={[styles.title, { color: theme.text }]}>{props.title}</Text>
      )}
      {props.subtitle === undefined ? null : (
        <Text style={[styles.subtitle, { color: theme.mutedText }]}>{props.subtitle}</Text>
      )}
      {props.children}
    </View>
  );
}

export interface FieldProps {
  label: string;
  value: string;
}

/** Label/value row for the read-only detail lists on the Account screen. */
export function Field(props: FieldProps) {
  const theme = useTheme();

  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: theme.mutedText }]}>{props.label}</Text>
      <Text numberOfLines={1} style={[styles.fieldValue, { color: theme.text }]}>
        {props.value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
    padding: 16,
  },
  field: {
    alignItems: "center",
    flexDirection: "row",
    gap: 16,
    justifyContent: "space-between",
  },
  fieldLabel: {
    fontSize: 14,
  },
  fieldValue: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: "500",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: -4,
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
  },
});
