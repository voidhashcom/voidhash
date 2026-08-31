import type { WorkflowRegistration } from "@voidhash/platform/WorkflowRegistration";

import type {
  FxRateSource,
  FxRateStore,
  PurchaseLedgerStore,
  PurchaseStateStore,
  RevenueEventSink,
} from "@voidhash/core-v2";
import {
  PurchaseLedgerDrainRegistration,
  PurchaseLedgerSweepRegistration,
} from "@voidhash/core-v2";
import type { Db } from "@voidhash/db";
import { DeliverWebhookRegistration } from "@voidhash/core/workflows/DeliverWebhook";
import { WebhookDeliverySweepRegistration } from "@voidhash/core/workflows/WebhookDeliverySweep";
import { AppStoreExpireParkedNotificationsRegistration } from "./AppStoreExpireParkedNotifications.ts";
import { AppStoreReconcileOriginalTransactionRegistration } from "./AppStoreReconcileOriginalTransaction.ts";
import { AppStoreReplayParkedNotificationsRegistration } from "./AppStoreReplayParkedNotifications.ts";
import { AppStoreReplayParkedSdkNotificationsRegistration } from "./AppStoreReplayParkedSdkNotifications.ts";
import { FxRateSyncRegistration } from "./FxRateSync.ts";
import { GooglePlayReplayParkedNotificationsRegistration } from "./GooglePlayReplayParkedNotifications.ts";
import { PendingRevenueReplaySweepRegistration } from "./PendingRevenueReplaySweep.ts";
import { StripeReplayParkedNotificationsRegistration } from "./StripeReplayParkedNotifications.ts";

/** Infrastructure every backend workflow registration may consume. */
export type BackendWorkflowInfra =
  | Db
  | FxRateSource
  | FxRateStore
  | PurchaseLedgerStore
  | PurchaseStateStore
  | RevenueEventSink;

/** Complete backend workflow registry shared by every platform adapter. */
export const backendWorkflows: ReadonlyArray<WorkflowRegistration<BackendWorkflowInfra>> = [
  DeliverWebhookRegistration,
  WebhookDeliverySweepRegistration,
  FxRateSyncRegistration,
  PurchaseLedgerDrainRegistration,
  PurchaseLedgerSweepRegistration,
  PendingRevenueReplaySweepRegistration,
  AppStoreExpireParkedNotificationsRegistration,
  AppStoreReplayParkedNotificationsRegistration,
  AppStoreReplayParkedSdkNotificationsRegistration,
  AppStoreReconcileOriginalTransactionRegistration,
  GooglePlayReplayParkedNotificationsRegistration,
  StripeReplayParkedNotificationsRegistration,
];
