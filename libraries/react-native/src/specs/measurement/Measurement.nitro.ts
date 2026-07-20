import type { HybridObject } from "react-native-nitro-modules";
import type {
  MeasurementBridgeEvent,
  MeasurementCommand,
  MeasurementCommandResult,
  MeasurementConfigurationStateBridge,
  MeasurementFlushBridgeResult,
  MeasurementInboxEntry,
  MeasurementInitializeConfiguration,
  MeasurementProtectedEvidenceInput,
  MeasurementStateBridge,
} from "./MeasurementTypes.nitro";

export interface Measurement extends HybridObject<{ ios: "swift"; android: "kotlin" }> {
  initialize(publishableKey: string, configuration: MeasurementInitializeConfiguration): Promise<MeasurementStateBridge>;
  enqueue(command: MeasurementCommand): Promise<MeasurementCommandResult>;
  flush(): Promise<MeasurementFlushBridgeResult>;
  getInstallationId(): Promise<string>;
  getState(): Promise<MeasurementStateBridge>;
  subscribe(subscriptionId: string, listener: (event: MeasurementBridgeEvent) => void): void;
  unsubscribe(subscriptionId: string): void;
  peekInbox(limit: number): Promise<MeasurementInboxEntry[]>;
  acknowledgeInbox(entryId: string): Promise<boolean>;
  readProtectedEvidence(blobId: string): Promise<ArrayBuffer>;
  putProtectedEvidence(input: MeasurementProtectedEvidenceInput): Promise<string>;
  deleteProtectedEvidence(blobId: string): Promise<boolean>;
  deleteProtectedData(requestId: string): Promise<boolean>;
  getMeasurementConfigurationState(): Promise<MeasurementConfigurationStateBridge>;
  persistMeasurementConfigurationState(version: number, payload: ArrayBuffer): Promise<boolean>;
  applyMeasurementConfiguration(version: number, payload: ArrayBuffer): Promise<void>;
  applyMeasurementStorageLimits(maxOutboxRecords: number, maxOutboxBytes: number, maxProtectedBytes: number): Promise<void>;
  getPushRegistrationState(): Promise<MeasurementConfigurationStateBridge>;
  persistPushRegistrationState(payload: ArrayBuffer): Promise<boolean>;
  clearPushRegistrationState(): Promise<boolean>;
  getTestDeviceState(): Promise<boolean>;
  persistTestDeviceState(enabled: boolean): Promise<boolean>;
  hasDedupe(namespace: string, key: string): Promise<boolean>;
  checkAndSetDedupe(namespace: string, key: string, expiresAtMs: number): Promise<boolean>;
}
