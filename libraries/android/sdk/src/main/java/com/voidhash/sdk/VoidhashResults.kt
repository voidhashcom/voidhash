package com.voidhash.sdk

import com.voidhash.sdk.api.VoidhashPerson

/**
 * A value read from the SDK's local state, with its freshness attached.
 *
 * The SDK answers reads from cache and refreshes behind them, so a caller that needs to
 * know how much to trust a value — an app gating high-value content, for instance — reads
 * these flags rather than guessing from connectivity.
 *
 * @property value the value itself, `null` only when nothing is known.
 * @property isStale the value is past its refresh window; a refresh is under way or queued.
 * @property isExpired the value is past its time to live. Still served, never discarded.
 */
data class Stale<T>(
    val value: T,
    val isStale: Boolean = false,
    val isExpired: Boolean = false,
)

/** Whether a write reached the backend or is queued for delivery. */
enum class WriteStatus {
    /** The backend applied the write. */
    CONFIRMED,

    /** Applied locally and queued; the SDK delivers it when the backend is reachable again. */
    DEFERRED,
}

/**
 * The outcome of a write against the person record.
 *
 * @property status whether the backend has the write yet.
 * @property person the person as the SDK currently knows them; `null` when nothing is known.
 */
data class PersonWriteResult(
    val status: WriteStatus,
    val person: VoidhashPerson?,
)

/**
 * The outcome of syncing a store transaction.
 *
 * @property status [WriteStatus.CONFIRMED] once the backend accepted the receipt.
 * @property accepted whether the backend has recorded it. `false` while deferred.
 */
data class TransactionSyncResult(
    val status: WriteStatus,
    val accepted: Boolean,
)

/** Outcome of presenting a paywall. */
enum class PaywallStatus {
    /** The paywall was presented. */
    SHOWN,

    /** No paywall is configured for the location, or the person is not in a showing group. */
    NOT_ASSIGNED,

    /** A paywall exists but could not be presented: nothing cached and the API is unreachable. */
    UNAVAILABLE,
}
