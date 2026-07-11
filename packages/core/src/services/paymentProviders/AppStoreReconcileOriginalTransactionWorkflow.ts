import { Context, type Effect } from "effect";

import type { ReconciliationReason } from "./appStore/app-store-reconciliation-service.ts";

/**
 * Identifies the App Store `originalTransactionId` series to reconcile against
 * Apple's authoritative transaction history + subscription statuses, and why.
 */
export interface AppStoreReconcileOriginalTransactionInput {
  readonly paymentProviderConfigurationId: string;
  readonly originalTransactionId: string;
  /** ISO-8601 timestamp of when reconciliation was triggered. */
  readonly triggeredAt: string;
  readonly reason: ReconciliationReason;
}

/**
 * Abstract workflow for the lazy first-seen Apple-history backfill. `dispatch`
 * fires from `processSdkTransaction` the first time a tenant (with the
 * `enableFirstSeenReconciliation` flag on) records a purchase for an
 * `originalTransactionId` we have never seen — it imports any history Apple
 * holds that arrived before the SDK boundary (RevenueCat-migrated subscribers,
 * offline-then-reopen, dropped EXPIRED/REFUND). The concrete adapter (a
 * Cloudflare Workflow) is wired at the application root, keeping the
 * infrastructure dependency out of `packages/core`.
 */
export class AppStoreReconcileOriginalTransactionWorkflow extends Context.Service<
  AppStoreReconcileOriginalTransactionWorkflow,
  {
    readonly dispatch: (input: AppStoreReconcileOriginalTransactionInput) => Effect.Effect<void>;
  }
>()("AppStoreReconcileOriginalTransactionWorkflow") {}
