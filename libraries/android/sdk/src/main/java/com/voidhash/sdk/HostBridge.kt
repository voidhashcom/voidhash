package com.voidhash.sdk

import com.voidhash.sdk.api.FeatureFlag
import com.voidhash.sdk.api.VoidhashPerson
import com.voidhash.sdk.billing.VoidhashTransactionUpdate
import java.util.concurrent.atomic.AtomicLong

/*
 * What a host that wraps the client — the React Native module, which compiles these sources into
 * its own module — needs beyond the public API. Internal, so the bare SDK's surface stays as it is.
 */

/** Why a read answered with the freshness it has. */
internal enum class FreshnessReason {
    /** Confirmed by the server just now, or cached and within its refresh window. */
    FRESH,

    /** Served from cache while its refresh still runs. */
    REFRESH_IN_FLIGHT,

    /** Served from cache because the refresh failed or could not be made. */
    REFRESH_FAILED,

    /** Nothing was ever cached for this identity, and the server did not answer in time. */
    NO_CACHE,
}

/** The person of [distinctId] as read under identity [generation]. */
internal data class PersonState(
    val distinctId: String,
    val generation: Long,
    val person: VoidhashPerson?,
    val isStale: Boolean,
    val isExpired: Boolean,
    val reason: FreshnessReason,
)

/** A flag evaluation of [keys] (every flag when `null`) for [distinctId], under [generation]. */
internal data class FlagsState(
    val distinctId: String,
    val generation: Long,
    val keys: List<String>?,
    val flags: List<FeatureFlag>,
    val isStale: Boolean,
)

/** A state change the client announces to its host, in the order it happened. */
internal sealed class ClientEvent {
    /** The client adopted [distinctId] under [generation]; [previousDistinctId] is empty at start. */
    data class Identity(val distinctId: String, val previousDistinctId: String, val generation: Long) : ClientEvent()

    data class Person(val state: PersonState) : ClientEvent()

    data class Flags(val state: FlagsState) : ClientEvent()

    /** A runtime schema was loaded, injected or fetched, as the server's JSON. */
    data class Schema(val json: String) : ClientEvent()

    data class Consent(val consent: AnalyticsConsent) : ClientEvent()

    /** A purchase completed outside `purchase`, as `transactionUpdates` emits it. */
    data class Transaction(val update: VoidhashTransactionUpdate) : ClientEvent()
}

/**
 * Settings a wrapping host gives the client, beyond [VoidhashOptions].
 *
 * @property sdkName sent as `x-sdk` and `$sdk`: the wrapping SDK, `react-native` for that module.
 * @property sdkVersion sent as `x-sdk-version` and `$sdk_version`: the wrapping SDK's version.
 * @property onEvent receives every [ClientEvent], synchronously where it happened, from
 *   `initialize` on.
 */
internal data class HostSettings(
    val sdkName: String = "android",
    val sdkVersion: String = VOIDHASH_SDK_VERSION,
    val onEvent: ((ClientEvent) -> Unit)? = null,
)

/**
 * The identity generations of the process. Every identity a client adopts takes the next number;
 * the counter never starts over, also not for a later client, so an answer read under an earlier
 * client or identity can always be told from a current one.
 */
internal val identityGenerations = AtomicLong(0)
