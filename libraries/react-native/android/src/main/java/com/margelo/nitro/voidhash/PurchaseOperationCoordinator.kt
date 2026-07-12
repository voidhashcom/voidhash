package com.margelo.nitro.voidhash

internal class PurchaseOperationCoordinator<T> {
    internal data class Handle(val id: Long)

    private data class Pending<T>(
        val handle: Handle,
        val accepts: (Array<T>) -> Boolean,
        val complete: (Result<Array<T>>) -> Unit,
    )

    private var nextId = 0L
    private var pending: Pending<T>? = null

    fun begin(complete: (Result<Array<T>>) -> Unit): Handle =
        begin(accepts = { true }, complete = complete)

    @Synchronized
    fun begin(
        accepts: (Array<T>) -> Boolean,
        complete: (Result<Array<T>>) -> Unit,
    ): Handle {
        check(pending == null) { "PURCHASE_IN_PROGRESS: Another Google Billing purchase is already active" }
        val handle = Handle(++nextId)
        pending = Pending(handle, accepts, complete)
        return handle
    }

    @Synchronized
    fun cancel(handle: Handle) {
        if (pending?.handle == handle) {
            pending = null
        }
    }

    fun fail(error: Throwable): Boolean = complete(Result.failure(error))

    fun succeed(purchases: Array<T>): Boolean {
        val accepted = synchronized(this) {
            val current = pending ?: return false
            current.accepts(purchases)
        }
        return accepted && complete(Result.success(purchases))
    }

    @Synchronized
    fun hasPendingOperation(): Boolean = pending != null

    private fun complete(result: Result<Array<T>>): Boolean {
        val operation = synchronized(this) {
            val current = pending ?: return false
            pending = null
            current
        }
        operation.complete(result)
        return true
    }
}
