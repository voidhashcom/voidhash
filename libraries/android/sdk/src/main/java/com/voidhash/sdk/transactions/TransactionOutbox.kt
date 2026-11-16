package com.voidhash.sdk.transactions

import com.voidhash.sdk.VoidhashApiException
import com.voidhash.sdk.VoidhashException
import com.voidhash.sdk.api.PurchasePaywallContext
import com.voidhash.sdk.api.SYNC_TRANSACTION_INTENT_RESTORE
import com.voidhash.sdk.api.SYNC_TRANSACTION_INTENT_SYNC
import com.voidhash.sdk.api.SyncTransactionRequest
import com.voidhash.sdk.api.TransactionSyncVerdict
import com.voidhash.sdk.diagnostics.DiagnosticEmitter
import com.voidhash.sdk.diagnostics.VoidhashDiagnosticKind
import com.voidhash.sdk.diagnostics.redacted
import com.voidhash.sdk.network.FailureClass
import com.voidhash.sdk.network.MAX_QUEUE_BACKOFF_MS
import com.voidhash.sdk.network.MAX_RETRY_AFTER_MS
import com.voidhash.sdk.network.MIN_RETRY_AFTER_MS
import com.voidhash.sdk.network.QUEUE_BACKOFF_CAP_MS
import com.voidhash.sdk.network.SdkClock
import com.voidhash.sdk.network.SystemSdkClock
import com.voidhash.sdk.network.VoidhashCircuitOpenException
import com.voidhash.sdk.network.VoidhashOutboundPausedException
import com.voidhash.sdk.network.backoffDelayMs
import com.voidhash.sdk.network.classifyFailure
import com.voidhash.sdk.network.isDue
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

/**
 * How long a receipt the backend refused with a verdict waits before it is sent again, unless
 * the app relaunches first. The verdict (an unconfigured store provider, an unknown token, an
 * environment mismatch) will not change within a session, but the receipt is still proof of
 * payment, so it is parked rather than dropped.
 */
internal const val PARKED_RECEIPT_DELAY_MS = 6 * 60 * 60_000L

/**
 * What [TransactionOutbox.enqueue] did with a receipt.
 *
 * @property record the retained receipt, carrying the identity and intent it is sent with.
 *   `null` while unreadable storage hides whether an earlier capture exists, which defers
 *   delivery until storage can be read.
 * @property durable whether the receipt reached storage. `false` means it is held in memory
 *   only and would not survive the process.
 */
class EnqueuedReceipt(val record: OutboxRecord?, val durable: Boolean)

/** One receipt waiting to be synced, and its retry state. */
data class OutboxRecord(
    val key: String,
    val distinctId: String,
    val request: SyncTransactionRequest,
    val attempts: Int = 0,
    val availableAt: Long = 0L,
    /** Explicit restore waiting behind the original capture, until accepted. */
    val restoreDistinctId: String? = null,
    /** Why the backend refused the receipt, while it is parked; `null` when it is not. */
    val rejectionReason: String? = null,
) {
    /**
     * The request as it is sent: a `restore` for the identity an explicit restore asked for,
     * which is persisted as [restoreDistinctId] and so survives relaunch, and [request]'s own
     * intent otherwise.
     */
    val outgoingRequest: SyncTransactionRequest
        get() = if (restoreDistinctId != null && restoreDistinctId == distinctId) {
            request.copy(intent = SYNC_TRANSACTION_INTENT_RESTORE)
        } else {
            request
        }

    internal fun toRecord(): String = JSONObject().apply {
        put("key", key)
        put("distinctId", distinctId)
        put("restoreDistinctId", restoreDistinctId)
        put("attempts", attempts)
        put("availableAt", availableAt)
        put("rejectionReason", rejectionReason)
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
                restoreDistinctId = json.optString("restoreDistinctId").takeIf { it.isNotEmpty() && !json.isNull("restoreDistinctId") },
                attempts = json.optInt("attempts"),
                availableAt = json.optLong("availableAt"),
                rejectionReason = json.optString("rejectionReason")
                    .takeIf { it.isNotEmpty() && !json.isNull("rejectionReason") },
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
                    intent = request.optString("intent").takeIf { it.isNotEmpty() && !request.isNull("intent") }
                        ?: SYNC_TRANSACTION_INTENT_SYNC,
                    isStartedBySdk = request.optBoolean("isStartedBySdk"),
                    paywallContext = PurchasePaywallContext.fromJson(request.optJSONObject("paywallContext")),
                ),
            )
        }
    }
}

/**
 * Durable outbox for store receipts.
 *
 * A receipt is written to disk *before* the sync request goes out and removed only once the
 * backend explicitly accepts it. That ordering is what makes a purchase
 * survive the app being killed between the store charging the user and Voidhash hearing about
 * it: the next launch finds the receipt and retries. Backend sync is idempotent per
 * transaction, so a redelivered receipt is free.
 *
 * Records are never evicted. Every one of them represents money the user has already
 * spent, so the only way out is an explicit acceptance from the backend. An ambiguous answer
 * keeps the receipt and retries, because syncing is idempotent and a redelivered receipt costs
 * nothing. A verdict that will not change within the session (a tagged API error such as
 * `Api/SdkTransactionRejectedError`, or a request that cannot be built) parks the receipt until
 * the next launch or [PARKED_RECEIPT_DELAY_MS], whichever comes first.
 *
 * A record is sent as a `restore` only for the identity an explicit restore asked for (see
 * [OutboxRecord.outgoingRequest]), so a queued restore survives relaunch as a restore and the
 * original buyer's capture ahead of it stays a `sync`. A restore staged while a `sync` of the
 * same receipt is in flight is still sent once that `sync` is accepted (see [acknowledge]).
 * Acceptances are remembered in [acceptedReceipts].
 */
class TransactionOutbox(
    private val store: RecordStore = InMemoryRecordStore(),
    private val clock: SdkClock = SystemSdkClock,
    /** Serializes writes to [store] off the caller's thread; inline when absent. */
    private val writer: PersistenceWriter? = null,
    private val diagnostics: DiagnosticEmitter = DiagnosticEmitter(),
    private val onWarning: (String) -> Unit = {},
    /** Durable memory of the receipts this outbox saw accepted, and of their owners. */
    val acceptedReceipts: AcceptedReceipts = AcceptedReceipts(clock = clock),
) {
    private val records = ArrayList<OutboxRecord>()

    /** Keys whose receipt a direct sync is sending right now; guarded by [records]. */
    private val inFlight = HashSet<String>()
    private val drainMutex = Mutex()
    private val restored = CompletableDeferred<Unit>()
    @Volatile
    private var storeReadFailed = false

    /** Set by [detach]; the file then belongs to the client configured after this one. */
    @Volatile
    private var detached = false

    init {
        if (writer == null) restoreFromStore() else writer.submit(::restoreFromStore)
    }

    /**
     * Hands the store over to the client configured after this one. This memory no longer
     * reflects the file, so nothing here rewrites it any more; a receipt enqueued afterwards is
     * appended, and the next restore of the file finds it.
     */
    internal fun detach() {
        detached = true
        acceptedReceipts.detach()
    }

    private fun restoreFromStore() {
        val loaded = store.load()
        // A park lasts until the next launch: a receipt refused in an earlier process is due now.
        val fromDisk = loaded.records.mapNotNull(OutboxRecord::fromRecord).map { record ->
            if (record.rejectionReason == null) record else record.copy(rejectionReason = null, availableAt = 0L)
        }
        synchronized(records) {
            val deduplicated = LinkedHashMap<String, OutboxRecord>()
            (fromDisk + records).forEach { record ->
                val first = deduplicated[record.key]
                deduplicated[record.key] = if (first == null) record else first.copy(
                    attempts = maxOf(first.attempts, record.attempts),
                    availableAt = maxOf(first.availableAt, record.availableAt),
                    restoreDistinctId = record.restoreDistinctId ?: first.restoreDistinctId,
                    rejectionReason = record.rejectionReason ?: first.rejectionReason,
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
     * A receipt the SDK started stays marked so once any capture of it says so.
     *
     * [restoreDistinctId] marks an explicit restore for that identity. A receipt already queued
     * for another identity is sent for that one first, and the restore is promoted once it is
     * accepted.
     */
    suspend fun enqueue(
        key: String,
        distinctId: String,
        request: SyncTransactionRequest,
        restoreDistinctId: String? = null,
    ): EnqueuedReceipt {
        awaitRestored()
        reloadAfterFailedRead()
        val record = synchronized(records) {
            val index = records.indexOfFirst { it.key == key }
            if (index >= 0) {
                val existing = records[index]
                existing.copy(
                    request = if (request.isStartedBySdk && !existing.request.isStartedBySdk) {
                        existing.request.copy(isStartedBySdk = true)
                    } else {
                        existing.request
                    },
                    restoreDistinctId = restoreDistinctId ?: existing.restoreDistinctId,
                ).also { records[index] = it }
            } else {
                OutboxRecord(key, distinctId, request, availableAt = clock.now(), restoreDistinctId = restoreDistinctId).also(records::add)
            }
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
        val durable = persistAndAwait(record)
        return EnqueuedReceipt(
            record = synchronized(records) {
                if (storeReadFailed) null else records.firstOrNull { it.key == key }
            },
            durable = durable,
        )
    }

    /** Identity captured by the first report, retained across duplicate observations. */
    suspend fun capturedDistinctId(key: String): String? {
        restored.await()
        return synchronized(records) { records.firstOrNull { it.key == key }?.distinctId }
    }

    /** Identity of an explicit restore still waiting for acceptance. */
    suspend fun pendingRestoreDistinctId(key: String): String? {
        restored.await()
        return synchronized(records) { records.firstOrNull { it.key == key }?.restoreDistinctId }
    }

    /**
     * Acknowledges one owner, remembers the acceptance in [acceptedReceipts], and promotes a
     * waiting restore. Returns true when complete.
     *
     * [intent] is the intent of the accepted request. A `sync` accepted for a receipt that now
     * waits to be sent as a restore, because the restore was staged while the sync was in
     * flight, leaves the receipt queued and due: the restore has not been sent yet.
     */
    fun acknowledge(key: String, distinctId: String? = null, intent: String? = null): Boolean {
        var accepted: OutboxRecord? = null
        val complete = synchronized(records) {
            val index = records.indexOfFirst { it.key == key }
            if (index < 0) return@synchronized true
            val record = records[index]
            if (distinctId != null && record.distinctId != distinctId) return@synchronized false
            accepted = record
            val restoreId = record.restoreDistinctId
            if (restoreId != null && restoreId != record.distinctId) {
                records[index] = record.copy(
                    distinctId = restoreId,
                    attempts = 0,
                    availableAt = clock.now(),
                    rejectionReason = null,
                )
                false
            } else if (
                intent == SYNC_TRANSACTION_INTENT_SYNC &&
                record.outgoingRequest.intent == SYNC_TRANSACTION_INTENT_RESTORE
            ) {
                records[index] = record.copy(attempts = 0, availableAt = clock.now(), rejectionReason = null)
                false
            } else {
                records.removeAt(index)
                true
            }
        }
        accepted?.let { acceptedReceipts.record(it.key, it.request.transactionId, it.distinctId) }
        persist()
        return complete
    }

    /**
     * Schedules the receipt for a backed-off retry after a direct attempt the backend did not
     * confirm; [error] is why the attempt failed, `null` when the backend answered without
     * accepting the receipt.
     */
    fun postpone(key: String, error: Throwable? = null) {
        val record = synchronized(records) { records.firstOrNull { it.key == key } } ?: return
        postpone(record, error)
        persist()
    }

    /**
     * Parks the receipt for [key] after the backend refused it with a verdict ([error]): it stays
     * queued, but is not sent again until the next launch or [PARKED_RECEIPT_DELAY_MS].
     */
    fun park(key: String, error: Throwable) {
        parkRecord(key, error)
        persist()
    }

    /**
     * Whether [drain] would send a receipt at wall-clock time [now]. Reads memory only, so the
     * retry timer can ask on every tick.
     */
    fun hasDue(now: Long): Boolean = synchronized(records) { records.any { it.key !in inFlight && isDueAt(it, now) } }

    /**
     * Runs [send], a direct sync of the receipt for [key], keeping [drain] from sending the same
     * receipt while it is in flight: a slow request is not doubled by the retry timer.
     */
    suspend fun <T> sending(key: String, send: suspend () -> T): T {
        synchronized(records) { inFlight.add(key) }
        try {
            return send()
        } finally {
            synchronized(records) { inFlight.remove(key) }
        }
    }

    /** Whether the receipt for [key] is parked after a verdict and not yet due for another try. */
    fun isParked(key: String): Boolean {
        val record = synchronized(records) { records.firstOrNull { it.key == key } } ?: return false
        return record.rejectionReason != null &&
            !isDue(record.availableAt, clock.now(), PARKED_RECEIPT_DELAY_MS)
    }

    /**
     * Retries every due receipt through [sync], the ones that failed least often first, so one
     * receipt the backend keeps failing cannot hold back the others.
     *
     * A receipt leaves only when the backend explicitly accepts it, because it is the durable
     * proof of payment. An `accepted: false`, an ambiguous response and a transport failure
     * postpone it with backoff; a verdict (a tagged API error, or a request that cannot be built)
     * parks it until the next launch or [PARKED_RECEIPT_DELAY_MS].
     *
     * Returns how many receipts the backend accepted in this pass.
     */
    suspend fun drain(sync: suspend (String, SyncTransactionRequest) -> TransactionSyncVerdict): Int {
        if (!drainMutex.tryLock()) return 0
        var accepted = 0
        try {
            restored.await()
            reloadAfterFailedRead()
            if (storeReadFailed) return 0
            val now = clock.now()
            // Fewest attempts first, in queue order among equals: while the circuit is half-open
            // one request is let through, and a receipt that keeps failing must not take it every
            // time from a newer one the backend would accept.
            val due = synchronized(records) {
                records.filter { it.key !in inFlight && isDueAt(it, now) }.sortedBy { it.attempts }.toMutableList()
            }
            var changed = false

            var next = 0
            while (next < due.size) {
                val record = due[next++]
                val sent = record.outgoingRequest
                val verdict = try {
                    sync(record.distinctId, sent)
                } catch (error: CancellationException) {
                    throw error
                } catch (error: VoidhashCircuitOpenException) {
                    // The gate refused the request: nothing was attempted, so the records
                    // keep their retry state and the next drain — the retry timer, a
                    // foreground, a reconnect or a flush — starts over.
                    break
                } catch (error: VoidhashOutboundPausedException) {
                    break
                } catch (error: Throwable) {
                    onWarning("Failed to sync transaction ${redacted(record.key)}: ${error.message}")
                    if (classifyFailure(error) == FailureClass.VERDICT) {
                        parkRecord(record.key, error)
                    } else {
                        postpone(record, error)
                    }
                    changed = true
                    continue
                }

                when (verdict) {
                    TransactionSyncVerdict.ACCEPTED -> {
                        accepted += 1
                        if (!acknowledge(record.key, record.distinctId, sent.intent)) {
                            val promoted = synchronized(records) { records.firstOrNull { it.key == record.key } }
                            if (promoted != null) {
                                persistAndAwait(promoted)
                                due.add(promoted)
                            }
                        }
                    }

                    // An `accepted: false`, or an answer that says neither yes nor no. Keeping the
                    // receipt is the only safe reading; re-syncing it is idempotent.
                    TransactionSyncVerdict.REJECTED,
                    TransactionSyncVerdict.INDETERMINATE,
                    -> postpone(record)
                }
                changed = true
            }

            if (changed) persist()
        } finally {
            drainMutex.unlock()
        }
        return accepted
    }

    /**
     * Whether [record] is due at [now]. The jittered backoff ceiling is the longest delay a receipt
     * can be postponed by, a park the longest a refused one waits; one due further out was scheduled
     * under a wall clock that has since moved back.
     */
    private fun isDueAt(record: OutboxRecord, now: Long): Boolean = isDue(
        record.availableAt,
        now,
        if (record.rejectionReason == null) MAX_QUEUE_BACKOFF_MS else PARKED_RECEIPT_DELAY_MS,
    )

    /**
     * Parks the receipt for [key] after [error], reporting `TRANSACTION_REJECTED` once when it goes
     * from queued to parked.
     */
    private fun parkRecord(key: String, error: Throwable) {
        val reason = (error as? VoidhashException)?.description ?: error.message ?: "The backend refused the receipt"
        val newlyParked = synchronized(records) {
            val index = records.indexOfFirst { it.key == key }
            if (index < 0) return
            val current = records[index]
            records[index] = current.copy(
                attempts = current.attempts + 1,
                availableAt = clock.now() + PARKED_RECEIPT_DELAY_MS,
                rejectionReason = reason,
            )
            current.rejectionReason == null
        }
        if (!newlyParked) return
        diagnostics.emit(
            VoidhashDiagnosticKind.TRANSPORT,
            code = "TRANSACTION_REJECTED",
            operation = "transactions.sync",
            retryable = true,
            httpStatus = (error as? VoidhashApiException)?.status,
            message = "Keeping receipt ${redacted(key)} without retrying it until the next launch: $reason",
        )
    }

    /**
     * Backs [record] off after an attempt that failed with [error], or that the backend answered
     * without accepting the receipt when [error] is `null`, and reports `TRANSACTION_SYNC_DEFERRED`.
     * A server-supplied cool-down wins, clamped between [MIN_RETRY_AFTER_MS] and
     * [MAX_RETRY_AFTER_MS].
     */
    private fun postpone(record: OutboxRecord, error: Throwable? = null) {
        val apiError = error as? VoidhashApiException
        val delay = apiError?.retryAfterMs?.coerceIn(MIN_RETRY_AFTER_MS, MAX_RETRY_AFTER_MS)
            ?: backoffDelayMs(record.attempts + 1, QUEUE_BACKOFF_CAP_MS)
        synchronized(records) {
            val index = records.indexOfFirst { it.key == record.key }
            if (index >= 0) {
                records[index] = records[index].copy(
                    attempts = records[index].attempts + 1,
                    availableAt = clock.now() + delay,
                )
            }
        }
        diagnostics.emit(
            VoidhashDiagnosticKind.TRANSPORT,
            code = "TRANSACTION_SYNC_DEFERRED",
            operation = "transactions.sync",
            retryable = true,
            httpStatus = apiError?.status,
            message = "Receipt ${redacted(record.key)} stays queued and is retried with backoff: " +
                (error?.message ?: "the backend did not confirm it"),
        )
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
            if (!storeReadFailed && !detached) store.replaceAll(snapshot())
            Unit
        }
        if (writer == null) write() else writer.submit(write)
    }

    /** Writes [record] out and waits for it; returns whether it reached storage. */
    private suspend fun persistAndAwait(record: OutboxRecord): Boolean {
        var durable = false
        val write = {
            durable = if (storeReadFailed || detached) {
                store.append(listOf(record.toRecord()))
            } else {
                store.replaceAll(snapshot())
            }
        }
        if (writer == null) write() else writer.await(write)
        return durable
    }

    private suspend fun reloadAfterFailedRead() {
        if (!storeReadFailed) return
        if (writer == null) restoreFromStore() else writer.await(::restoreFromStore)
    }

    private fun snapshot(): List<String> = synchronized(records) { records.map { it.toRecord() } }
}
