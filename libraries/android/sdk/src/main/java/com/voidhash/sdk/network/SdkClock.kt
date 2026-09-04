package com.voidhash.sdk.network

import kotlinx.coroutines.delay

/**
 * The SDK's source of time and of delay.
 *
 * Backoff, circuit-breaker windows and cache deadlines all read this, so tests can drive
 * them with virtual time instead of sleeping.
 */
interface SdkClock {
    /** Current epoch millis. */
    fun now(): Long

    /** Suspends for [millis]. */
    suspend fun sleep(millis: Long)
}

/** Wall-clock implementation used in production. */
object SystemSdkClock : SdkClock {
    override fun now(): Long = System.currentTimeMillis()

    override suspend fun sleep(millis: Long) {
        if (millis > 0) delay(millis)
    }
}
