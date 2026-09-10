package com.voidhash.sdk.transactions

import com.voidhash.sdk.VoidhashApiException
import com.voidhash.sdk.api.SyncTransactionRequest
import com.voidhash.sdk.api.TransactionSyncVerdict
import com.voidhash.sdk.diagnostics.DiagnosticEmitter
import com.voidhash.sdk.diagnostics.VoidhashDiagnosticKind
import com.voidhash.sdk.network.QUEUE_BACKOFF_CAP_MS
import com.voidhash.sdk.network.SdkClock
import com.voidhash.sdk.network.SystemSdkClock
import com.voidhash.sdk.network.VoidhashCircuitOpenException
import com.voidhash.sdk.network.VoidhashOutboundPausedException
import com.voidhash.sdk.network.backoffDelayMs
import com.voidhash.sdk.storage.InMemoryRecordStore
import com.voidhash.sdk.storage.PersistenceWriter
import com.voidhash.sdk.storage.RecordStore
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONObject

/**
 * Size past which the outbox reports that it is holding an unusual number of receipts.
 *
 * Deliberately not a hard cap. Every record here is a purchase the user made that Voidhash
 * has not confirmed, so there is no record the SDK is entitled to throw away to stay under
 * a limit; a thousand unacked receipts means something is wrong, and saying so is the only
 * correct response.
 */
internal const val TRANSACTION_OUTBOX_WARN_THRESHOLD = 1_000

/** One receipt waiting to be synced, and its retry state. */
data class OutboxRecord(
    val key: String,
    val distinctId: String,
    val request: SyncTransactionRequest,
    val attempts: Int = 0,
    val availableAt: Long = 0L,
) {
    internal fun toRecord(): String = JSONObject().apply {
        put("key", key)
        put("distinctId", distinctId)
        put("attempts", attempts)
        put("availableAt", availableAt)
        put("request", request.toStorageJson())
    }.toString()

    internal companion object {
        fun fromRecord(record: String): OutboxRecord? {
            val json = runCatching { JSONObject(record) }.getOrNull() ?: return null
            val key = json.optString("key").takeIf { it.isNotEmpty() } ?: return null
            val request = json.optJSONObject("request") ?: return null
            val legacyKey = "${request.optString("transactionId")}:${request.optDouble("purchaseDate")}"
            return OutboxRecord(
                key = if ((key.startsWith("android:") || key == legacyKey) && request.optString("purchaseToken").isNotEmpty())
                    "android:${request.getString("purchaseToken")}" else key,
                distinctId = json.optString("distinctId"),
                attempts = json.optInt("attempts"),
                availableAt = json.optLong("availableAt"),
                request = SyncTransactionRequest(
                    appAccountToken = request.optString("appAccountToken")
                        .takeIf { it.isNotEmpty() && !request.isNull("appAccountToken") },
                    providerProductId = request.optString("providerProductId"),
                    productSlug = request.optString("productSlug"),
                    purchaseDate = request.optDouble("purchaseDate", 0.0),
                    purchaseToken = request.optString("purchaseToken"),
                    quantity = request.optInt("quantity", 1),
                    receipt = request.optString("receipt")
                        .takeIf { it.isNotEmpty() && !request.isNull("receipt") },
                    transactionId = request.optString("transactionId", request.optString("purchaseToken")),
                ),
            )
        }
    }
}

/**
 * Durable outbox for store receipts.
 *
 * A receipt is written to disk *before* the sync request goes out and removed only once the
 * backend explicitly accepts or explicitly refuses it. That ordering is what makes a purchase
 * survive the app being killed between the store charging the user and Voidhash hearing about
 * it: the next launch finds the receipt and retries. Backend sync is idempotent per
 * transaction, so a redelivered receipt is free.
 *
 * Records are never evicted. Every one of them represents money the user has already
 * spent, so the only ways out are an explicit acceptance or an explicit rejection from the
 * backend; an ambiguous answer keeps the receipt and retries, because syncing is idempotent
 * and a redelivered receipt costs nothing.
 */
class TransactionOutbox(
    private val store: RecordStore = InMemoryRecordStore(),
    private val clock: SdkClock = SystemSdkClock,
    /** Serializes writes to [store] off the caller's thread; inline when absent. */
    private val writer: PersistenceWriter? = null,
    private val diagnostics: DiagnosticEmitter = DiagnosticEmitter(),
    private val onWarning: (String) -> Unit = {},
) {
    private val records = ArrayList<OutboxRecord>()
    private val drainMutex = Mutex()
    private val restored = CompletableDeferred<Unit>()
    @Volatile
    private var storeReadFailed = false

    init {
        if (writer == null) restoreFromStore() else writer.submit(::restoreFromStore)
    }

    private fun restoreFromStore() {
        val loaded = store.load()
        val fromDisk = loaded.records.mapNotNull(OutboxRecord::fromRecord)
        synchronized(records) {
            val deduplicated = LinkedHashMap<String, OutboxRecord>()
            (fromDisk + records).forEach { record ->
                val first = deduplicated[record.key]
                deduplicated[record.key] = if (first == null) record else first.copy(
                    attempts = maxOf(first.attempts, record.attempts),
                    availableAt = maxOf(first.availableAt, record.availableAt),
                )
            }
            records.clear()
            records.addAll(deduplicated.values)
            storeReadFailed = loaded.readFailed
        }
        restored.complete(Unit)
    }

    /** Suspends until the persisted receipts have been merged in. */
    suspend fun awaitRestored() {
        restored.await()
    }

    /** Receipts still waiting for an ack. */
    val pending: Int get() = synchronized(records) { records.size }

    /** Snapshot of the outbox, for tests. */
    internal val pendingRecords: List<OutboxRecord>
        get() = synchronized(records) { records.toList() }

    /**
     * Records a receipt for [key], preserving the identity and retry state of any earlier attempt.
     * Returns the retained record once persisted ownership is known. A null result keeps
     * the receipt queued and defers delivery until unreadable storage can be recovered.
     */
    suspend fun enqueue(key: String, distinctId: String, request: SyncTransactionRequest): OutboxRecord? {
        awaitRestored()
        reloadAfterFailedRead()
        val record = synchronized(records) {
            records.firstOrNull { it.key == key }
                ?: OutboxRecord(key, distinctId, request, availableAt = clock.now()).also(records::add)
        }
        val size = pending
        if (size > TRANSACTION_OUTBOX_WARN_THRESHOLD) {
            diagnostics.emit(
                VoidhashDiagnosticKind.EVICTION,
                code = "TRANSACTION_OUTBOX_BACKLOG",
                operation = "transactions.enqueue",
                retryable = true,
                message = "$size store receipts are waiting to be synced. None have been " +
                    "dropped; the backend has not acknowledged them.",
            )
        }
        persistAndAwait(record)
        return synchronized(records) {
            if (storeReadFailed) null else records.firstOrNull { it.key == key }
        }
    }

    /** Identity captured by the first report, retained across duplicate observations. */
    suspend fun capturedDistinctId(key: String): String? {
        restored.await()
        return synchronized(records) { records.firstOrNull { it.key == key }?.distinctId }
    }

    /** Removes the record for [key] after the backend accepted it. */
    fun acknowledge(key: String) {
        val removed = synchronized(records) { records.removeAll { it.key == key } }
        if (removed) persist()
    }

    /** Schedules the receipt for a backed-off retry after an unconfirmed direct attempt. */
    fun postpone(key: String) {
        val record = synchronized(records) { records.firstOrNull { it.key == key } } ?: return
        postpone(record)
        persist()
    }

    /**
     * Retries every due receipt through [sync].
     *
     * A receipt leaves only when the backend explicitly accepts it. Rejection, an ambiguous
     * response, and transport failure all postpone it because it is the durable proof of payment.
     */
    suspend fun drain(sync: suspend (String, SyncTransactionRequest) -> TransactionSyncVerdict) {
        if (!drainMutex.tryLock()) return
        try {
            restored.await()
            reloadAfterFailedRead()
            if (storeReadFailed) return
            val now = clock.now()
            val due = synchronized(records) { records.filter { it.availableAt <= now } }
            var changed = false

            for (record in due) {
                val verdict = try {
                    sync(record.distinctId, record.request)
                } catch (error: CancellationException) {
                    throw error
                } catch (error: VoidhashCircuitOpenException) {
                    // The gate refused the request: nothing was attempted, so the records
                    // keep their retry state and the next drain — on reconnect, foreground
                    // or the timer — starts over.
                    break
                } catch (error: VoidhashOutboundPausedException) {
                    break
                } catch (error: Throwable) {
                    onWarning("Failed to sync transaction ${record.key}: ${error.message}")
                    postpone(record, (error as? VoidhashApiException)?.retryAfterMs)
                    changed = true
                    continue
                }

                when (verdict) {
                    TransactionSyncVerdict.ACCEPTED ->
                        synchronized(records) { records.removeAll { it.key == record.key } }

                    TransactionSyncVerdict.REJECTED -> {
                        diagnostics.emit(
                            VoidhashDiagnosticKind.TRANSPORT,
                            code = "TRANSACTION_RECEIPT_UNCONFIRMED",
                            operation = "transactions.drain",
                            retryable = true,
                            message = "Keeping receipt ${record.key}: the backend did not accept it",
                        )
                        postpone(record)
                    }

                    TransactionSyncVerdict.INDETERMINATE -> {
                        // The backend did not say yes or no. Keeping the receipt is the only
                        // safe reading; re-syncing it is idempotent.
                        diagnostics.emit(
                            VoidhashDiagnosticKind.TRANSPORT,
                            code = "TRANSACTION_RECEIPT_UNCONFIRMED",
                            operation = "transactions.drain",
                            retryable = true,
                            message = "Keeping receipt ${record.key}: the backend did not " +
                                "confirm whether it was accepted",
                        )
                        postpone(record)
                    }
                }
                changed = true
            }

            if (changed) persist()
        } finally {
            drainMutex.unlock()
        }
    }

    /** Backs [record] off; a server-supplied [retryAfterMs] wins, clamped to the queue cap. */
    private fun postpone(record: OutboxRecord, retryAfterMs: Long? = null) {
        val delay = retryAfterMs?.coerceAtMost(QUEUE_BACKOFF_CAP_MS)
            ?: backoffDelayMs(record.attempts + 1, QUEUE_BACKOFF_CAP_MS)
        synchronized(records) {
            val index = records.indexOfFirst { it.key == record.key }
            if (index >= 0) {
                records[index] = record.copy(
                    attempts = record.attempts + 1,
                    availableAt = clock.now() + delay,
                )
            }
        }
    }

    /**
     * Writes the outbox out.
     *
     * The snapshot is taken on the writer thread, at the moment the write runs. The restore
     * is the first task that thread ever runs, so no snapshot can miss the receipts still on
     * disk, and every later write sees at least the state of every earlier one.
     */
    private fun persist() {
        val write = {
            if (!storeReadFailed) store.replaceAll(snapshot())
            Unit
        }
        if (writer == null) write() else writer.submit(write)
    }

    private suspend fun persistAndAwait(record: OutboxRecord) {
        val write = {
            if (storeReadFailed) {
                store.append(listOf(record.toRecord()))
            } else {
                store.replaceAll(snapshot())
            }
            Unit
        }
        if (writer == null) write() else writer.await(write)
    }

    private suspend fun reloadAfterFailedRead() {
        if (!storeReadFailed) return
        if (writer == null) restoreFromStore() else writer.await(::restoreFromStore)
    }

    private fun snapshot(): List<String> = synchronized(records) { records.map { it.toRecord() } }
}
