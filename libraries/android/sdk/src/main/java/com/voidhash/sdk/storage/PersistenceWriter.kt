package com.voidhash.sdk.storage

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.concurrent.atomic.AtomicBoolean

/**
 * The SDK's single writer thread.
 *
 * Two properties matter here. Nothing the SDK persists ever happens on the thread that
 * called into it — a `capture` on the UI thread must not wait on a file — and writes to one
 * store are strictly ordered, so an append can never be overtaken by an older full-file
 * snapshot from a concurrent compaction.
 *
 * Work is accepted from any thread and drained in submission order on [dispatcher]. Once
 * [scope] is cancelled the writer closes: whatever was still queued runs on [dispatcher], and
 * later work runs inline on the caller, so nothing submitted is ever left unfinished and no
 * caller waits on a writer that is gone.
 *
 * @param after the writer of a client being replaced over the same files. Nothing queued here
 *   runs until that one has closed and finished its queue, so the first read of a store sees
 *   every write the previous client made.
 */
class PersistenceWriter(
    scope: CoroutineScope,
    dispatcher: CoroutineDispatcher = Dispatchers.IO,
    after: PersistenceWriter? = null,
    private val onError: (Throwable) -> Unit = {},
) {
    // A task handed to the waiting consumer just as [scope] is cancelled never reaches it: the
    // channel hands it back here instead, on [dispatcher], before the consumer stops and `close`
    // drains the tasks queued behind it. Running it now keeps both the task and the order.
    private val tasks = Channel<Task>(Channel.UNLIMITED, onUndeliveredElement = ::runRemaining)
    private val closed = AtomicBoolean(false)
    private val finished = CompletableDeferred<Unit>()

    /** Cleared once waited for, so a chain of replaced clients is never kept alive. */
    @Volatile
    private var predecessor: PersistenceWriter? = after

    private class Task(val block: () -> Unit, val done: CompletableDeferred<Unit>)

    init {
        // Started atomically, so the consumer runs even when the scope is already cancelled and
        // the queue always drains on [dispatcher], never on the thread that cancelled the scope.
        val consumer = scope.launch(dispatcher, start = CoroutineStart.ATOMIC) {
            // A client replaced in turn while it waits must still write after its predecessor.
            withContext(NonCancellable) { predecessor?.finished?.await() }
            predecessor = null
            for (task in tasks) run(task)
        }
        // The loop ends on cancellation with tasks still buffered; they run in `close`.
        consumer.invokeOnCompletion { close() }
    }

    /** Whether the writer thread has stopped; from then on every task runs inline. */
    val isClosed: Boolean get() = closed.get()

    private fun run(task: Task) {
        try {
            task.block()
            task.done.complete(Unit)
        } catch (error: CancellationException) {
            task.done.completeExceptionally(error)
            throw error
        } catch (error: Throwable) {
            // One failing write must not stop the writer; the next one may succeed.
            onError(error)
            task.done.complete(Unit)
        }
    }

    private fun close() {
        if (!closed.compareAndSet(false, true)) return
        tasks.close()
        // Closing first means nothing can be added behind this drain, so every task that
        // was accepted either ran on the writer or runs here.
        while (true) {
            val task = tasks.tryReceive().getOrNull() ?: break
            runRemaining(task)
        }
        finished.complete(Unit)
    }

    /** Runs a task the consumer will not reach. */
    private fun runRemaining(task: Task) {
        try {
            run(task)
        } catch (_: CancellationException) {
            // Already recorded on the task; the remaining ones still deserve a run.
        }
    }

    /**
     * Queues [block] and returns immediately. Once the writer is closed the block runs
     * inline instead, so the caller can still rely on it having happened.
     */
    fun submit(block: () -> Unit) {
        val task = Task(block, CompletableDeferred())
        if (tasks.trySend(task).isFailure) run(task)
    }

    /** Queues [block] and suspends until it has run. */
    suspend fun await(block: () -> Unit) {
        val done = CompletableDeferred<Unit>()
        if (tasks.trySend(Task(block, done)).isFailure) {
            // The writer is gone (the SDK scope was cancelled); the caller asked for this
            // work to be finished, so run it here rather than dropping it silently.
            block()
            return
        }
        done.await()
    }

    /** Suspends until the writer has closed and finished everything it accepted. */
    internal suspend fun awaitFinished() {
        finished.await()
    }

    /** Suspends until everything queued so far has run. */
    suspend fun drain() {
        await {}
    }
}
