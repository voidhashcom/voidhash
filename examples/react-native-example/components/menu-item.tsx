import { StyleSheet, Text, TouchableOpacity } from "react-native";

export function MenuItem({
  title,
  onPress,
  isFirst,
  isLast,
}: {
  title: string;
  onPress: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.container,
        isFirst ? styles.firstItem : null,
        isLast ? styles.lastItem : null,
        isLast ? null : styles.withBottomBorder,
      ]}
    >
      <Text style={styles.title}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#18181b",
    borderColor: "#27272a",
    padding: 16,
  },
  firstItem: {
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  lastItem: {
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  withBottomBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 18,
  },
});
