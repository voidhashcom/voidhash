import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

import { useTheme } from "../lib/theme";

export type ButtonVariant = "primary" | "secondary" | "ghost";

export interface ButtonProps {
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
  title: string;
  variant?: ButtonVariant;
}

/** Themed pressable with primary, secondary and ghost looks. */
export function Button(props: ButtonProps) {
  const theme = useTheme();
  const variant = props.variant ?? "primary";
  const isDisabled = props.disabled === true || props.loading === true;

  const background =
    variant === "primary" ? theme.accent : variant === "secondary" ? theme.card : "transparent";
  const label = variant === "primary" ? theme.accentText : theme.accent;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy: props.loading === true, disabled: isDisabled }}
      disabled={isDisabled}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: background,
          borderColor: variant === "secondary" ? theme.border : "transparent",
          opacity: isDisabled ? 0.5 : pressed ? 0.8 : 1,
        },
      ]}
    >
      {props.loading === true ? (
        <ActivityIndicator color={label} />
      ) : (
        <Text style={[styles.label, { color: label }]}>{props.title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
  },
});
