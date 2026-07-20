import type { HybridObject } from "react-native-nitro-modules";

export type NativePushProvider = "apns" | "fcm";
export type NativePushEnvironment = "development" | "production";
export type NativeNotificationEventKind =
  | "received"
  | "opened"
  | "tokenChanged"
  | "registrationError";

export interface NativePushToken {
  readonly token: string;
  readonly provider: NativePushProvider;
  readonly environment: NativePushEnvironment;
}

export interface NativeNotificationEvent {
  readonly id: string;
  readonly kind: NativeNotificationEventKind;
  readonly occurredAt: string;
  readonly protectedPayloadRef?: string;
  readonly pushNotificationSendId?: string;
  readonly link?: string;
  readonly errorCode?: string;
}

export interface Notifications extends HybridObject<{ ios: "swift"; android: "kotlin" }> {
  getPermissionStatus(): Promise<string>;
  requestPermission(provisional: boolean): Promise<string>;
  getToken(): Promise<NativePushToken>;
  setBadgeCount(count: number): Promise<void>;
  subscribe(subscriptionId: string, listener: (event: NativeNotificationEvent) => void): void;
  unsubscribe(subscriptionId: string): void;
}
