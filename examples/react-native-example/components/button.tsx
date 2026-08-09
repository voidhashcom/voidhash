import type { StyleProp, TextStyle, ViewStyle } from "react-native";
import { Pressable, StyleSheet, Text } from "react-native";

interface ButtonProps {
  title: string;
  disabled?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export const Button = (props: ButtonProps) => (
  <Pressable
    disabled={props.disabled}
    onPress={props.onPress}
    style={[styles.button, props.disabled && styles.buttonDisabled, props.style]}
  >
    <Text style={[styles.text, props.textStyle]}>{props.title}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  button: {
    backgroundColor: "#005EFF",
    borderRadius: 8,
    padding: 12,
    width: "100%",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  text: {
    color: "#FFFFFF",
    fontSize: 18,
    textAlign: "center",
  },
});
