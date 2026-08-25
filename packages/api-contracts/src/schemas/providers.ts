import { Schema } from "effect";

import { PageParams } from "../Pagination.ts";

// ========================================================
// Payment provider configurations
// ========================================================

/**
 * Read shape of a payment-provider configuration.
 *
 * The stored `configuration` blob holds provider credentials (Apple PKCS8
 * keys, Stripe secret keys, Google service-account JSON) and is therefore
 * NEVER returned. Callers get the non-secret row metadata plus
 * `configurationPresence` — one `has<Field>` boolean per configuration field,
 * so a dashboard can render "configured / not configured" without the value
 * ever leaving the server.
 */
export const PaymentProviderConfigurationDetail = Schema.Struct({
  activeProviderId: Schema.NullOr(Schema.String),
  configurationPresence: Schema.Record(Schema.String, Schema.Boolean),
  createdAt: Schema.NullOr(Schema.Date),
  enabled: Schema.Boolean,
  id: Schema.String,
  name: Schema.String,
  paymentProviderKey: Schema.String,
  projectId: Schema.String,
  providerId: Schema.String,
  updatedAt: Schema.NullOr(Schema.Date),
});

export type PaymentProviderConfigurationDetail = typeof PaymentProviderConfigurationDetail.Type;

/** Query for `GET /payment-provider-configurations`. */
export const ListPaymentProviderConfigurationsQuery = Schema.Struct({
  ...PageParams.fields,
  projectId: Schema.optional(Schema.String),
  providerId: Schema.optional(Schema.String),
}).annotate({ identifier: "ListPaymentProviderConfigurationsQuery" });

/**
 * Body for `POST /payment-provider-configurations`. Only the provider is
 * chosen at creation time; credentials are supplied by a follow-up `PATCH`,
 * mirroring the dashboard flow.
 */
export const CreatePaymentProviderConfigurationBody = Schema.Struct({
  projectId: Schema.optional(Schema.String),
  providerId: Schema.String,
}).annotate({ identifier: "CreatePaymentProviderConfigurationBody" });

/**
 * Body for `PATCH /payment-provider-configurations/:configurationId`. Omitted
 * fields keep their stored value; `configuration` is replaced wholesale, and
 * enabling a configuration validates the credentials.
 */
export const UpdatePaymentProviderConfigurationBody = Schema.Struct({
  configuration: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
  enabled: Schema.optional(Schema.Boolean),
  name: Schema.optional(Schema.String),
}).annotate({ identifier: "UpdatePaymentProviderConfigurationBody" });

// ========================================================
// Payment provider products
// ========================================================

/**
 * Read shape of a single provider↔product mapping, including the fields the
 * collection listing cannot supply (`isActive`, `providerProductKey`, and the
 * row timestamps).
 */
export const PaymentProviderProductDetail = Schema.Struct({
  configuration: Schema.Record(Schema.String, Schema.Unknown),
  createdAt: Schema.NullOr(Schema.Date),
  id: Schema.String,
  isActive: Schema.Boolean,
  paymentProviderConfigurationId: Schema.String,
  productId: Schema.String,
  providerProductKey: Schema.String,
  updatedAt: Schema.NullOr(Schema.Date),
});

export type PaymentProviderProductDetail = typeof PaymentProviderProductDetail.Type;

/** Query for `GET /payment-provider-products`. */
export const ListPaymentProviderProductsQuery = Schema.Struct({
  ...PageParams.fields,
  paymentProviderConfigurationId: Schema.optional(Schema.String),
  productId: Schema.optional(Schema.String),
  projectId: Schema.optional(Schema.String),
}).annotate({ identifier: "ListPaymentProviderProductsQuery" });

/** Body for `POST /payment-provider-products`. */
export const CreatePaymentProviderProductBody = Schema.Struct({
  configuration: Schema.Record(Schema.String, Schema.Unknown),
  paymentProviderConfigurationId: Schema.String,
  productId: Schema.String,
}).annotate({ identifier: "CreatePaymentProviderProductBody" });

/** Body for `PATCH /payment-provider-products/:mappingId`. */
export const UpdatePaymentProviderProductBody = Schema.Struct({
  configuration: Schema.Record(Schema.String, Schema.Unknown),
}).annotate({ identifier: "UpdatePaymentProviderProductBody" });

// ========================================================
// Push notification configurations
// ========================================================

/**
 * Read shape of a push-notification (FCM/APNs) configuration. `configuration`
 * is the provider's secret-omitting read DTO — non-secret metadata plus `has*`
 * presence flags — never the service-account JSON or the APNs `.p8`.
 */
export const PushNotificationConfigurationDetail = Schema.Struct({
  activeProviderId: Schema.NullOr(Schema.String),
  configuration: Schema.Record(Schema.String, Schema.Unknown),
  createdAt: Schema.NullOr(Schema.Date),
  deletedAt: Schema.NullOr(Schema.Date),
  enabled: Schema.Boolean,
  id: Schema.String,
  name: Schema.String,
  projectId: Schema.String,
  providerId: Schema.String,
  pushProviderKey: Schema.String,
  updatedAt: Schema.NullOr(Schema.Date),
});

export type PushNotificationConfigurationDetail =
  typeof PushNotificationConfigurationDetail.Type;

/** Query for `GET /push-notification-configurations`. */
export const ListPushNotificationConfigurationsQuery = Schema.Struct({
  ...PageParams.fields,
  projectId: Schema.optional(Schema.String),
  providerId: Schema.optional(Schema.String),
}).annotate({ identifier: "ListPushNotificationConfigurationsQuery" });

/** Body for `POST /push-notification-configurations`. */
export const CreatePushNotificationConfigurationBody = Schema.Struct({
  projectId: Schema.optional(Schema.String),
  providerId: Schema.String,
}).annotate({ identifier: "CreatePushNotificationConfigurationBody" });

/** Body for `PATCH /push-notification-configurations/:configurationId`. */
export const UpdatePushNotificationConfigurationBody = Schema.Struct({
  configuration: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
  enabled: Schema.optional(Schema.Boolean),
  name: Schema.optional(Schema.String),
}).annotate({ identifier: "UpdatePushNotificationConfigurationBody" });

// ========================================================
// Notification send history
// ========================================================

/**
 * A push fan-out record — the parent of one or more per-device deliveries.
 * `message` is PII-at-rest and TTL-purged, so it is `{}` once `messagePurged`
 * is true.
 */
export const PushNotificationSend = Schema.Struct({
  completedAt: Schema.NullOr(Schema.Date),
  createdAt: Schema.Date,
  deviceCount: Schema.Number,
  failedCount: Schema.Number,
  id: Schema.String,
  idempotencyKey: Schema.NullOr(Schema.String),
  message: Schema.Record(Schema.String, Schema.Unknown),
  messagePurged: Schema.Boolean,
  requestedDistinctIdCount: Schema.Number,
  requestedPersonCount: Schema.Number,
  skippedCount: Schema.Number,
  status: Schema.String,
  succeededCount: Schema.Number,
  unresolvedDistinctIds: Schema.Array(Schema.String),
}).annotate({ identifier: "PushNotificationSend" });

export type PushNotificationSend = typeof PushNotificationSend.Type;

/** A single per-(send, device) delivery attempt trail. */
export const PushNotificationDelivery = Schema.Struct({
  attemptCount: Schema.Number,
  completedAt: Schema.NullOr(Schema.Date),
  createdAt: Schema.Date,
  id: Schema.String,
  lastError: Schema.NullOr(Schema.String),
  maxAttempts: Schema.Number,
  nextAttemptAt: Schema.NullOr(Schema.Date),
  personId: Schema.String,
  provider: Schema.String,
  providerMessageId: Schema.NullOr(Schema.String),
  status: Schema.String,
}).annotate({ identifier: "PushNotificationDelivery" });

export type PushNotificationDelivery = typeof PushNotificationDelivery.Type;

/** Query for `GET /notification-sends`. */
export const ListNotificationSendsQuery = Schema.Struct({
  ...PageParams.fields,
  projectId: Schema.optional(Schema.String),
}).annotate({ identifier: "ListNotificationSendsQuery" });

/** Query for `GET /notification-sends/:sendId/deliveries`. */
export const ListNotificationDeliveriesQuery = Schema.Struct({
  ...PageParams.fields,
  projectId: Schema.optional(Schema.String),
  status: Schema.optional(Schema.String),
}).annotate({ identifier: "ListNotificationDeliveriesQuery" });

/** Optional idempotency header accepted by `POST /notifications`. */
export const NotificationIdempotencyHeaders = Schema.Struct({
  "idempotency-key": Schema.optional(Schema.String),
}).annotate({ identifier: "NotificationIdempotencyHeaders" });

// ========================================================
// Development sandbox
// ========================================================

/** Whether the project accepts development-provider (sandbox) purchases. */
export const DevelopmentSettings = Schema.Struct({
  developmentPurchasesEnabled: Schema.Boolean,
}).annotate({ identifier: "DevelopmentSettings" });

export type DevelopmentSettings = typeof DevelopmentSettings.Type;

/** Body for `PATCH /development/settings`. */
export const UpdateDevelopmentSettingsBody = Schema.Struct({
  developmentPurchasesEnabled: Schema.Boolean,
  projectId: Schema.optional(Schema.String),
}).annotate({ identifier: "UpdateDevelopmentSettingsBody" });

/** Query for `GET /development/settings` and `DELETE /development/data`. */
export const DevelopmentProjectQuery = Schema.Struct({
  projectId: Schema.optional(Schema.String),
}).annotate({ identifier: "DevelopmentProjectQuery" });

/** Query for `GET /development/state`; `personId` selects the sandbox subject. */
export const DevelopmentStateQuery = Schema.Struct({
  personId: Schema.String,
  projectId: Schema.optional(Schema.String),
}).annotate({ identifier: "DevelopmentStateQuery" });

const DevelopmentGrant = Schema.Struct({
  expiresAt: Schema.NullOr(Schema.Date),
  id: Schema.String,
  perkId: Schema.String,
  status: Schema.Number,
});

const DevelopmentPurchase = Schema.Struct({
  createdAt: Schema.NullOr(Schema.Date),
  id: Schema.String,
  productId: Schema.String,
  productName: Schema.String,
  productSlug: Schema.String,
  refundedAt: Schema.NullOr(Schema.Date),
  revokedAt: Schema.NullOr(Schema.Date),
});

const DevelopmentSubscription = Schema.Struct({
  canceledAt: Schema.NullOr(Schema.Date),
  expiresAt: Schema.NullOr(Schema.Date),
  gracePeriodExpiresAt: Schema.NullOr(Schema.Date),
  id: Schema.String,
  productId: Schema.String,
  productName: Schema.String,
  productSlug: Schema.String,
  startsAt: Schema.Date,
  status: Schema.Number,
});

/** The full sandbox state for one person: their simulated entitlements. */
export const DevelopmentState = Schema.Struct({
  developmentPurchasesEnabled: Schema.Boolean,
  grants: Schema.Array(DevelopmentGrant),
  purchases: Schema.Array(DevelopmentPurchase),
  subscriptions: Schema.Array(DevelopmentSubscription),
}).annotate({ identifier: "DevelopmentState" });

export type DevelopmentState = typeof DevelopmentState.Type;

/**
 * Body for `POST /development/lifecycle-actions`. `actionId` is the
 * idempotency key: replaying the same id is a no-op rather than a second
 * transition.
 */
export const DevelopmentLifecycleActionBody = Schema.Struct({
  action: Schema.Literals(["expire", "revoke", "renew", "refund", "grace_period"]),
  actionId: Schema.String,
  projectId: Schema.optional(Schema.String),
  targetId: Schema.String,
  targetType: Schema.Literals(["subscription", "purchase"]),
}).annotate({ identifier: "DevelopmentLifecycleActionBody" });

/** Acknowledgement echoing the idempotency key the action was recorded under. */
export const DevelopmentLifecycleActionAccepted = Schema.Struct({
  actionId: Schema.String,
});

export type DevelopmentLifecycleActionAccepted =
  typeof DevelopmentLifecycleActionAccepted.Type;
