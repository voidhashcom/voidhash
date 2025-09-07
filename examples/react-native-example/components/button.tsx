import { cn } from '../utils/lib';
import { Pressable, Text } from 'react-native';

type ButtonProps = {
  title: string;
  disabled?: boolean;
  onPress: () => void;
  className?: string;
};

export const Button = (props: ButtonProps) => {
  return (
    <Pressable
      onPress={props.onPress}
      className={cn(
        'w-full rounded-lg bg-[#005EFF] p-3 disabled:opacity-50',
        props.className
      )}
      disabled={props.disabled}
    >
      <Text className="text-center text-lg text-white">{props.title}</Text>
    </Pressable>
  );
};
