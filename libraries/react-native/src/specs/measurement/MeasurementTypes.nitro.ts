export type MeasurementBridgeSource = "ios" | "android" | "core";
export type MeasurementRecordSource = "native" | "javascript" | "store" | "push" | "server-correlation";
export type MeasurementRecordPriority = "critical" | "high" | "normal" | "low";
export type MeasurementCommandKind =
  | "enqueueRecord"
  | "identityTransition"
  | "consentTransition"
  | "sessionSignal"
  | "coldLaunchInput"
  | "transactionDedup"
  | "linkInput"
  | "pushInput"
  | "purchaseInput"
  | "identifierInput";
export interface MeasurementBridgeError {
  readonly code: string;
  readonly message: string;
  readonly source: MeasurementBridgeSource;
  readonly capability?: string;
  readonly reason?: string;
}

export interface MeasurementIdentitySnapshot {
  readonly distinctId: string;
  readonly anonymousId?: string;
  readonly personId?: string;
  readonly revision: number;
}

export interface MeasurementConsentSnapshot {
  readonly revision: number;
  readonly decidedAt: string;
  readonly source: string;
  readonly gdprApplies?: boolean;
  readonly dataUsage?: boolean;
  readonly adsPersonalization?: boolean;
  readonly adStorage?: boolean;
  readonly collectionOptOut?: boolean;
  readonly partnerSharingOptOut?: boolean;
}

export interface MeasurementSessionSnapshot {
  readonly id: string;
  readonly sequence: number;
  readonly startedAt: string;
  readonly reason: string;
}

export interface MeasurementInitializeConfiguration {
  readonly apiUrl: string;
  readonly ingestUrl: string;
  readonly linksUrl: string;
  readonly trustedConfigKeyIds: string[];
}

export interface MeasurementConfigurationStateBridge {
  readonly version: number;
  readonly payload?: ArrayBuffer;
}

interface MeasurementCommandBase {
  readonly commandId: string;
  readonly recordType: string;
  readonly occurredAt: string;
  readonly source: MeasurementRecordSource;
  readonly priority: MeasurementRecordPriority;
  readonly publicPayload: ArrayBuffer;
  readonly protectedEvidenceRef?: string;
  readonly identity?: MeasurementIdentitySnapshot;
  readonly consent?: MeasurementConsentSnapshot;
  readonly session?: MeasurementSessionSnapshot;
}

export interface MeasurementEnqueueRecordCommand extends MeasurementCommandBase {
  readonly kind: "enqueueRecord";
}

export interface MeasurementIdentityTransitionCommand extends MeasurementCommandBase {
  readonly kind: "identityTransition";
}

export interface MeasurementConsentTransitionCommand extends MeasurementCommandBase {
  readonly kind: "consentTransition";
}

export interface MeasurementSessionSignalCommand extends MeasurementCommandBase {
  readonly kind: "sessionSignal";
}

export interface MeasurementColdLaunchInputCommand extends MeasurementCommandBase {
  readonly kind: "coldLaunchInput";
}

export interface MeasurementTransactionDedupCommand extends MeasurementCommandBase {
  readonly kind: "transactionDedup";
}

export interface MeasurementLinkInputCommand extends MeasurementCommandBase {
  readonly kind: "linkInput";
}

export interface MeasurementPushInputCommand extends MeasurementCommandBase {
  readonly kind: "pushInput";
}

export interface MeasurementPurchaseInputCommand extends MeasurementCommandBase {
  readonly kind: "purchaseInput";
}

export interface MeasurementIdentifierInputCommand extends MeasurementCommandBase {
  readonly kind: "identifierInput";
}

export type MeasurementCommandSchema =
  | MeasurementEnqueueRecordCommand
  | MeasurementIdentityTransitionCommand
  | MeasurementConsentTransitionCommand
  | MeasurementSessionSignalCommand
  | MeasurementColdLaunchInputCommand
  | MeasurementTransactionDedupCommand
  | MeasurementLinkInputCommand
  | MeasurementPushInputCommand
  | MeasurementPurchaseInputCommand
  | MeasurementIdentifierInputCommand;

export interface MeasurementCommand extends MeasurementCommandBase {
  readonly kind: MeasurementCommandKind;
}

export interface MeasurementCommandResult {
  readonly accepted: boolean;
  readonly recordId?: string;
  readonly installationSequence?: number;
  readonly error?: MeasurementBridgeError;
}

export interface MeasurementFlushBridgeResult {
  readonly accepted: number;
  readonly scheduled: number;
  readonly quarantined: number;
  readonly policyBlocked: number;
}

export interface MeasurementStateBridge {
  readonly installationId: string;
  readonly firstOpenedAt: string;
  readonly installationSequence: number;
  readonly readiness: string;
  readonly currentSessionId?: string;
  readonly currentSessionSequence?: number;
  readonly consentRevision: number;
  readonly configurationRevision: number;
  readonly outboxCritical: number;
  readonly outboxHigh: number;
  readonly outboxNormal: number;
  readonly outboxLow: number;
  readonly oldestRecordAgeMs?: number;
}

export interface MeasurementBridgeEvent {
  readonly subscriptionId: string;
  readonly event: string;
  readonly recordId?: string;
  readonly requestId?: string;
  readonly payload?: ArrayBuffer;
  readonly error?: MeasurementBridgeError;
}

export interface MeasurementInboxEntry {
  readonly id: string;
  readonly kind: string;
  readonly source: string;
  readonly appState: string;
  readonly receivedAt: string;
  readonly protectedEvidenceRef: string;
}

export type MeasurementProtectedPurpose =
  | "advertising-identifier"
  | "diagnostic-authorization"
  | "email"
  | "install-referrer"
  | "link-capture"
  | "partner-context"
  | "phone"
  | "purchase-receipt"
  | "push-token";

export type MeasurementProtectedRetention = "ephemeral" | "installation" | "legal" | "transaction";

export interface MeasurementProtectedEvidenceInput {
  readonly blobId: string;
  readonly purpose: MeasurementProtectedPurpose;
  readonly consentRevision: number;
  readonly retentionClass: MeasurementProtectedRetention;
  readonly value: ArrayBuffer;
}
