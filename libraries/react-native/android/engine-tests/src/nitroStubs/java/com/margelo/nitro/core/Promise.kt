package com.margelo.nitro.core

import kotlinx.coroutines.CompletableDeferred

/** JVM stand-in for Nitro's JNI-backed `Promise`, with the members the hybrids use. */
class Promise<T> {
    private val deferred = CompletableDeferred<T>()

    fun resolve(result: T) {
        deferred.complete(result)
    }

    fun reject(error: Throwable) {
        deferred.completeExceptionally(error)
    }

    suspend fun await(): T = deferred.await()

    /** For tests: whether the promise settled yet. */
    val isSettled: Boolean get() = deferred.isCompleted
}
