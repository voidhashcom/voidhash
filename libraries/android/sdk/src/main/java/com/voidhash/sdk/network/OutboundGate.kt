package com.voidhash.sdk.network

import com.voidhash.sdk.VoidhashException
import com.voidhash.sdk.diagnostics.DiagnosticEmitter
import com.voidhash.sdk.diagnostics.VoidhashDiagnosticKind
import java.util.concurrent.atomic.AtomicBoolean

/** How long an authentication pause holds before one recovery probe is allowed. */
const val AUTH_PROBE_INTERVAL_MS = 60_000L

/** Raised instead of a request the circuit breaker refused. Always a retryable condition. */
class VoidhashCircuitOpenException(host: String) : VoidhashException(
    "CIRCUIT_OPEN",
    "Skipped a request to $host: the circuit is open",
)

/** Raised instead of a request made while outbound traffic is paused after a 401/403. */
class VoidhashOutboundPausedException : VoidhashException(
    "AUTHENTICATION_FAILED",
    "Outbound traffic is paused: the publishable key was rejected",
)

/**
 * The single decision point for whether an outbound request may be made.
 *
 * Two independent conditions close the gate. The circuit breaker closes it per host during
 * an outage, and recovers on its own. An authentication failure pauses the whole process and
 * admits one recovery probe after a minute. Queues are kept on disk either way, so nothing is
 * lost while the key or edge authentication recovers.
 *
 * Every [acquire] or [tryAcquire] must be paired with exactly one of [recordSuccess],
 * [recordRetryableFailure] or [release], the last of which belongs in a `finally`.
 */
class OutboundGate(
    val breaker: CircuitBreaker,
    private val diagnostics: DiagnosticEmitter = DiagnosticEmitter(),
    private val clock: SdkClock = SystemSdkClock,
) {
    private val authLock = Any()
    private val authReported = AtomicBoolean(false)
    private var pausedAt: Long? = null
    private var lastProbeAt: Long? = null
    private var probeInFlight = false
    private var probePermitAvailable = false

    /** Whether outbound traffic is paused because the publishable key was rejected. */
    val isPaused: Boolean get() = synchronized(authLock) { pausedAt != null }

    private fun claimAuthPermission(authenticationProbe: Boolean): Boolean = synchronized(authLock) {
        if (pausedAt == null) return@synchronized true
        if (!authenticationProbe || !probeInFlight || !probePermitAvailable) return@synchronized false
        probePermitAvailable = false
        true
    }

    /** Acquires permission to reach [host], or throws describing why it was refused. */
    fun acquire(
        host: String,
        operation: String,
        authenticationProbe: Boolean = false,
    ): CircuitPermit {
        if (!claimAuthPermission(authenticationProbe)) throw VoidhashOutboundPausedException()
        return breaker.acquire(host, operation) ?: throw VoidhashCircuitOpenException(host)
    }

    /** Acquires permission to reach [host], or returns `null` when it was refused. */
    fun tryAcquire(
        host: String,
        operation: String,
        authenticationProbe: Boolean = false,
    ): CircuitPermit? {
        if (!claimAuthPermission(authenticationProbe)) return null
        return breaker.acquire(host, operation)
    }

    /**
     * Whether a request to [host] would certainly be refused.
     *
     * Consumes no probe. A half-open host is *not* blocked: it is exactly the moment a
     * request is worth making, because the one probe the breaker grants is how the circuit
     * closes again. Only a fully open circuit — which includes a host whose probe is
     * currently in flight — and a paused key report as blocked.
     */
    fun isBlocked(host: String): Boolean =
        isPaused || breaker.state(host) == CircuitState.OPEN

    /** Records a completed request. */
    fun recordSuccess(permit: CircuitPermit?) {
        breaker.recordSuccess(permit)
        endAuthProbe(succeeded = true)
    }

    /** Records a retryable transport failure. */
    fun recordRetryableFailure(permit: CircuitPermit?, operation: String) {
        breaker.recordFailure(permit, operation)
        endAuthProbe(succeeded = false)
    }

    /** Hands an unsettled permit back without a verdict; safe to call unconditionally. */
    fun release(permit: CircuitPermit?) {
        breaker.release(permit)
        endAuthProbe(succeeded = false)
    }

    /** Releases a permit after a non-authentication response proved the key is accepted. */
    fun recordAuthenticatedResponse(permit: CircuitPermit?) {
        breaker.release(permit)
        endAuthProbe(succeeded = true)
    }

    /**
     * Pauses outbound traffic after a 401/403 and reports it once per pause.
     *
     * Deliberately does not count against the breaker: an authentication failure is a
     * definitive answer from a healthy server, not evidence of an outage. The permit is
     * released rather than settled as a failure.
     */
    fun recordAuthFailure(permit: CircuitPermit?, status: Int, operation: String, message: String) {
        breaker.release(permit)
        synchronized(authLock) {
            if (pausedAt == null) pausedAt = clock.now()
            probeInFlight = false
            probePermitAvailable = false
        }
        if (authReported.compareAndSet(false, true)) {
            diagnostics.emit(
                VoidhashDiagnosticKind.AUTH,
                code = "AUTHENTICATION_FAILED",
                operation = operation,
                retryable = false,
                httpStatus = status,
                message = "$message. Outbound Voidhash traffic is paused for this process; " +
                    "queued data is kept.",
            )
        }
    }

    /**
     * Signals that the network environment changed (app foregrounded, connectivity
     * restored). Open breakers become half-open so the next call probes the host.
     */
    fun onNetworkChanged() {
        breaker.halfOpenAll()
    }

    /** Starts one authentication probe once the pause interval has elapsed. */
    fun beginAuthProbe(): Boolean = synchronized(authLock) {
        val pausedSince = pausedAt ?: return@synchronized false
        if (probeInFlight) return@synchronized false
        val since = lastProbeAt ?: pausedSince
        if (clock.now() - since < AUTH_PROBE_INTERVAL_MS) return@synchronized false
        probeInFlight = true
        probePermitAvailable = true
        lastProbeAt = clock.now()
        true
    }

    /** Completes the authentication probe; success reopens every outbound plane. */
    fun endAuthProbe(succeeded: Boolean) {
        synchronized(authLock) {
            if (!probeInFlight) return
            probeInFlight = false
            probePermitAvailable = false
            if (succeeded) {
                pausedAt = null
                lastProbeAt = null
                authReported.set(false)
            } else {
                lastProbeAt = clock.now()
            }
        }
    }
}
