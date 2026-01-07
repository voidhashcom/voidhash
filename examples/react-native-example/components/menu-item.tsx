import { Text, TouchableOpacity } from "react-native";
import { cn } from "utils/lib";

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
      className={cn(
        "border-zinc-800 bg-zinc-900 p-4",
        isFirst && "rounded-t-lg",
        isLast && "rounded-b-lg",
        !isLast && "border-b"
      )}
      onPress={onPress}
    >
      <Text className="text-lg text-white ">{title}</Text>
    </TouchableOpacity>
  );
}
