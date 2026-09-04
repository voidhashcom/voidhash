package com.voidhash.sdk.diagnostics

/** Routing category of a [VoidhashDiagnostic], so hosts can branch without matching on codes. */
enum class VoidhashDiagnosticKind {
    /** A network attempt failed, timed out, or was rejected with a retryable status. */
    TRANSPORT,

    /** A queued record was dropped because a bounded store reached its cap. */
    EVICTION,

    /** A circuit breaker opened, probed, or closed. */
    BREAKER,

    /** The publishable key was rejected; outbound traffic is paused for the process. */
    AUTH,

    /** A cache entry could not be read, decoded, or written. */
    CACHE,
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
 * Delivers diagnostics to the host handler.
 *
 * Host code is untrusted here: a handler that throws must never surface inside SDK
 * control flow, so every exception it raises is swallowed.
 */
class DiagnosticEmitter(
    private val handler: ((VoidhashDiagnostic) -> Unit)? = null,
) {
    /** Delivers [diagnostic] to the host handler, if one was installed. */
    fun emit(diagnostic: VoidhashDiagnostic) {
        val target = handler ?: return
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
