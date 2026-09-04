package com.voidhash.sdk.transactions

import com.voidhash.sdk.VoidhashApiException
import com.voidhash.sdk.api.VoidhashPerson
import com.voidhash.sdk.diagnostics.DiagnosticEmitter
import com.voidhash.sdk.diagnostics.VoidhashDiagnosticKind
import com.voidhash.sdk.network.QUEUE_BACKOFF_CAP_MS
import com.voidhash.sdk.network.RETRYABLE_STATUS_CODES
import com.voidhash.sdk.network.SdkClock
import com.voidhash.sdk.network.SystemSdkClock
import com.voidhash.sdk.network.VoidhashCircuitOpenException
import com.voidhash.sdk.network.VoidhashOutboundPausedException
import com.voidhash.sdk.network.backoffDelayMs
import com.voidhash.sdk.storage.InMemoryRecordStore
import com.voidhash.sdk.storage.PersistenceWriter
import com.voidhash.sdk.storage.RecordStore
import com.voidhash.sdk.storage.sanitizeJsonObject
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.sync.Mutex
import org.json.JSONObject

/** The kind of person write a queued record represents. */
enum class PersonWriteKind {
    /** An `identify` that aliases one distinct id onto another. */
    IDENTIFY,

    /** A traits write. */
    TRAITS,
}

/** One queued write against the person record. */
data class PersonWrite(
    val kind: PersonWriteKind,
    val distinctId: String,
    val externalUserId: String? = null,
    val email: String? = null,
    val name: String? = null,
    val traits: Map<String, Any?> = emptyMap(),
    val attempts: Int = 0,
    val availableAt: Long = 0L,
) {
    /** Identifies the write for replacement; the newest write for a target wins. */
    val key: String get() = "${kind.name}:${externalUserId ?: distinctId}"

    internal fun toRecord(): String = JSONObject().apply {
        put("kind", kind.name)
        put("distinctId", distinctId)
        put("externalUserId", externalUserId ?: JSONObject.NULL)
        put("email", email ?: JSONObject.NULL)
        put("name", name ?: JSONObject.NULL)
        put("attempts", attempts)
        put("availableAt", availableAt)
        put("traits", sanitizeJsonObject(traits))
    }.toString()

    internal companion object {
        fun fromRecord(record: String): PersonWrite? {
            val json = runCatching { JSONObject(record) }.getOrNull() ?: return null
            val kind = runCatching { PersonWriteKind.valueOf(json.optString("kind")) }
                .getOrNull() ?: return null
            val traits = json.optJSONObject("traits") ?: JSONObject()
            return PersonWrite(
                kind = kind,
                distinctId = json.optString("distinctId"),
                externalUserId = json.optStringOrNullField("externalUserId"),
                email = json.optStringOrNullField("email"),
                name = json.optStringOrNullField("name"),
                traits = traits.keys().asSequence().associateWith { key ->
                    traits.get(key).takeUnless { it === JSONObject.NULL }
                },
                attempts = json.optInt("attempts"),
                availableAt = json.optLong("availableAt"),
            )
        }

        private fun JSONObject.optStringOrNullField(key: String): String? {
            if (!has(key) || isNull(key)) return null
            return optString(key).takeIf { it.isNotEmpty() }
        }
    }
}

/**
 * Durable queue for writes against the person record.
 *
 * `identify` and `setPersonAttributes` describe something the app already knows to be true
 * about its user. Failing them because the network is down would force every host to build
 * its own retry, so the SDK applies them locally, queues the server call, and reports the
 * write as deferred. The backend applies both idempotently, so a redelivered write is free.
 */
class PersonWriteOutbox(
    private val store: RecordStore = InMemoryRecordStore(),
    private val clock: SdkClock = SystemSdkClock,
    private val writer: PersistenceWriter? = null,
    private val diagnostics: DiagnosticEmitter = DiagnosticEmitter(),
    private val onWarning: (String) -> Unit = {},
) {
    private val records = ArrayList<PersonWrite>()
    private val drainMutex = Mutex()
    private val restored = CompletableDeferred<Unit>()
    @Volatile
    private var storeReadFailed = false

    init {
        if (writer == null) restoreFromStore() else writer.submit(::restoreFromStore)
    }

    private fun restoreFromStore() {
        val loaded = store.load()
        storeReadFailed = loaded.readFailed
        val fromDisk = loaded.records.mapNotNull(PersonWrite::fromRecord)
        synchronized(records) {
            // A write queued while the load was in flight is newer: it supersedes a stored
            // identify for the same target and takes precedence in a merged traits write.
            for (stored in fromDisk.asReversed()) {
                val index = records.indexOfFirst { it.key == stored.key }
                if (index < 0) {
                    records.add(0, stored)
                } else if (stored.kind == PersonWriteKind.TRAITS) {
                    val live = records[index]
                    records[index] = live.copy(traits = stored.traits + live.traits)
                }
            }
        }
        restored.complete(Unit)
    }

    /** Writes still waiting to reach the backend. */
    val pending: Int get() = synchronized(records) { records.size }

    /** Snapshot of the queue, for tests. */
    internal val pendingWrites: List<PersonWrite>
        get() = synchronized(records) { records.toList() }

    /**
     * Queues [write]. An identify replaces any earlier identify for the same target; a traits
     * write is merged into the one already queued for the same person, newer keys winning,
     * so two offline `setPersonAttributes` calls lose neither of their attributes. The merged
     * write is persisted before this function returns.
     */
    suspend fun enqueue(write: PersonWrite) {
        val queued = synchronized(records) {
            val existing = records.firstOrNull { it.key == write.key }
            val merged = if (existing != null && write.kind == PersonWriteKind.TRAITS) {
                write.copy(traits = existing.traits + write.traits)
            } else {
                write
            }
            records.removeAll { it.key == write.key }
            merged.copy(availableAt = clock.now()).also(records::add)
        }
        persistAndAwait(queued)
    }

    /**
     * Retries every due write.
     *
     * A write the backend refuses outright is dropped with a diagnostic: the same payload
     * will be refused again. Transport failures postpone with backoff and keep the record.
     */
    suspend fun drain(
        identify: suspend (PersonWrite) -> VoidhashPerson?,
        setTraits: suspend (PersonWrite) -> Unit,
    ) {
        if (!drainMutex.tryLock()) return
        try {
            restored.await()
            reloadAfterFailedRead()
            val now = clock.now()
            val due = synchronized(records) { records.filter { it.availableAt <= now } }
            var changed = false

            for (record in due) {
                try {
                    when (record.kind) {
                        PersonWriteKind.IDENTIFY -> identify(record)
                        PersonWriteKind.TRAITS -> setTraits(record)
                    }
                    synchronized(records) { records.removeAll { it.key == record.key } }
                } catch (error: CancellationException) {
                    throw error
                } catch (error: VoidhashCircuitOpenException) {
                    // Nothing was attempted; the records keep their retry state.
                    break
                } catch (error: VoidhashOutboundPausedException) {
                    break
                } catch (error: VoidhashApiException) {
                    when {
                        error.status == 401 || error.status == 403 -> break
                        error.status in RETRYABLE_STATUS_CODES -> {
                            onWarning("Failed to apply a queued person write: ${error.message}")
                            postpone(record)
                        }
                        else -> discardInMemory(
                            record,
                            "HTTP ${error.status}: ${error.description}",
                        )
                    }
                } catch (error: Throwable) {
                    onWarning("Failed to apply a queued person write: ${error.message}")
                    postpone(record)
                }
                changed = true
            }

            if (changed) persist()
        } finally {
            drainMutex.unlock()
        }
    }

    /** Drops [write] without retrying; the backend gave a verdict it will repeat. */
    fun discard(write: PersonWrite, reason: String) {
        if (!discardInMemory(write, reason)) return
        persist()
    }

    private fun discardInMemory(write: PersonWrite, reason: String): Boolean {
        if (!synchronized(records) { records.removeAll { it.key == write.key } }) return false
        diagnostics.emit(
            VoidhashDiagnosticKind.EVICTION,
            code = "PERSON_WRITE_REJECTED",
            operation = "person.drain",
            message = "Dropped a queued ${write.kind.name.lowercase()} write: $reason",
        )
        return true
    }

    private fun postpone(record: PersonWrite) {
        val delay = backoffDelayMs(record.attempts + 1, QUEUE_BACKOFF_CAP_MS)
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

    /** Snapshots on the writer thread, behind the restore, so disk records are never lost. */
    private fun persist() {
        val write = {
            if (!storeReadFailed) store.replaceAll(snapshot())
            Unit
        }
        if (writer == null) write() else writer.submit(write)
    }

    private suspend fun persistAndAwait(write: PersonWrite) {
        val persist = {
            if (storeReadFailed) {
                store.append(listOf(write.toRecord()))
            } else {
                store.replaceAll(snapshot())
            }
            Unit
        }
        if (writer == null) persist() else writer.await(persist)
    }

    private suspend fun reloadAfterFailedRead() {
        if (!storeReadFailed) return
        if (writer == null) restoreFromStore() else writer.await(::restoreFromStore)
    }

    private fun snapshot(): List<String> = synchronized(records) { records.map { it.toRecord() } }
}
