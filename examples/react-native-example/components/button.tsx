import { Pressable, Text } from 'react-native';
import { cn } from '../utils/lib';

type ButtonProps = {
  title: string;
  disabled?: boolean;
  onPress: () => void;
  className?: string;
};

export const Button = (props: ButtonProps) => {
  return (
    <Pressable
      className={cn(
        'w-full rounded-lg bg-[#005EFF] p-3 disabled:opacity-50',
        props.className
      )}
      disabled={props.disabled}
      onPress={props.onPress}
    >
      <Text className="text-center text-lg text-white">{props.title}</Text>
    </Pressable>
  );
};
