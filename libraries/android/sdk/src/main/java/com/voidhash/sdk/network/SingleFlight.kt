package com.voidhash.sdk.network

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive

/**
 * Coalesces concurrent work sharing a key onto one execution.
 *
 * The first caller for a key runs the block; everyone arriving while it is in flight awaits
 * its result. This is what keeps a foreground burst of reads, or a retry after a timeout,
 * from turning into a thundering herd against the same endpoint.
 *
 * A leader that is cancelled does not cancel its followers: cancellation belongs to the
 * leader's coroutine, not to the work. A follower that is itself still active simply takes
 * over and runs the block, so a host read never fails because an unrelated SDK task went away.
 */
class SingleFlight {
    // A monitor rather than a `Mutex`: nothing suspends under it, and the release in the
    // `finally` below must succeed even when the leader has already been cancelled.
    private val inFlight = mutableMapOf<String, CompletableDeferred<Any?>>()

    /** Runs [block] for [key], or joins the run already in flight for it. */
    @Suppress("UNCHECKED_CAST")
    suspend fun <T> run(key: String, block: suspend () -> T): T {
        while (true) {
            val deferred = CompletableDeferred<Any?>()
            val leader = synchronized(inFlight) {
                val raced = inFlight[key]
                if (raced != null) raced else { inFlight[key] = deferred; null }
            }
            if (leader != null) {
                try {
                    return leader.await() as T
                } catch (error: CancellationException) {
                    // Only the leader was cancelled; this caller is still live, so it becomes
                    // the next leader instead of reporting a cancellation it never received.
                    currentCoroutineContext().ensureActive()
                    continue
                }
            }

            try {
                val value = block()
                deferred.complete(value)
                return value
            } catch (error: Throwable) {
                deferred.completeExceptionally(error)
                throw error
            } finally {
                synchronized(inFlight) { inFlight.remove(key) }
            }
        }
    }
}
