package com.voidhash.sdk.network

import com.voidhash.sdk.diagnostics.DiagnosticEmitter
import com.voidhash.sdk.diagnostics.VoidhashDiagnosticKind
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.random.Random

/** How many consecutive retryable failures open a host's breaker. */
private const val FAILURE_THRESHOLD = 5

/** First open window; each consecutive re-open doubles it. */
private const val INITIAL_OPEN_MS = 30_000L

/** Ceiling of the doubling open window. */
private const val MAX_OPEN_MS = 5 * 60_000L

/**
 * How long a half-open probe may hold its slot.
 *
 * Matches the longest request the SDK makes, a flow package download (20 s; API calls are
 * bounded at 10 s): a probe that has not reported by then is not coming back, and leaving the
 * slot claimed would wedge the host in [CircuitState.HALF_OPEN] forever.
 */
internal const val PROBE_TIMEOUT_MS = 20_000L

/** Observable state of one host's breaker. */
enum class CircuitState {
    /** Requests pass through. */
    CLOSED,

    /** Requests are refused; the cache answers instead. */
    OPEN,

    /** One probe request is allowed through to test the host. */
    HALF_OPEN,
}

/**
 * A granted permission to make one request.
 *
 * Every acquired permit must be handed back exactly once — through
 * [CircuitBreaker.recordSuccess], [CircuitBreaker.recordFailure], or [CircuitBreaker.release]
 * from a `finally` — or a half-open host keeps the probe slot claimed and never recovers.
 * Handing the same permit back twice is a no-op.
 */
class CircuitPermit internal constructor(
    internal val host: String,
    internal val isProbe: Boolean,
    internal val acquiredAt: Long,
) {
    internal val settled = AtomicBoolean(false)

    internal fun claim(): Boolean = settled.compareAndSet(false, true)
}

/**
 * Per-host circuit breaker.
 *
 * A host that fails five retryable attempts in a row is skipped entirely for 30 s, so an
 * outage costs one timeout rather than one per call. The window doubles on every
 * consecutive re-open up to five minutes, and each one lasts up to 25 % longer at random, so the
 * devices that lost a host together do not all probe it again in the same instant. App foreground and connectivity-restored
 * half-open the breaker rather than resetting it, so recovery still costs one probe.
 *
 * Authentication failures and other 4xx verdicts never count: they are answers, not outages.
 * A host that answers 429 is also skipped for the pause it asked for; see [throttle].
 *
 * Each outage is reported once: `CIRCUIT_OPEN` when the breaker first opens, and
 * `CIRCUIT_CLOSED` when a request succeeds again. Failed probes in between report nothing. Both
 * are emitted after the host's lock is released, so a diagnostic handler never runs inside it.
 */
class CircuitBreaker(
    private val clock: SdkClock = SystemSdkClock,
    private val diagnostics: DiagnosticEmitter = DiagnosticEmitter(),
    private val probeTimeoutMs: Long = PROBE_TIMEOUT_MS,
    private val random: Random = Random.Default,
) {
    private class HostState {
        var consecutiveFailures: Int = 0
        var openUntil: Long = 0L
        var openWindowMs: Long = INITIAL_OPEN_MS
        var probeStartedAt: Long? = null

        /** Until when the host asked to be left alone; see [throttle]. */
        var throttledUntil: Long = 0L

        /** Set from the moment the breaker opens until a success closes it again. */
        var outageReported: Boolean = false
    }

    private val hosts = ConcurrentHashMap<String, HostState>()

    /** The breaker state [host] is currently in. */
    fun state(host: String): CircuitState {
        val entry = hosts[host] ?: return CircuitState.CLOSED
        return synchronized(entry) { stateLocked(entry) }
    }

    /**
     * Asks for permission to reach [host], returning `null` when the circuit refuses.
     *
     * In [CircuitState.HALF_OPEN] exactly one caller is granted the probe; the rest are
     * refused until that probe is settled or its timeout elapses.
     */
    fun acquire(host: String): CircuitPermit? {
        val entry = hosts.getOrPut(host) { HostState() }
        return synchronized(entry) {
            when (stateLocked(entry)) {
                CircuitState.CLOSED -> CircuitPermit(host, isProbe = false, acquiredAt = clock.elapsed())
                CircuitState.HALF_OPEN -> {
                    entry.probeStartedAt = clock.elapsed()
                    CircuitPermit(host, isProbe = true, acquiredAt = clock.elapsed())
                }
                CircuitState.OPEN -> null
            }
        }
    }

    /** Records a completed request; closes the breaker and clears the doubling window. */
    fun recordSuccess(permit: CircuitPermit?, operation: String = "network") {
        val entry = permit?.let { hosts[it.host] } ?: return
        if (!permit.claim()) return
        val recovered = synchronized(entry) {
            val wasReported = entry.outageReported
            entry.consecutiveFailures = 0
            entry.openUntil = 0L
            entry.openWindowMs = INITIAL_OPEN_MS
            entry.probeStartedAt = null
            entry.outageReported = false
            wasReported
        }
        if (recovered) {
            diagnostics.emit(
                VoidhashDiagnosticKind.BREAKER,
                code = "CIRCUIT_CLOSED",
                operation = operation,
                message = "Requests to ${permit.host} succeed again; the circuit is closed",
            )
        }
    }

    /** Records a retryable transport failure; opens the breaker once the threshold is reached. */
    fun recordFailure(permit: CircuitPermit?, operation: String = "network") {
        val entry = permit?.let { hosts[it.host] } ?: return
        if (!permit.claim()) return

        val outageStarted = synchronized(entry) {
            entry.probeStartedAt = null
            entry.consecutiveFailures += 1

            // A failed probe re-opens immediately on the doubled window: the host answered
            // the one question the half-open state asked.
            if (permit.isProbe) {
                entry.openWindowMs = minOf(entry.openWindowMs * 2, MAX_OPEN_MS)
                entry.openUntil = clock.elapsed() + withJitter(entry.openWindowMs)
            } else if (entry.consecutiveFailures >= FAILURE_THRESHOLD && entry.openUntil <= clock.elapsed()) {
                entry.openUntil = clock.elapsed() + withJitter(entry.openWindowMs)
            } else {
                return@synchronized false
            }
            if (entry.outageReported) return@synchronized false
            entry.outageReported = true
            true
        }

        if (outageStarted) {
            diagnostics.emit(
                VoidhashDiagnosticKind.BREAKER,
                code = "CIRCUIT_OPEN",
                operation = operation,
                retryable = true,
                message = "Skipping requests to ${permit.host} after $FAILURE_THRESHOLD consecutive " +
                    "failures; the cache answers until a probe succeeds",
            )
        }
    }

    /**
     * Refuses requests to [host] for [cooldownMs], as while its circuit is open: the host answered
     * 429 and asked for the pause. Neither a success nor [halfOpenAll] cuts it short, and it
     * reports nothing; whether the answer also counts as a failure is the caller's to record.
     */
    fun throttle(host: String, cooldownMs: Long) {
        val entry = hosts.getOrPut(host) { HostState() }
        val until = clock.elapsed() + cooldownMs.coerceIn(MIN_RETRY_AFTER_MS, MAX_RETRY_AFTER_MS)
        synchronized(entry) { entry.throttledUntil = maxOf(entry.throttledUntil, until) }
    }

    /**
     * Hands an unreported permit back without a verdict.
     *
     * Cancellation, a bug in the request path, or any throw that is not a transport failure
     * ends here. Nothing is counted — the attempt proved nothing about the host — but the
     * probe slot is freed, which is the whole point of calling this from a `finally`.
     */
    fun release(permit: CircuitPermit?) {
        val entry = permit?.let { hosts[it.host] } ?: return
        if (!permit.claim()) return
        if (!permit.isProbe) return
        synchronized(entry) { entry.probeStartedAt = null }
    }

    /**
     * Moves every open host to [CircuitState.HALF_OPEN].
     *
     * Called on app foreground and on connectivity restored: both are strong evidence the
     * network changed, but neither proves the host recovered, so the next request is still
     * a single probe. A probe that is genuinely still in flight keeps its slot; only one
     * that has outlived [probeTimeoutMs] — and therefore is never reporting back — is
     * cleared, so a wedged host can recover here too.
     */
    fun halfOpenAll() {
        for (entry in hosts.values) {
            synchronized(entry) {
                if (entry.openUntil > clock.elapsed()) entry.openUntil = 0L
                val probeStartedAt = entry.probeStartedAt
                if (probeStartedAt != null && clock.elapsed() - probeStartedAt >= probeTimeoutMs) {
                    entry.probeStartedAt = null
                }
            }
        }
    }

    /** [windowMs] plus a random 0–25 % of it. */
    private fun withJitter(windowMs: Long): Long = windowMs + random.nextLong(windowMs / 4 + 1)

    private fun stateLocked(entry: HostState): CircuitState = when {
        entry.throttledUntil > clock.elapsed() -> CircuitState.OPEN
        entry.consecutiveFailures < FAILURE_THRESHOLD -> CircuitState.CLOSED
        entry.openUntil > clock.elapsed() -> CircuitState.OPEN
        // A probe whose timeout has elapsed is gone; its slot goes back to the next caller.
        entry.probeStartedAt?.let { clock.elapsed() - it < probeTimeoutMs } == true -> CircuitState.OPEN
        else -> CircuitState.HALF_OPEN
    }
}
