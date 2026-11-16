package com.voidhash.sdk.network

import android.os.SystemClock
import kotlinx.coroutines.delay
import kotlinx.coroutines.yield

/**
 * How far ahead of the wall clock a stored timestamp may be before the SDK treats it as
 * written under a clock that has since been set back.
 */
internal const val CLOCK_SKEW_TOLERANCE_MS: Long = 5 * 60_000L

/**
 * The SDK's source of time and of delay.
 *
 * Backoff, circuit-breaker windows and cache deadlines all read this, so tests can drive
 * them with virtual time instead of sleeping.
 */
interface SdkClock {
    /** Current epoch millis. Anything persisted is stamped with this. */
    fun now(): Long

    /**
     * Monotonic millis since an arbitrary origin. In-process windows (debounces, breaker and
     * authentication-probe timing) read this, so a wall-clock change cannot stretch them.
     */
    fun elapsed(): Long

    /** Suspends for [millis]; a non-positive duration still yields. */
    suspend fun sleep(millis: Long)
}

/** Production clock: wall time for persisted values, elapsed realtime for windows. */
object SystemSdkClock : SdkClock {
    override fun now(): Long = System.currentTimeMillis()

    override fun elapsed(): Long = SystemClock.elapsedRealtime()

    override suspend fun sleep(millis: Long) {
        // Every retry loop suspends here, so even a zero delay must give cancellation a chance.
        if (millis > 0) delay(millis) else yield()
    }
}
