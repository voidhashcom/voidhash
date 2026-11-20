package com.voidhash.sdk.transactions

import com.voidhash.sdk.VoidhashHostApi
import com.voidhash.sdk.network.SdkClock
import com.voidhash.sdk.network.SystemSdkClock
import com.voidhash.sdk.storage.InMemoryRecordStore
import com.voidhash.sdk.storage.PersistenceWriter
import com.voidhash.sdk.storage.RecordStore
import kotlinx.coroutines.CompletableDeferred
import org.json.JSONObject

/**
 * How long an accepted receipt that complete store scans no longer report is remembered.
 *
 * A receipt the store still reports is never forgotten. One it stopped reporting (consumed,
 * expired, refunded) is kept for a month so a late duplicate report is still recognised;
 * resending one after that only repeats a `sync`, which never moves ownership.
 */
internal const val ACCEPTED_RECEIPT_RETENTION_MS = 30L * 24 * 60 * 60 * 1000

/**
 * A store receipt the backend accepted.
 *
 * @property key the receipt's processing key, `android:<purchase token>`.
 * @property transactionId the accepted order id. A subscription renewal keeps its purchase token
 *   but carries a new order id, so it does not match and is reported again.
 * @property distinctId the identity the backend accepted the receipt for: its owner.
 * @property acceptedAt wall-clock time of the acceptance.
 * @property purchaseClaimed whether the backend accepted the receipt as a `purchase` from this
 *   device. A purchase is claimed once: a later report of it, made for whoever is signed in by
 *   then, is a `sync` and cannot move it.
 */
data class AcceptedReceipt(
    val key: String,
    val transactionId: String,
    val distinctId: String,
    val acceptedAt: Long,
    val purchaseClaimed: Boolean = false,
) {
    @VoidhashHostApi
    fun toRecord(): String = JSONObject()
        .put("key", key)
        .put("transactionId", transactionId)
        .put("distinctId", distinctId)
        .put("acceptedAt", acceptedAt)
        .apply { if (purchaseClaimed) put("purchaseClaimed", true) }
        .toString()

    @VoidhashHostApi
    companion object {
        fun fromRecord(record: String): AcceptedReceipt? {
            val json = runCatching { JSONObject(record) }.getOrNull() ?: return null
            val key = json.optString("key").takeIf { it.isNotEmpty() } ?: return null
            val distinctId = json.optString("distinctId").takeIf { it.isNotEmpty() } ?: return null
            return AcceptedReceipt(
                key = key,
                transactionId = json.optString("transactionId"),
                distinctId = distinctId,
                acceptedAt = json.optLong("acceptedAt"),
                purchaseClaimed = json.optBoolean("purchaseClaimed"),
            )
        }
    }
}

/**
 * Durable memory of the store receipts the backend accepted, one per purchase token.
 *
 * Automatic scans report every purchase the store still owns. Without this memory a receipt
 * accepted for one person would be resubmitted for whoever is signed in once the short-lived
 * processed marker lapsed. With it, scans skip what Voidhash already has, and a renewal is
 * reported for the receipt's recorded owner rather than the current identity.
 *
 * Kept in its own [RecordStore] rather than the preferences cache, and loaded on the SDK's
 * writer thread; [find] waits for that load, so no scan runs against an empty memory.
 */
class AcceptedReceipts(
    private val store: RecordStore = InMemoryRecordStore(),
    private val clock: SdkClock = SystemSdkClock,
    /** Serializes writes to [store] off the caller's thread; inline when absent. */
    private val writer: PersistenceWriter? = null,
) {
    private val receipts = LinkedHashMap<String, AcceptedReceipt>()
    private val restored = CompletableDeferred<Unit>()

    @Volatile
    private var storeReadFailed = false

    /** Set by [detach]; the file then belongs to the client configured after this one. */
    @Volatile
    private var detached = false

    init {
        if (writer == null) restoreFromStore() else writer.submit(::restoreFromStore)
    }

    private fun restoreFromStore() {
        val loaded = store.load()
        synchronized(receipts) {
            // Acceptances recorded before the load finished are newer than anything on disk. A
            // purchase claimed by any of a receipt's records stays claimed.
            val recordedThisSession = receipts.values.toList()
            receipts.clear()
            (loaded.records.mapNotNull(AcceptedReceipt::fromRecord) + recordedThisSession).forEach {
                receipts[it.key] = it.copy(purchaseClaimed = it.purchaseClaimed || receipts[it.key]?.purchaseClaimed == true)
            }
            storeReadFailed = loaded.readFailed
        }
        restored.complete(Unit)
    }

    /** The acceptance recorded for [key], once the stored acceptances have been loaded. */
    suspend fun find(key: String): AcceptedReceipt? {
        restored.await()
        return synchronized(receipts) { receipts[key] }
    }

    /**
     * Records that the backend accepted order [transactionId] of receipt [key] for [distinctId], as
     * a `purchase` when [purchaseClaimed]. A claim, once recorded, stays with the receipt.
     */
    fun record(key: String, transactionId: String, distinctId: String, purchaseClaimed: Boolean = false) {
        val receipt = synchronized(receipts) {
            val current = receipts[key]
            val claimed = purchaseClaimed || current?.purchaseClaimed == true
            if (current?.transactionId == transactionId && current.distinctId == distinctId &&
                current.purchaseClaimed == claimed
            ) {
                return
            }
            AcceptedReceipt(key, transactionId, distinctId, clock.now(), claimed).also { receipts[key] = it }
        }
        persist {
            if (storeReadFailed || detached) {
                store.append(listOf(receipt.toRecord()))
            } else {
                store.replaceAll(snapshot())
            }
        }
    }

    /** Stops rewriting the file, which a later client owns now; new acceptances are appended. */
    internal fun detach() {
        detached = true
    }

    /**
     * Forgets acceptances older than [ACCEPTED_RECEIPT_RETENTION_MS] whose keys a complete store
     * scan did not report in [reportedKeys].
     */
    fun prune(reportedKeys: Set<String>) {
        val cutoff = clock.now() - ACCEPTED_RECEIPT_RETENTION_MS
        val pruned = synchronized(receipts) {
            // An unreadable store may still hold acceptances this process never saw, and a
            // detached one acceptances a later client recorded.
            if (storeReadFailed || detached) return
            receipts.values.removeAll { it.key !in reportedKeys && it.acceptedAt < cutoff }
        }
        if (pruned) persist { store.replaceAll(snapshot()) }
    }

    /** Runs [write] on the writer thread, which takes its snapshot when the write runs. */
    private fun persist(write: () -> Boolean) {
        val task = {
            write()
            Unit
        }
        if (writer == null) task() else writer.submit(task)
    }

    private fun snapshot(): List<String> = synchronized(receipts) { receipts.values.map { it.toRecord() } }
}
