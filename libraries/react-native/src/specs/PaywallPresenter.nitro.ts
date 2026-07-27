import type { HybridObject } from "react-native-nitro-modules";

export interface PaywallPresenter extends HybridObject<{
  ios: "swift";
  android: "kotlin";
}> {
  preload(locationSlug: string, htmlUrl: string): Promise<boolean>;
  show(
    locationSlug: string,
    htmlUrl: string,
    onBridgeEvent?: (rawEvent: string) => void,
    onDismiss?: () => void,
  ): Promise<boolean>;
  dismiss(): Promise<void>;
  release(locationSlug: string): void;
  postMessage(locationSlug: string, data: string): void;
}
