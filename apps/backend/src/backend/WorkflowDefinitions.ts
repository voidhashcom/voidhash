import { defineWorkflow } from "@voidhash/platform/Workflow";
import { Schema } from "effect";

export const DeliverWebhookDefinition = defineWorkflow({
  name: "selfhost-deliver-webhook",
  payload: {
    attemptNumber: Schema.Number,
    deliveryId: Schema.String,
    endpointId: Schema.String,
    eventType: Schema.String,
    payload: Schema.Unknown,
    secret: Schema.String,
    url: Schema.String,
  },
  success: Schema.Void,
  idempotencyKey: ({ deliveryId }) => deliveryId,
});

export const IdentifyDistinctIdCompletionDefinition = defineWorkflow({
  name: "selfhost-identify-distinct-id-completion",
  payload: {
    distinctId: Schema.String,
    eventTimestamp: Schema.String,
    jobId: Schema.String,
    origin: Schema.Literals([1, 2, 3, 4, 5, 6, 7]),
    previousDistinctId: Schema.String,
    projectId: Schema.String,
    requestedAt: Schema.String,
    targetPersonId: Schema.String,
  },
  success: Schema.Void,
  idempotencyKey: ({ jobId }) => jobId,
});

const replayPayload = {
  paymentProviderConfigurationId: Schema.String,
  paymentProviderProductId: Schema.String,
  providerProductKey: Schema.String,
};

export const AppStoreReplayParkedNotificationsDefinition = defineWorkflow({
  name: "selfhost-app-store-replay-parked-notifications",
  payload: replayPayload,
  success: Schema.Void,
  idempotencyKey: ({ paymentProviderConfigurationId, paymentProviderProductId }) =>
    `${paymentProviderConfigurationId}:${paymentProviderProductId}`,
});

export const AppStoreReplayParkedSdkNotificationsDefinition = defineWorkflow({
  name: "selfhost-app-store-replay-parked-sdk-notifications",
  payload: {
    originalTransactionId: Schema.String,
    paymentProviderConfigurationId: Schema.String,
  },
  success: Schema.Void,
  idempotencyKey: ({ originalTransactionId, paymentProviderConfigurationId }) =>
    `${paymentProviderConfigurationId}:${originalTransactionId}`,
});

export const AppStoreReconcileOriginalTransactionDefinition = defineWorkflow({
  name: "selfhost-app-store-reconcile-original-transaction",
  payload: {
    originalTransactionId: Schema.String,
    paymentProviderConfigurationId: Schema.String,
    reason: Schema.Literals(["first_seen", "admin_repair", "install_backfill"]),
    triggeredAt: Schema.String,
  },
  success: Schema.Void,
  idempotencyKey: ({
    originalTransactionId,
    paymentProviderConfigurationId,
    triggeredAt,
  }) => `${paymentProviderConfigurationId}:${originalTransactionId}:${triggeredAt}`,
});

export const GooglePlayReplayParkedNotificationsDefinition = defineWorkflow({
  name: "selfhost-google-play-replay-parked-notifications",
  payload: replayPayload,
  success: Schema.Void,
  idempotencyKey: ({ paymentProviderConfigurationId, paymentProviderProductId }) =>
    `${paymentProviderConfigurationId}:${paymentProviderProductId}`,
});

export const StripeReplayParkedNotificationsDefinition = defineWorkflow({
  name: "selfhost-stripe-replay-parked-notifications",
  payload: replayPayload,
  success: Schema.Void,
  idempotencyKey: ({ paymentProviderConfigurationId, paymentProviderProductId }) =>
    `${paymentProviderConfigurationId}:${paymentProviderProductId}`,
});
