import type { WorkflowRegistration } from "@voidhash/platform/WorkflowRegistration";

import type { AnalyticsDelivery } from "@voidhash/core-v2";
import type { Db } from "@voidhash/db";
import { AppStoreExpireParkedNotificationsRegistration } from "./AppStoreExpireParkedNotifications.ts";
import { AppStoreReconcileOriginalTransactionRegistration } from "./AppStoreReconcileOriginalTransaction.ts";
import { AppStoreReplayParkedNotificationsRegistration } from "./AppStoreReplayParkedNotifications.ts";
import { AppStoreReplayParkedSdkNotificationsRegistration } from "./AppStoreReplayParkedSdkNotifications.ts";
import { DeliverWebhookRegistration } from "./DeliverWebhook.ts";
import { FxRateSyncRegistration } from "./FxRateSync.ts";
import { GooglePlayReplayParkedNotificationsRegistration } from "./GooglePlayReplayParkedNotifications.ts";
import { PurchaseLedgerDrainRegistration } from "./PurchaseLedgerDrain.ts";
import { PendingRevenueReplaySweepRegistration } from "./PendingRevenueReplaySweep.ts";
import { StripeReplayParkedNotificationsRegistration } from "./StripeReplayParkedNotifications.ts";

/** Infrastructure every backend workflow registration may consume. */
export type BackendWorkflowInfra = Db | AnalyticsDelivery;

/** Complete backend workflow registry shared by every platform adapter. */
export const backendWorkflows: ReadonlyArray<WorkflowRegistration<BackendWorkflowInfra>> = [
  DeliverWebhookRegistration,
  FxRateSyncRegistration,
  PurchaseLedgerDrainRegistration,
  PendingRevenueReplaySweepRegistration,
  AppStoreExpireParkedNotificationsRegistration,
  AppStoreReplayParkedNotificationsRegistration,
  AppStoreReplayParkedSdkNotificationsRegistration,
  AppStoreReconcileOriginalTransactionRegistration,
  GooglePlayReplayParkedNotificationsRegistration,
  StripeReplayParkedNotificationsRegistration,
];
