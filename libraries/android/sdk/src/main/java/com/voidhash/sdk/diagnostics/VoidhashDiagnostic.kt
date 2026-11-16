package com.voidhash.sdk.diagnostics

import com.voidhash.sdk.cache.fnv1aHex
import java.util.concurrent.Executor
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit

/**
 * Stands in for a user id, purchase token or cache key in log and diagnostic text. The same value
 * always maps to the same eight hex digits, so reports about one receipt or one person can be
 * correlated without the text carrying the identifier; logs end up in bug reports and crash
 * reporters.
 */
internal fun redacted(identifier: String): String = "#" + fnv1aHex(identifier)

/** Routing category of a [VoidhashDiagnostic], so hosts can branch without matching on codes. */
enum class VoidhashDiagnosticKind {
    /** A network attempt failed, timed out, or was rejected with a retryable status. */
    TRANSPORT,

    /** A queued record was dropped because a bounded store reached its cap. */
    EVICTION,

    /** A circuit breaker opened, probed, or closed. */
    BREAKER,

    /**
     * The publishable key was rejected; outbound traffic is paused until a probe, made at most
     * once a minute, is accepted.
     */
    AUTH,

    /**
     * Local storage could not be used: a cache entry could not be read, decoded, or written, the
     * SDK runs in a process that must not share its storage, or the device has not been unlocked
     * since it started.
     */
    CACHE,

    /**
     * Analytics or a person-trait write was skipped because the end user has not granted
     * analytics consent.
     */
    CONSENT,

    /**
     * A store product could not be offered, or what the store reported about it was not
     * understood, such as a product Google Play did not return (`PRODUCT_NOT_FOUND`).
     */
    STORE,
}

/**
 * A structured, non-fatal SDK event delivered to `VoidhashOptions.onDiagnostic`.
 *
 * Diagnostics are informational: each one describes a situation the SDK already handled
 * with a documented fallback. They never represent a failed public API call.
 *
 * @property kind routing category.
 * @property code stable uppercase code, for example `ANALYTICS_EVENT_DROPPED`.
 * @property operation the SDK operation that produced it, for example `analytics.flush`.
 * @property retryable whether the SDK retries on its own.
 * @property httpStatus HTTP status, when the diagnostic came from a response.
 * @property message human readable description.
 */
data class VoidhashDiagnostic(
    val kind: VoidhashDiagnosticKind,
    val code: String,
    val operation: String,
    val retryable: Boolean = false,
    val httpStatus: Int? = null,
    val message: String,
)

/**
 * The thread every configured client delivers its diagnostics on. A single worker keeps them
 * in emission order; it is a daemon and exits after a minute without work.
 */
internal val diagnosticDeliveryExecutor: Executor by lazy {
    ThreadPoolExecutor(0, 1, 60L, TimeUnit.SECONDS, LinkedBlockingQueue()) { runnable ->
        Thread(runnable, "voidhash-diagnostics").apply { isDaemon = true }
    }
}

/** Diagnostics a client holds for a handler that has not taken them yet; the oldest go first. */
internal const val MAX_PENDING_DIAGNOSTICS = 1_000

/**
 * Delivers diagnostics to the host handler.
 *
 * Host code is untrusted here: a handler that throws must never surface inside SDK
 * control flow, so every exception it raises is swallowed.
 *
 * With a [deliveryExecutor] — `Voidhash.configure` installs a single background thread — the
 * handler runs there, in emission order. A diagnostic is often emitted on the host's UI thread or
 * while the SDK holds a lock, and a handler that writes a file or calls back into the SDK must
 * wait on neither. Without one the handler runs inline, on the emitting thread.
 *
 * At most [MAX_PENDING_DIAGNOSTICS] wait for a slow handler. Past that the oldest are dropped, and
 * the handler next receives `DIAGNOSTICS_DROPPED` with their count, so a handler that cannot keep
 * up during an outage costs bounded memory.
 */
class DiagnosticEmitter(
    private val handler: ((VoidhashDiagnostic) -> Unit)? = null,
    private val deliveryExecutor: Executor? = null,
) {
    private val pending = ArrayDeque<VoidhashDiagnostic>()
    private var dropped = 0
    private var draining = false

    /** Delivers [diagnostic] to the host handler, if one was installed. */
    fun emit(diagnostic: VoidhashDiagnostic) {
        val target = handler ?: return
        if (deliveryExecutor == null) {
            deliver(target, diagnostic)
            return
        }
        val startDrain = synchronized(pending) {
            pending.addLast(diagnostic)
            if (pending.size > MAX_PENDING_DIAGNOSTICS) {
                pending.removeFirst()
                dropped += 1
            }
            !draining.also { draining = true }
        }
        if (!startDrain) return
        try {
            deliveryExecutor.execute { drain(target) }
        } catch (_: RejectedExecutionException) {
            // An executor that no longer takes work has no host handler left to reach.
            synchronized(pending) {
                pending.clear()
                draining = false
            }
        }
    }

    private fun drain(target: (VoidhashDiagnostic) -> Unit) {
        while (true) {
            val (next, droppedBefore) = synchronized(pending) {
                val next = pending.removeFirstOrNull()
                if (next == null) {
                    draining = false
                    return
                }
                next to dropped.also { dropped = 0 }
            }
            if (droppedBefore > 0) {
                deliver(
                    target,
                    VoidhashDiagnostic(
                        VoidhashDiagnosticKind.EVICTION,
                        code = "DIAGNOSTICS_DROPPED",
                        operation = "diagnostics.deliver",
                        message = "Dropped $droppedBefore diagnostics the onDiagnostic handler did not " +
                            "take in time",
                    ),
                )
            }
            deliver(target, next)
        }
    }

    private fun deliver(target: (VoidhashDiagnostic) -> Unit, diagnostic: VoidhashDiagnostic) {
        try {
            target(diagnostic)
        } catch (_: Throwable) {
            // A diagnostic is a report about a handled situation; reporting it can never fail one.
        }
    }

    /** Convenience over [emit]. */
    fun emit(
        kind: VoidhashDiagnosticKind,
        code: String,
        operation: String,
        retryable: Boolean = false,
        httpStatus: Int? = null,
        message: String,
    ) {
        emit(VoidhashDiagnostic(kind, code, operation, retryable, httpStatus, message))
    }
}
