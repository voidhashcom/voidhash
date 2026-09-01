import * as Workflow from "@voidhash/platform/Workflow";
import * as Schema from "effect/Schema";

const replayResult = Schema.Struct({
  appliedCount: Schema.Number,
  failedCount: Schema.Number,
  totalParked: Schema.Number,
});

const replayPayload = {
  paymentProviderConfigurationId: Schema.String,
  paymentProviderProductId: Schema.String,
  providerProductKey: Schema.String,
  requestedAt: Schema.String,
};

/** Delivers one outbound webhook with durable retries. */
export const DeliverWebhook = Workflow.define({
  name: "DeliverWebhookWorkflow",
  payload: {
    attemptNumber: Schema.Number,
    deliveryId: Schema.String,
    endpointId: Schema.String,
    eventType: Schema.String,
    payload: Schema.Unknown,
    // Legacy field, no longer read. Every attempt re-reads the signing secret
    // from `webhook_endpoint` so rotating it revokes in-flight retries; this
    // stays declared (optional) only so instances dispatched before that
    // change still decode their payload on resume.
    secret: Schema.optionalKey(Schema.String),
    url: Schema.String,
  },
  success: Schema.Void,
  // The Cloudflare adapter derives the durable instance id from this key and
  // an instance id can never run twice. Keying on `deliveryId` alone would
  // make every re-dispatch (manual retry, sweeper pickup) resolve to the
  // original — usually terminal — instance and silently never run, so the
  // dispatching attempt number is part of the key.
  idempotencyKey: ({ attemptNumber, deliveryId }) => `${deliveryId}:${attemptNumber}`,
});

export type DeliverWebhookInput = Schema.Struct.Type<typeof DeliverWebhook.payload>;

/**
 * Re-dispatches webhook deliveries whose driving workflow was lost — rows a
 * crash left `Pending`/`InProgress`, or `Failed` rows whose retry never woke
 * up. Delivery inserts and workflow dispatch are not transactional, so this
 * sweep is the drain of last resort.
 */
export const WebhookDeliverySweep = Workflow.define({
  name: "WebhookDeliverySweepWorkflow",
  payload: { runId: Schema.String },
  success: Schema.Struct({
    candidateCount: Schema.Number,
    redispatchedCount: Schema.Number,
  }),
  idempotencyKey: ({ runId }) => runId,
});

/** Refreshes the durable foreign-exchange rate cache. */
export const FxRateSync = Workflow.define({
  name: "FxRateSyncWorkflow",
  payload: { runId: Schema.String },
  success: Schema.Struct({ refreshedCount: Schema.Number }),
  idempotencyKey: ({ runId }) => runId,
});

/** Drains durable purchase-ledger rows into analytics ingestion. */
export const PurchaseLedgerDrain = Workflow.define({
  name: "PurchaseLedgerDrainWorkflow",
  payload: { runId: Schema.String },
  success: Schema.Struct({
    batches: Schema.Number,
    claimedCount: Schema.Number,
    deadLetteredCount: Schema.Number,
    publishedCount: Schema.Number,
    retriedCount: Schema.Number,
    staleClaimsReleased: Schema.Number,
  }),
  idempotencyKey: ({ runId }) => runId,
});

/** Requeues transient purchase-ledger dead letters and records backlog health. */
export const PurchaseLedgerSweep = Workflow.define({
  name: "PurchaseLedgerSweepWorkflow",
  payload: { runId: Schema.String },
  success: Schema.Struct({
    deadLetterCount: Schema.Number,
    oldestOverdueAgeSeconds: Schema.Number,
    oldestPendingAgeSeconds: Schema.Number,
    overduePendingCount: Schema.Number,
    pendingCount: Schema.Number,
    requeuedCount: Schema.Number,
    transientCandidateCount: Schema.Number,
  }),
  idempotencyKey: ({ runId }) => runId,
});

/** Retries parked provider events whose product or transaction dependency now exists. */
export const PendingRevenueReplaySweep = Workflow.define({
  name: "PendingRevenueReplaySweepWorkflow",
  payload: { runId: Schema.String },
  success: Schema.Struct({
    appliedCount: Schema.Number,
    candidateCount: Schema.Number,
    failedCount: Schema.Number,
    totalParked: Schema.Number,
  }),
  idempotencyKey: ({ runId }) => runId,
});

/** Expires App Store notifications that outlive the SDK-confirmation window. */
export const AppStoreExpireParkedNotifications = Workflow.define({
  name: "AppStoreExpireParkedNotificationsWorkflow",
  payload: { triggeredAt: Schema.String },
  success: Schema.Struct({ expired: Schema.Number }),
  idempotencyKey: ({ triggeredAt }) => triggeredAt,
});

/** Replays App Store notifications after a product mapping is created. */
export const AppStoreReplayParkedNotifications = Workflow.define({
  name: "AppStoreReplayParkedNotificationsWorkflow",
  payload: replayPayload,
  success: replayResult,
  idempotencyKey: ({ paymentProviderConfigurationId, paymentProviderProductId, requestedAt }) =>
    `${paymentProviderConfigurationId}:${paymentProviderProductId}:${requestedAt}`,
});

export type AppStoreReplayParkedNotificationsInput = Schema.Struct.Type<
  typeof AppStoreReplayParkedNotifications.payload
>;

/** Replays App Store notifications after the SDK confirms a transaction series. */
export const AppStoreReplayParkedSdkNotifications = Workflow.define({
  name: "AppStoreReplayParkedSdkNotificationsWorkflow",
  payload: {
    originalTransactionId: Schema.String,
    paymentProviderConfigurationId: Schema.String,
    requestedAt: Schema.String,
  },
  success: replayResult,
  idempotencyKey: ({ originalTransactionId, paymentProviderConfigurationId, requestedAt }) =>
    `${paymentProviderConfigurationId}:${originalTransactionId}:${requestedAt}`,
});

/** Reconciles an App Store transaction series against Apple's history. */
export const AppStoreReconcileOriginalTransaction = Workflow.define({
  name: "AppStoreReconcileOriginalTransactionWorkflow",
  payload: {
    originalTransactionId: Schema.String,
    paymentProviderConfigurationId: Schema.String,
    reason: Schema.Literals(["first_seen", "admin_repair", "install_backfill"]),
    triggeredAt: Schema.String,
  },
  success: Schema.Struct({
    eventsApplied: Schema.Number,
    eventsFailed: Schema.Number,
    eventsSkippedIdempotent: Schema.Number,
    statusesProcessed: Schema.Number,
    transactionsProcessed: Schema.Number,
  }),
  idempotencyKey: ({ originalTransactionId, paymentProviderConfigurationId, triggeredAt }) =>
    `${paymentProviderConfigurationId}:${originalTransactionId}:${triggeredAt}`,
});

/** Replays Google Play notifications after a product mapping is created. */
export const GooglePlayReplayParkedNotifications = Workflow.define({
  name: "GooglePlayReplayParkedNotificationsWorkflow",
  payload: replayPayload,
  success: replayResult,
  idempotencyKey: ({ paymentProviderConfigurationId, paymentProviderProductId, requestedAt }) =>
    `${paymentProviderConfigurationId}:${paymentProviderProductId}:${requestedAt}`,
});

/** Replays Stripe events after a product mapping is created. */
export const StripeReplayParkedNotifications = Workflow.define({
  name: "StripeReplayParkedNotificationsWorkflow",
  payload: replayPayload,
  success: replayResult,
  idempotencyKey: ({ paymentProviderConfigurationId, paymentProviderProductId, requestedAt }) =>
    `${paymentProviderConfigurationId}:${paymentProviderProductId}:${requestedAt}`,
});
