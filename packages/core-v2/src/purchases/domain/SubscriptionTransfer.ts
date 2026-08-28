import { Schema } from "effect";

/**
 * Transfer-mode policy for cross-owner entitlement transfers.
 *
 * When an App Store transaction is restored under a different identified
 * person than the one currently bound to its `originalTransactionId`, this
 * mode — stored per payment-provider configuration inside the configuration
 * JSON blob — decides what happens to the existing subscription /
 * non-consumable purchase:
 *
 * - `transfer_to_new_owner` — move ownership to the restoring person and
 *   revoke the previous owner's entitlement. The default and recommended
 *   mode.
 * - `keep_with_previous_owner` — leave ownership untouched; the restoring
 *   person gets no entitlement.
 * - `transfer_if_no_active_on_target` — transfer only when the restoring
 *   person has no active entitlement of their own, avoiding duplicates.
 *
 * Defined as string literals (not numeric) because the value is persisted
 * inside a human-edited JSON config blob, where readability matters.
 */
export const SubscriptionTransferMode = Schema.Literals([
  "transfer_to_new_owner",
  "keep_with_previous_owner",
  "transfer_if_no_active_on_target",
]);

/**
 * Effective mode applied when a payment-provider configuration predates the
 * optional `subscriptionTransferMode` field (every configuration row created
 * before this feature shipped omits it).
 */
export const DEFAULT_SUBSCRIPTION_TRANSFER_MODE: typeof SubscriptionTransferMode.Type =
  "transfer_to_new_owner";
