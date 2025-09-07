import { expoRouterWithVoidhashCallback } from '@voidhash/react-native';

export function redirectSystemPath(options: {
  path: string;
  initial: boolean;
}) {
  return expoRouterWithVoidhashCallback(options);
}
