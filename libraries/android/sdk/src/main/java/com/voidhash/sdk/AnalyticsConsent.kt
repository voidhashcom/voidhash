package com.voidhash.sdk

/**
 * Whether the end user agreed to usage analytics: to Voidhash recording what they do.
 *
 * Only [GRANTED] collects analytics. [DENIED] and [PENDING] behave the same: no events, screens or
 * lifecycle events are captured, queued, stored or sent, no install is attributed and an agreement
 * to ad data sharing is not written, unless [VoidhashOptions.analyticsWhilePending] holds the
 * events of a pending consent in memory.
 *
 * What the app says about the end user is not analytics and works in every state:
 * [VoidhashClient.identify], person attributes and groups with their properties. So do purchases,
 * restores, entitlements, feature flags and paywalls.
 */
enum class AnalyticsConsent {
    /** Analytics are collected. */
    GRANTED,

    /** The end user declined analytics. */
    DENIED,

    /** The end user has not decided yet; nothing is collected until they grant consent. */
    PENDING,
    ;

    /** The value sent in the `x-analytics-consent` header and stored on the device. */
    internal val wireValue: String get() = name.lowercase()

    internal companion object {
        fun fromWireValue(value: String): AnalyticsConsent? = entries.firstOrNull { it.wireValue == value }
    }
}

/** What happens to an event captured while the analytics consent is [AnalyticsConsent.PENDING]. */
enum class PendingAnalytics {
    /** The event is not collected. */
    DROP,

    /**
     * The event is held in memory, with the time it happened, and nothing is stored or sent. The
     * 100 most recent events are kept. Granting consent records them, in order and with their own
     * times, for the identity, groups and session in effect then; denying it discards them. Person
     * attributes are not held.
     */
    BUFFER,
}
