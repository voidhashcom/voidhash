export interface PurchaseCorrelationEvidence {
  readonly accountToken?: string;
  readonly environment: "sandbox" | "production";
  readonly installationId: string;
  readonly originalTransactionId?: string;
  readonly personId?: string;
  readonly purchaseToken?: string;
  readonly transactionId?: string;
}

export interface StoreNotificationEvidence {
  readonly accountToken?: string;
  readonly environment: "sandbox" | "production";
  readonly linkedPurchaseToken?: string;
  readonly notificationId: string;
  readonly originalTransactionId?: string;
  readonly provider: "apple" | "google";
  readonly purchaseToken?: string;
  readonly transactionId?: string;
  readonly type: StoreNotificationType;
}

export type StoreNotificationType =
  | "purchased"
  | "renewed"
  | "canceled"
  | "grace-period"
  | "billing-retry"
  | "paused"
  | "resumed"
  | "replaced"
  | "refunded"
  | "revoked"
  | "expired"
  | "prepaid-top-up";

export type NormalizedStoreLifecycleState =
  | "active"
  | "renewed"
  | "canceled"
  | "grace"
  | "billing-retry"
  | "paused"
  | "resumed"
  | "replaced"
  | "refunded"
  | "revoked"
  | "expired"
  | "prepaid";

export type StoreNotificationCorrelation =
  | {
      readonly status: "matched";
      readonly key: "account-token" | "lineage" | "transaction";
      readonly installationId: string;
      readonly personId?: string;
    }
  | { readonly status: "unmatched"; readonly reason: "purchase-evidence-not-found" | "environment-mismatch" };

/** Correlates a decoded store notification using the documented key precedence. */
export const correlateStoreNotification = (
  notification: StoreNotificationEvidence,
  purchases: ReadonlyArray<PurchaseCorrelationEvidence>,
): StoreNotificationCorrelation => {
  const sameEnvironment = purchases.filter(({ environment }) => environment === notification.environment);
  const match = (
    predicate: (purchase: PurchaseCorrelationEvidence) => boolean,
    key: "account-token" | "lineage" | "transaction",
  ): StoreNotificationCorrelation | undefined => {
    const purchase = sameEnvironment.find(predicate);
    return purchase && {
      status: "matched",
      key,
      installationId: purchase.installationId,
      personId: purchase.personId,
    };
  };
  if (notification.accountToken) {
    const correlated = match(({ accountToken }) => accountToken === notification.accountToken, "account-token");
    if (correlated) return correlated;
  }
  const lineage = notification.originalTransactionId ?? notification.linkedPurchaseToken;
  if (lineage) {
    const correlated = match(
      (purchase) => purchase.originalTransactionId === lineage || purchase.purchaseToken === lineage,
      "lineage",
    );
    if (correlated) return correlated;
  }
  const transaction = notification.transactionId ?? notification.purchaseToken;
  if (transaction) {
    const correlated = match(
      (purchase) => purchase.transactionId === transaction || purchase.purchaseToken === transaction,
      "transaction",
    );
    if (correlated) return correlated;
  }
  const crossEnvironment = purchases.some((purchase) =>
    (notification.accountToken && purchase.accountToken === notification.accountToken)
      || (lineage && (purchase.originalTransactionId === lineage || purchase.purchaseToken === lineage))
      || (transaction && (purchase.transactionId === transaction || purchase.purchaseToken === transaction)),
  );
  return { status: "unmatched", reason: crossEnvironment ? "environment-mismatch" : "purchase-evidence-not-found" };
};

/** Normalizes Apple and Google lifecycle notification types into one model. */
export const normalizeStoreLifecycleState = (type: StoreNotificationType): NormalizedStoreLifecycleState => {
  const states: Record<StoreNotificationType, NormalizedStoreLifecycleState> = {
    purchased: "active",
    renewed: "renewed",
    canceled: "canceled",
    "grace-period": "grace",
    "billing-retry": "billing-retry",
    paused: "paused",
    resumed: "resumed",
    replaced: "replaced",
    refunded: "refunded",
    revoked: "revoked",
    expired: "expired",
    "prepaid-top-up": "prepaid",
  };
  return states[type];
};

export interface StoreLifecycleProjection {
  readonly environment: "sandbox" | "production";
  readonly installationId: string;
  readonly notificationId: string;
  readonly personId?: string;
  readonly source: "server-correlation";
  readonly state: NormalizedStoreLifecycleState;
}

/** Projects a matched notification idempotently, or parks it until purchase evidence arrives. */
export const projectStoreNotification = (
  notification: StoreNotificationEvidence,
  purchases: ReadonlyArray<PurchaseCorrelationEvidence>,
  processedNotificationIds: ReadonlySet<string>,
): { readonly status: "projected" | "parked" | "duplicate"; readonly projection?: StoreLifecycleProjection } => {
  if (processedNotificationIds.has(notification.notificationId)) return { status: "duplicate" };
  const correlation = correlateStoreNotification(notification, purchases);
  if (correlation.status === "unmatched") return { status: "parked" };
  return {
    status: "projected",
    projection: {
      environment: notification.environment,
      installationId: correlation.installationId,
      notificationId: notification.notificationId,
      personId: correlation.personId,
      source: "server-correlation",
      state: normalizeStoreLifecycleState(notification.type),
    },
  };
};
