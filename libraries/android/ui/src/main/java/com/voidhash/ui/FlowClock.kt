package com.voidhash.ui

import kotlin.math.ceil

/**
 * The flow's time, which a host can hold still: while it is held, nothing in the flow that waits
 * on time moves on (an app call's timeout, a timed step, an animation), and once released it runs
 * on from where it stood, lagging the frame clock by however long it was held. Seconds on the
 * [System.nanoTime] clock that frames and touches run on. Main thread only.
 */
internal class FlowClock(private val now: () -> Double = { System.nanoTime() / 1_000_000_000.0 }) {
    /** When the flow's time was held, on the frame clock; `null` while it runs. */
    private var heldSince: Double? = null

    /** How long the flow's time stood still in all, which it lags the frame clock by. */
    private var offset = 0.0

    /** Whether the flow's time stands still. */
    val isHeld: Boolean get() = heldSince != null

    /** Holds or releases the flow's time; returns whether that changed anything. */
    fun hold(held: Boolean): Boolean {
        if (held == isHeld) return false
        val heldSince = heldSince
        if (held) {
            this.heldSince = now()
        } else if (heldSince != null) {
            offset += now() - heldSince
            this.heldSince = null
        }
        return true
    }

    /** The flow's time of the moment [real] on the frame clock. */
    fun flowTime(real: Double): Double = minOf(real, heldSince ?: real) - offset

    /**
     * How long from now, in milliseconds, until the flow's time reaches [atSeconds]; `null` when
     * it never does: the time is infinite, or the clock is held.
     */
    fun millisUntil(atSeconds: Double): Long? {
        if (!atSeconds.isFinite() || heldSince != null) return null
        return ceil(((atSeconds + offset - now()) * 1000.0).coerceAtLeast(0.0)).toLong()
    }
}
