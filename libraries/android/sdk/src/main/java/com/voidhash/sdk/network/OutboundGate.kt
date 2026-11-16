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

/** Raised instead of a request made while outbound traffic is paused after the API rejected the key. */
class VoidhashOutboundPausedException : VoidhashException(
    "AUTHENTICATION_FAILED",
    "Outbound traffic is paused: the publishable key was rejected",
)

/**
 * The single decision point for whether an outbound request may be made.
 *
 * Two independent conditions close the gate. The circuit breaker closes it per host during
 * an outage or after a 429, and recovers on its own. An authentication failure — the API's own
 * tagged 401/403, never an edge's — pauses every host and admits one recovery probe a minute
 * until one succeeds. Queues are kept on disk either way, so nothing is lost meanwhile.
 *
 * Every [acquire] or [tryAcquire] must be paired with exactly one of the `record…` functions or
 * [release], the last of which belongs in a `finally`.
 *
 * @param networkAvailable whether the device has an active network. A request that fails while
 *   it has none says nothing about the host, so it does not count towards opening the circuit.
 */
class OutboundGate(
    val breaker: CircuitBreaker,
    private val diagnostics: DiagnosticEmitter = DiagnosticEmitter(),
    private val clock: SdkClock = SystemSdkClock,
    private val networkAvailable: () -> Boolean = { true },
) {
    private val authLock = Any()
    private val authReported = AtomicBoolean(false)
    private var pausedAt: Long? = null
    private var lastProbeAt: Long? = null
    private var probeInFlight = false
    private var probePermitAvailable = false

    /** Whether a read failed for this pause already; see [takeUnsurfacedAuthFailure]. */
    private var pauseSurfaced = false

    /** Whether outbound traffic is paused because the publishable key was rejected. */
    val isPaused: Boolean get() = synchronized(authLock) { pausedAt != null }

    private fun claimAuthPermission(authenticationProbe: Boolean): Boolean = synchronized(authLock) {
        if (pausedAt == null) return@synchronized true
        if (!authenticationProbe || !probeInFlight || !probePermitAvailable) return@synchronized false
        probePermitAvailable = false
        true
    }

    /** Acquires permission to reach [host], or throws describing why it was refused. */
    fun acquire(host: String, authenticationProbe: Boolean = false): CircuitPermit {
        if (!claimAuthPermission(authenticationProbe)) throw VoidhashOutboundPausedException()
        return breaker.acquire(host) ?: throw VoidhashCircuitOpenException(host)
    }

    /** Acquires permission to reach [host], or returns `null` when it was refused. */
    fun tryAcquire(host: String, authenticationProbe: Boolean = false): CircuitPermit? {
        if (!claimAuthPermission(authenticationProbe)) return null
        return breaker.acquire(host)
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

    /** Records a completed request; [operation] names it if this closes an open circuit. */
    fun recordSuccess(permit: CircuitPermit?, operation: String = "network") {
        breaker.recordSuccess(permit, operation)
        endAuthProbe(succeeded = true)
        keyAccepted()
    }

    /** Records a retryable transport failure; one made without a network is handed back uncounted. */
    fun recordRetryableFailure(permit: CircuitPermit?, operation: String) {
        recordHostFailure(permit, operation)
        endAuthProbe(succeeded = false)
    }

    /**
     * Records a 429: the host asked for a pause, so requests to it are refused for [retryAfterMs],
     * or [DEFAULT_THROTTLE_COOLDOWN_MS] when it named none, as while its circuit is open. It counts
     * as a failure too, so a host that keeps throttling is backed off from like any other outage.
     */
    fun recordThrottled(permit: CircuitPermit?, operation: String, retryAfterMs: Long?) {
        permit?.let { breaker.throttle(it.host, retryAfterMs ?: DEFAULT_THROTTLE_COOLDOWN_MS) }
        recordRetryableFailure(permit, operation)
    }

    /**
     * Records a 2xx whose body was not the endpoint's answer. It counts against the host like an
     * outage, as a captive portal answers that way.
     *
     * [jsonObject] says whether the body was a JSON object. Only the API answers a request with
     * one, having accepted its key, so an authentication probe then ends as one that got through.
     * Any other body — a proxy's or maintenance page, nothing, a JSON array or scalar — is no
     * word from the API about the key: the pause is left to the next probe, or every queue would
     * drain into that page until the API's next refusal paused them again.
     */
    fun recordUnreadableAnswer(permit: CircuitPermit?, operation: String, jsonObject: Boolean) {
        recordHostFailure(permit, operation)
        endAuthProbe(succeeded = jsonObject)
    }

    /**
     * Records a retryable failure of a request that carries no publishable key, such as a flow
     * package download: only its host's breaker learns of it, never an authentication probe.
     */
    fun recordHostFailure(permit: CircuitPermit?, operation: String) {
        if (networkAvailable()) breaker.recordFailure(permit, operation) else breaker.release(permit)
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
        keyAccepted()
    }

    /** An accepted request after [resumeAuth] re-arms the report of the next refusal. */
    private fun keyAccepted() {
        if (isPaused) return
        authReported.set(false)
        if (recoveryUnreported.compareAndSet(true, false)) {
            diagnostics.emit(
                VoidhashDiagnosticKind.AUTH,
                code = "AUTHENTICATION_RECOVERED",
                operation = "client.request",
                message = "The publishable key is accepted again; outbound requests resumed",
            )
        }
    }

    /**
     * Set when [resumeAuth] lifted a pause that was reported: the first accepted request then
     * reports the recovery, as a successful probe does.
     */
    private val recoveryUnreported = AtomicBoolean(false)

    /**
     * Pauses outbound traffic after the API rejected the key, a tagged 401/403, and reports it
     * once per pause.
     *
     * Deliberately does not count against the breaker: an authentication failure is a
     * definitive answer from a healthy server, not evidence of an outage. The permit is
     * released rather than settled as a failure.
     */
    fun recordAuthFailure(permit: CircuitPermit?, status: Int, operation: String, message: String) {
        breaker.release(permit)
        recoveryUnreported.set(false)
        synchronized(authLock) {
            if (pausedAt == null) {
                pausedAt = clock.elapsed()
                pauseSurfaced = false
            }
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
                message = "$message. Outbound Voidhash traffic is paused until a probe, at most " +
                    "once a minute, succeeds; queued data is kept.",
            )
        }
    }

    /**
     * Whether a read with nothing cached should fail with `AUTHENTICATION_FAILED`: true for the
     * first such read of each pause, so a rejected key cannot pass for an end user who owns
     * nothing, while every later read answers as it would offline.
     */
    fun takeUnsurfacedAuthFailure(): Boolean = synchronized(authLock) {
        if (pausedAt == null || pauseSurfaced) return@synchronized false
        pauseSurfaced = true
        true
    }

    /**
     * Signals that the network environment changed (app foregrounded, connectivity
     * restored). Open breakers become half-open so the next call probes the host.
     */
    fun onNetworkChanged() {
        breaker.halfOpenAll()
    }

    /**
     * Lifts an authentication pause without waiting for its probe, for an identity change: the app
     * acting on a new identity is reason enough to try the key again. Should it still be refused,
     * the next request pauses traffic again without a second `AUTHENTICATION_FAILED`.
     */
    fun resumeAuth() {
        synchronized(authLock) {
            if (pausedAt != null && authReported.get()) recoveryUnreported.set(true)
            pausedAt = null
            lastProbeAt = null
            probeInFlight = false
            probePermitAvailable = false
        }
    }

    /** Starts one authentication probe once the pause interval has elapsed. */
    fun beginAuthProbe(): Boolean = synchronized(authLock) {
        val pausedSince = pausedAt ?: return@synchronized false
        if (probeInFlight) return@synchronized false
        val since = lastProbeAt ?: pausedSince
        if (clock.elapsed() - since < AUTH_PROBE_INTERVAL_MS) return@synchronized false
        probeInFlight = true
        probePermitAvailable = true
        lastProbeAt = clock.elapsed()
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
                lastProbeAt = clock.elapsed()
            }
        }
    }
}
