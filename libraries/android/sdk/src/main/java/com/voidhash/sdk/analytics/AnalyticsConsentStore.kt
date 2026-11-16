package com.voidhash.sdk.analytics

import com.voidhash.sdk.AnalyticsConsent
import com.voidhash.sdk.cache.CacheManager

/**
 * Cache key of the end user's analytics consent. Outside the `voidhash:analytics:` keys, which
 * hold analytics state that withdrawing consent deletes.
 */
internal const val ANALYTICS_CONSENT_CACHE_KEY = "voidhash:consent:analytics"

/** Cache key present while the granted consent was implied by an identify instead of set by the app. */
internal const val ANALYTICS_CONSENT_IMPLIED_CACHE_KEY = "voidhash:consent:analytics-implied"

/**
 * Owns the analytics consent and its persistence.
 *
 * A consent set at runtime is stored and wins over the configured option on every later launch;
 * resetting the identity keeps it. The stored value can only be read once the cache has warmed
 * up, so until then [current] answers with the configured value, or one set since, and adopts
 * the stored one on the first read after the warm-up.
 *
 * A grant can be marked as implied: made by an identify on the app's behalf
 * ([com.voidhash.sdk.VoidhashOptions.grantConsentOnIdentify]) and taken back when that user signs
 * out. The mark is stored beside the consent, and any consent set without it clears it.
 */
internal class AnalyticsConsentStore(
    private val cacheManager: CacheManager,
    configured: AnalyticsConsent,
) {
    @Volatile
    private var consent = configured

    @Volatile
    private var implied = false

    /** Whether the stored value was adopted, or replaced by one set at runtime. */
    @Volatile
    private var settled = false

    /** The consent in effect. */
    val current: AnalyticsConsent
        get() {
            settle()
            return consent
        }

    val isGranted: Boolean get() = current == AnalyticsConsent.GRANTED

    /** Whether the consent in effect is a grant an identify implied. */
    val isImplied: Boolean
        get() {
            settle()
            return implied
        }

    /**
     * Switches to [next] and stores it; returns the consent in effect before. [implied] marks a
     * grant an identify made.
     */
    @Synchronized
    fun set(next: AnalyticsConsent, implied: Boolean = false): AnalyticsConsent {
        settle()
        val previous = consent
        consent = next
        if (this.implied != implied) {
            this.implied = implied
            if (implied) {
                cacheManager.set(ANALYTICS_CONSENT_IMPLIED_CACHE_KEY, true)
            } else {
                cacheManager.delete(ANALYTICS_CONSENT_IMPLIED_CACHE_KEY)
            }
        }
        // Written before the warm-up, the value is in memory first and the warm-up keeps it.
        settled = true
        cacheManager.set(ANALYTICS_CONSENT_CACHE_KEY, next.wireValue)
        return previous
    }

    private fun settle() {
        if (settled || !cacheManager.isWarm) return
        synchronized(this) {
            if (settled) return
            cacheManager.getString(ANALYTICS_CONSENT_CACHE_KEY)
                ?.let { AnalyticsConsent.fromWireValue(it.value) }
                ?.let { consent = it }
            implied = consent == AnalyticsConsent.GRANTED && cacheManager.get(ANALYTICS_CONSENT_IMPLIED_CACHE_KEY) != null
            settled = true
        }
    }
}
