package com.voidhash.sdk.transactions

import com.voidhash.sdk.VoidhashApiException
import com.voidhash.sdk.api.VoidhashPerson
import com.voidhash.sdk.diagnostics.DiagnosticEmitter
import com.voidhash.sdk.diagnostics.VoidhashDiagnosticKind
import com.voidhash.sdk.network.FailureClass
import com.voidhash.sdk.network.MAX_QUEUE_BACKOFF_MS
import com.voidhash.sdk.network.MAX_RETRY_AFTER_MS
import com.voidhash.sdk.network.MIN_RETRY_AFTER_MS
import com.voidhash.sdk.network.QUEUE_BACKOFF_CAP_MS
import com.voidhash.sdk.network.SdkClock
import com.voidhash.sdk.network.SystemSdkClock
import com.voidhash.sdk.network.VoidhashCircuitOpenException
import com.voidhash.sdk.network.backoffDelayMs
import com.voidhash.sdk.network.classifyFailure
import com.voidhash.sdk.network.isDue
import com.voidhash.sdk.network.isPersonNotFound
import com.voidhash.sdk.storage.InMemoryRecordStore
import com.voidhash.sdk.storage.PersistenceWriter
import com.voidhash.sdk.storage.RecordStore
import com.voidhash.sdk.storage.sanitizeJsonObject
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONObject

/** The kind of person write a queued record represents. */
enum class PersonWriteKind {
    /** An `identify` that aliases one distinct id onto another. */
    IDENTIFY,

    /** A traits write. */
    TRAITS,

    /**
     * Takes one person's agreement to sharing with ad platforms back, on the traits endpoint.
     * Analytics consent neither blocks nor discards it, and it carries nothing else.
     */
    AD_DATA_SHARING_REVOCATION,
}

/** The person trait that holds the agreement to sharing with ad platforms. */
internal const val AD_DATA_SHARING_TRAIT = "\$ad_data_sharing"

/** How long a revocation is asked again for a person Voidhash does not have. */
internal const val REVOCATION_LIFETIME_MS = 48 * 60 * 60 * 1000L

/**
 * The shortest wait before asking again. Each wait then lasts as long as the revocation has waited
 * so far, as most people who decline never had a person: about 15 requests over its lifetime at most.
 */
internal const val REVOCATION_MIN_WAIT_MS = 30_000L

/**
 * Whether [value] is a trait value the person API accepts: a string, a number, a boolean or
 * `null`. Traits are flat; a map, a list or any other object is not one.
 */
internal fun isScalarTraitValue(value: Any?): Boolean =
    value == null || value === JSONObject.NULL || value is String || value is Number || value is Boolean

/**
 * One queued write against the person record.
 *
 * @property distinctId the id the request is made as: the alias an identify links, or the
 *   person a traits write describes.
 * @property externalUserId the id an identify links [distinctId] onto.
 * @property revision changes every time the write is queued or merged into. A send settles the
 *   queued record only while it still carries the revision that was sent, so a write merged in
 *   while the request was in flight is never lost.
 * @property queuedAt when a revocation was first queued, which its lifetime counts from.
 */
data class PersonWrite(
    val kind: PersonWriteKind,
    val distinctId: String,
    val externalUserId: String? = null,
    val email: String? = null,
    val name: String? = null,
    val traits: Map<String, Any?> = emptyMap(),
    val attempts: Int = 0,
    val availableAt: Long = 0L,
    val revision: Long = 0L,
    val queuedAt: Long? = null,
) {
    /** The person the write ends up describing: an identify's target, or the traits' own id. */
    val target: String get() = externalUserId ?: distinctId

    /**
     * Identifies the write for merging. Traits merge per person. An identify merges only with
     * one linking the same alias onto the same target: two aliases of one user are two merges
     * the backend has to make, and collapsing them would orphan the older alias's purchases.
     * The alias is length-prefixed because distinct ids may themselves contain colons.
     */
    val key: String
        get() = when (kind) {
            PersonWriteKind.IDENTIFY -> "IDENTIFY:${distinctId.length}:$distinctId:$target"
            PersonWriteKind.TRAITS -> "TRAITS:$distinctId"
            PersonWriteKind.AD_DATA_SHARING_REVOCATION -> "AD_DATA_SHARING_REVOCATION:$distinctId"
        }

    internal fun toRecord(): String = JSONObject().apply {
        put("kind", kind.name)
        put("distinctId", distinctId)
        put("externalUserId", externalUserId ?: JSONObject.NULL)
        put("email", email ?: JSONObject.NULL)
        put("name", name ?: JSONObject.NULL)
        put("attempts", attempts)
        put("availableAt", availableAt)
        put("revision", revision)
        put("traits", sanitizeJsonObject(traits))
        queuedAt?.let { put("queuedAt", it) }
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
                // Records written before revisions existed read as 0.
                revision = json.optLong("revision"),
                queuedAt = if (json.has("queuedAt")) json.optLong("queuedAt") else null,
            )
        }

        private fun JSONObject.optStringOrNullField(key: String): String? {
            if (!has(key) || isNull(key)) return null
            return optString(key).takeIf { it.isNotEmpty() }
        }
    }
}

/** Merges [newer] into [older], both queued under the same key; newer fields win. */
internal fun mergePersonWrites(older: PersonWrite, newer: PersonWrite): PersonWrite = when (newer.kind) {
    PersonWriteKind.TRAITS -> newer.copy(
        traits = older.traits + newer.traits,
        email = newer.email ?: older.email,
        name = newer.name ?: older.name,
    )
    PersonWriteKind.IDENTIFY -> newer.copy(
        email = newer.email ?: older.email,
        name = newer.name ?: older.name,
    )
    PersonWriteKind.AD_DATA_SHARING_REVOCATION -> newer
}

/**
 * Durable queue for writes against the person record.
 *
 * `identify` and `setPersonAttributes` describe something the app already knows to be true
 * about its user. Failing them because the network is down would force every host to build
 * its own retry, so the SDK applies them locally, queues the server call, and reports the
 * write as deferred. The backend applies both idempotently, so a redelivered write is free.
 *
 * Records are never evicted for capacity or for a transient failure; only a verdict the API
 * will repeat drops one, with a diagnostic.
 *
 * A revocation of the agreement to sharing with ad platforms goes last in each pass, after any
 * link or traits for its person, whom Voidhash may not have until those arrive. It is dropped when
 * Voidhash has still no such person 48 hours after it was first queued, and only then: an outage
 * must not leave sharing on.
 */
class PersonWriteOutbox(
    private val store: RecordStore = InMemoryRecordStore(),
    private val clock: SdkClock = SystemSdkClock,
    private val writer: PersistenceWriter? = null,
    private val diagnostics: DiagnosticEmitter = DiagnosticEmitter(),
    private val onWarning: (String) -> Unit = {},
) {
    private val records = ArrayList<PersonWrite>()

    /**
     * Keys a direct send owns, from the enqueue that started it until it settles, with how many
     * direct sends own each; guarded by [records]. [drain] leaves them alone, so it neither sends
     * a write a direct send is delivering nor settles one before the direct sender learns how.
     */
    private val directSends = HashMap<String, Int>()

    /** The last revision handed out; guarded by [records]. */
    private var lastRevision = 0L
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
     * reflects the file, so a write still in flight here never rewrites it from this memory.
     */
    internal fun detach() {
        detached = true
    }

    private fun restoreFromStore() {
        val loaded = store.load()
        storeReadFailed = loaded.readFailed
        val fromDisk = loaded.records
            .mapNotNull(PersonWrite::fromRecord)
            .mapNotNull(::dropNestedTraits)
        synchronized(records) {
            // Revisions handed out from here on must not collide with ones already on disk.
            fromDisk.forEach { lastRevision = maxOf(lastRevision, it.revision) }
            // A write queued while the load was in flight is newer and takes precedence where
            // both carry a value. The merged record gets a new revision, so a send of the live
            // write that is still in flight cannot settle away what came from disk.
            for (stored in fromDisk.asReversed()) {
                val index = records.indexOfFirst { it.key == stored.key }
                if (index < 0) {
                    records.add(0, stored)
                } else {
                    records[index] = mergePersonWrites(stored, records[index]).copy(revision = ++lastRevision)
                }
            }
        }
        restored.complete(Unit)
    }

    /**
     * Drops the nested values a release before traits were validated could have queued: the API
     * refuses the whole write for one of them. A traits write left with nothing is dropped.
     */
    private fun dropNestedTraits(write: PersonWrite): PersonWrite? {
        val nested = write.traits.filterValues { !isScalarTraitValue(it) }.keys
        if (nested.isEmpty()) return write
        diagnostics.emit(
            VoidhashDiagnosticKind.EVICTION,
            code = "PERSON_WRITE_REJECTED",
            operation = "person.restore",
            message = "Dropped nested traits from a queued write: ${nested.joinToString()}. " +
                "Trait values must be strings, numbers, booleans or null",
        )
        val remaining = write.traits - nested
        if (write.kind == PersonWriteKind.TRAITS && remaining.isEmpty()) return null
        return write.copy(traits = remaining)
    }

    /** Writes still waiting to reach the backend. */
    val pending: Int get() = synchronized(records) { records.size }

    /** Snapshot of the queue, for tests. */
    internal val pendingWrites: List<PersonWrite>
        get() = synchronized(records) { records.toList() }

    /**
     * Every queued identify linking an alias onto [externalUserId], in queue order, once the
     * records stored by an earlier launch have loaded.
     */
    internal suspend fun pendingIdentifies(externalUserId: String): List<PersonWrite> {
        restored.await()
        return synchronized(records) {
            records.filter { it.kind == PersonWriteKind.IDENTIFY && it.target == externalUserId }
        }
    }

    /**
     * Whether a write for the person [distinctId] is still queued: an identify linking onto it,
     * or traits for it. A new write for that person has to queue behind them. A revocation does
     * not count: it goes after every other write for its person anyway, and may wait for days.
     */
    internal suspend fun hasPendingWriteFor(distinctId: String): Boolean {
        restored.await()
        return synchronized(records) {
            records.any { it.target == distinctId && it.kind != PersonWriteKind.AD_DATA_SHARING_REVOCATION }
        }
    }

    /**
     * Whether [drain] would send a write at wall-clock time [now]: a due identify, or due traits
     * whose person has no identify still backing off. Reads memory only, so the retry timer can
     * ask on every tick.
     */
    fun hasDue(now: Long): Boolean = synchronized(records) {
        val waiting = records
            .filter { it.kind == PersonWriteKind.IDENTIFY && !isDue(it.availableAt, now, MAX_QUEUE_BACKOFF_MS) }
            .mapTo(HashSet()) { it.target }
        records.any { write ->
            write.key !in directSends &&
                !waitsForSentTraits(write) &&
                isWriteDue(write, now) &&
                !(write.kind != PersonWriteKind.IDENTIFY && write.target in waiting)
        }
    }

    /**
     * Whether [write] is due at [now]. A revocation waiting for its person legitimately waits for up
     * to a day, longer than the ceiling other writes are held to.
     */
    private fun isWriteDue(write: PersonWrite, now: Long): Boolean = isDue(
        write.availableAt,
        now,
        if (write.kind == PersonWriteKind.AD_DATA_SHARING_REVOCATION) REVOCATION_LIFETIME_MS else MAX_QUEUE_BACKOFF_MS,
    )

    /**
     * Whether [write] is a revocation whose person has traits being sent by their caller: an
     * agreement among them has to land first. Must hold the [records] lock.
     */
    private fun waitsForSentTraits(write: PersonWrite): Boolean =
        write.kind == PersonWriteKind.AD_DATA_SHARING_REVOCATION &&
            "TRAITS:${write.distinctId}" in directSends

    /**
     * Queues [write] and returns the record as queued. A traits write is merged into the one
     * already queued for the same person, newer keys winning, so two offline
     * `setPersonAttributes` calls lose neither of their attributes. An identify merges its
     * email and name into one queued for the same alias and target. A merged write keeps its
     * place in the queue and is due immediately. It is persisted before this function returns.
     *
     * With [directSend] the caller sends the write itself and the key stays its own until it calls
     * [endDirectSend], which it must, from a `finally`.
     */
    suspend fun enqueue(write: PersonWrite, directSend: Boolean = false): PersonWrite {
        val queued = synchronized(records) {
            val index = records.indexOfFirst { it.key == write.key }
            val merged = if (index < 0) write else mergePersonWrites(records[index], write)
            val stamped = merged.copy(availableAt = clock.now(), revision = ++lastRevision)
            if (index < 0) records.add(stamped) else records[index] = stamped
            if (directSend) directSends[stamped.key] = (directSends[stamped.key] ?: 0) + 1
            stamped
        }
        persistAndAwait(queued)
        return queued
    }

    /**
     * Queues taking the agreement of the person [distinctId] back, due immediately, and persists it
     * before returning. One already queued keeps its age and its wait.
     *
     * An agreement still queued for the person goes: sent after the revocation, it would undo it.
     */
    internal suspend fun enqueueAdDataSharingRevocation(distinctId: String) {
        restored.await()
        val queued = synchronized(records) {
            val iterator = records.listIterator()
            while (iterator.hasNext()) {
                val write = iterator.next()
                if (write.kind != PersonWriteKind.TRAITS || write.distinctId != distinctId) continue
                val traits = write.traits - AD_DATA_SHARING_TRAIT
                when {
                    traits.size == write.traits.size -> Unit
                    traits.isEmpty() && write.email == null && write.name == null -> iterator.remove()
                    else -> iterator.set(write.copy(traits = traits))
                }
            }
            val now = clock.now()
            val revocation = PersonWrite(
                kind = PersonWriteKind.AD_DATA_SHARING_REVOCATION,
                distinctId = distinctId,
                traits = mapOf(AD_DATA_SHARING_TRAIT to false),
                availableAt = now,
                revision = ++lastRevision,
                queuedAt = now,
            )
            records.firstOrNull { it.key == revocation.key } ?: revocation.also { records.add(it) }
        }
        persistAndAwait(queued)
    }

    /**
     * Drops the revocation queued for the person [distinctId], who agreed again; it would otherwise
     * take the new agreement back. Waits for a drain in flight, which may be sending it, so the
     * agreement lands after it.
     */
    internal suspend fun cancelAdDataSharingRevocation(distinctId: String) {
        restored.await()
        fun isRevocation(write: PersonWrite) =
            write.kind == PersonWriteKind.AD_DATA_SHARING_REVOCATION && write.distinctId == distinctId
        if (synchronized(records) { records.none(::isRevocation) }) return
        drainMutex.withLock {
            if (synchronized(records) { records.removeAll(::isRevocation) }) persist()
        }
    }

    /** The revision the latest enqueue stamped. */
    internal val latestRevision: Long get() = synchronized(records) { lastRevision }

    /**
     * Hands [write]'s key back to [drain] once a direct send of it has settled. Returns whether it
     * was the last direct send that owned the key.
     */
    internal fun endDirectSend(write: PersonWrite): Boolean = synchronized(records) {
        val owners = (directSends[write.key] ?: return false) - 1
        if (owners > 0) directSends[write.key] = owners else directSends.remove(write.key)
        owners == 0
    }

    /**
     * Retries every due write, in queue order, with identifies first.
     *
     * Traits for a person are sent only after every identify linking onto that person was
     * delivered in the same pass: the backend creates the person from the identify. Traits
     * that have to wait keep their retry state. The API's tagged "no such person" answer to a
     * traits write postpones it too, since an identify, an event or a receipt can still create
     * the person. Any other verdict drops the write with a diagnostic: the same payload will be
     * refused again. Transient failures postpone with backoff and keep the record; an
     * authentication pause or an open circuit stops the drain without spending an attempt.
     * Revocations go last, sent through [setTraits]; see the class documentation.
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
            val inOrder = synchronized(records) { records.sortedBy { it.kind.ordinal } }
            val awaitingIdentify = HashSet<String>()
            var changed = false

            for (queued in inOrder) {
                // A person write is only ever postponed by the queue backoff or a `Retry-After`,
                // neither of which exceeds the ceiling.
                val due = isWriteDue(queued, now) &&
                    synchronized(records) { queued.key !in directSends && !waitsForSentTraits(queued) }
                if (!due || queued.kind != PersonWriteKind.IDENTIFY && queued.target in awaitingIdentify) {
                    if (queued.kind == PersonWriteKind.IDENTIFY) awaitingIdentify.add(queued.target)
                    continue
                }
                // Send what is queued now: a merge since the pass started makes it newer.
                val record = synchronized(records) {
                    records.firstOrNull { it.key == queued.key }
                } ?: continue
                try {
                    when (record.kind) {
                        PersonWriteKind.IDENTIFY -> identify(record)
                        PersonWriteKind.TRAITS, PersonWriteKind.AD_DATA_SHARING_REVOCATION -> setTraits(record)
                    }
                    synchronized(records) { removeSent(record) }
                } catch (error: CancellationException) {
                    throw error
                } catch (error: VoidhashCircuitOpenException) {
                    // Nothing was attempted; the records keep their retry state.
                    break
                } catch (error: Throwable) {
                    val failure = classifyFailure(error)
                    if (failure == FailureClass.AUTH) break
                    if (failure == FailureClass.TRANSIENT ||
                        record.kind != PersonWriteKind.IDENTIFY && isPersonNotFound(error)
                    ) {
                        onWarning("Failed to apply a queued person write: ${error.message}")
                        if (record.kind == PersonWriteKind.AD_DATA_SHARING_REVOCATION && isPersonNotFound(error)) {
                            waitForPerson(record)
                        } else {
                            postpone(record, error)
                        }
                        if (record.kind == PersonWriteKind.IDENTIFY) awaitingIdentify.add(record.target)
                    } else {
                        discardInMemory(
                            record,
                            if (error is VoidhashApiException) {
                                "HTTP ${error.status}: ${error.description}"
                            } else {
                                error.message.orEmpty()
                            },
                        )
                    }
                }
                changed = true
            }

            if (changed) persist()
        } finally {
            drainMutex.unlock()
        }
    }

    /**
     * The write queued now under [write]'s key: [write] itself, or a newer merge into it. `null`
     * once it was delivered or dropped.
     */
    internal fun queuedVersionOf(write: PersonWrite): PersonWrite? =
        synchronized(records) { records.firstOrNull { it.key == write.key } }

    /** Settles [sent], a write the backend has applied. */
    internal fun acknowledge(sent: PersonWrite) {
        if (synchronized(records) { removeSent(sent) }) persist()
    }

    /** Settles [sent], a write the API refused, without a diagnostic: its caller reports it. */
    internal fun withdraw(sent: PersonWrite) {
        if (synchronized(records) { removeSent(sent) }) persist()
    }

    /**
     * Takes the agreement to ad data sharing out of every queued traits write, for when analytics
     * consent is withdrawn: agreeing needs consent, the other traits do not. A write left with
     * nothing goes. One still loading from disk is sent without the agreement by the drain while
     * consent stays withdrawn.
     */
    internal fun discardAdDataSharingAgreements() {
        val changed = synchronized(records) {
            var changed = false
            val iterator = records.listIterator()
            while (iterator.hasNext()) {
                val write = iterator.next()
                if (write.kind != PersonWriteKind.TRAITS || AD_DATA_SHARING_TRAIT !in write.traits) continue
                val traits = write.traits - AD_DATA_SHARING_TRAIT
                if (traits.isEmpty() && write.email == null && write.name == null) {
                    iterator.remove()
                } else {
                    iterator.set(write.copy(traits = traits))
                }
                changed = true
            }
            changed
        }
        if (changed) persist()
    }

    /** Drops [write] without retrying; the backend gave a verdict it will repeat. */
    fun discard(write: PersonWrite, reason: String) {
        if (!discardInMemory(write, reason)) return
        persist()
    }

    private fun discardInMemory(write: PersonWrite, reason: String): Boolean {
        if (!synchronized(records) { removeSent(write) }) return false
        diagnostics.emit(
            VoidhashDiagnosticKind.EVICTION,
            code = "PERSON_WRITE_REJECTED",
            operation = "person.drain",
            message = "Dropped a queued ${write.kind.name.lowercase()} write: $reason",
        )
        return true
    }

    /**
     * Removes what [sent] carried from the queue. The record is removed only while it still
     * carries the revision that was sent. A record merged into since keeps whatever the send
     * did not cover: traits whose value changed or that were added, or an identify whose email
     * or name changed. Must hold the [records] lock; returns whether anything was removed.
     */
    private fun removeSent(sent: PersonWrite): Boolean {
        val index = records.indexOfFirst { it.key == sent.key }
        if (index < 0) return false
        val live = records[index]
        if (live.revision == sent.revision) {
            records.removeAt(index)
            return true
        }
        when (live.kind) {
            PersonWriteKind.TRAITS -> {
                val unsent = live.traits.filter { (key, value) ->
                    !sent.traits.containsKey(key) || sent.traits[key] != value
                }
                val emailUnsent = live.email?.takeIf { it != sent.email }
                val nameUnsent = live.name?.takeIf { it != sent.name }
                if (unsent.size == live.traits.size && emailUnsent == live.email && nameUnsent == live.name) return false
                if (unsent.isEmpty() && emailUnsent == null && nameUnsent == null) {
                    records.removeAt(index)
                } else {
                    records[index] = live.copy(traits = unsent, email = emailUnsent, name = nameUnsent)
                }
            }
            PersonWriteKind.IDENTIFY -> {
                if (live.email != sent.email || live.name != sent.name) return false
                records.removeAt(index)
            }
            PersonWriteKind.AD_DATA_SHARING_REVOCATION -> records.removeAt(index)
        }
        return true
    }

    /**
     * Backs off the queued record [sent] was taken from, after an attempt that failed with [error].
     * A cool-down the server named wins, clamped between [MIN_RETRY_AFTER_MS] and
     * [MAX_RETRY_AFTER_MS]. A record merged into since the send started carries newer data and is
     * left due.
     */
    private fun postpone(sent: PersonWrite, error: Throwable) {
        synchronized(records) {
            val index = records.indexOfFirst { it.key == sent.key }
            if (index < 0 || records[index].revision != sent.revision) return
            val live = records[index]
            val delay = (error as? VoidhashApiException)?.retryAfterMs?.coerceIn(MIN_RETRY_AFTER_MS, MAX_RETRY_AFTER_MS)
                ?: backoffDelayMs(live.attempts + 1, QUEUE_BACKOFF_CAP_MS)
            records[index] = live.copy(attempts = live.attempts + 1, availableAt = clock.now() + delay)
        }
    }

    /**
     * Voidhash has no person for the revocation [sent]: asks again later, also on a later launch, as
     * they may still be on their way. Past its lifetime, nothing will come of it.
     */
    private fun waitForPerson(sent: PersonWrite) {
        synchronized(records) {
            val index = records.indexOfFirst { it.key == sent.key }
            if (index < 0) return
            val live = records[index]
            val now = clock.now()
            val queuedAt = live.queuedAt ?: now
            val lastAttemptAt = queuedAt + REVOCATION_LIFETIME_MS
            if (now >= lastAttemptAt) {
                records.removeAt(index)
                return
            }
            records[index] = live.copy(
                attempts = live.attempts + 1,
                availableAt = minOf(now + maxOf(REVOCATION_MIN_WAIT_MS, now - queuedAt), lastAttemptAt),
            )
        }
    }

    /** Snapshots on the writer thread, behind the restore, so disk records are never lost. */
    private fun persist() {
        val write = {
            if (!storeReadFailed && !detached) store.replaceAll(snapshot())
            Unit
        }
        if (writer == null) write() else writer.submit(write)
    }

    private suspend fun persistAndAwait(write: PersonWrite) {
        val persist = {
            if (storeReadFailed || detached) {
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
