package com.voidhash.sdk.analytics

import com.voidhash.sdk.VOIDHASH_SDK_VERSION
import com.voidhash.sdk.VoidhashNetworkException
import com.voidhash.sdk.diagnostics.DiagnosticEmitter
import com.voidhash.sdk.diagnostics.VoidhashDiagnosticKind
import com.voidhash.sdk.network.CircuitPermit
import com.voidhash.sdk.network.OutboundGate
import com.voidhash.sdk.network.QUEUE_BACKOFF_CAP_MS
import com.voidhash.sdk.network.RETRYABLE_STATUS_CODES
import com.voidhash.sdk.network.countsTowardsCircuitBreaker
import com.voidhash.sdk.network.SdkClock
import com.voidhash.sdk.network.SystemSdkClock
import com.voidhash.sdk.network.backoffDelayMs
import com.voidhash.sdk.network.buildSdkHttpClient
import com.voidhash.sdk.network.formatIsoTimestamp
import com.voidhash.sdk.network.parseRetryAfterMs
import com.voidhash.sdk.platform.PlatformInfo
import com.voidhash.sdk.storage.InMemoryRecordStore
import com.voidhash.sdk.storage.PersistenceWriter
import com.voidhash.sdk.storage.RecordStore
import com.voidhash.sdk.storage.sanitizeJsonObject
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Job
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID
import java.util.TimeZone

/**
 * Events per request. Well under the server's hard cap of 100 per batch; the smaller size
 * keeps a single failed send from postponing a large slice of the queue.
 */
private const val ANALYTICS_BATCH_SIZE = 20

/** How often the daemon flushes while the queue is non-empty. */
private const val ANALYTICS_FLUSH_INTERVAL_MS = 5_000L

/** Queue capacity. Overflow evicts the oldest events first. */
internal const val ANALYTICS_QUEUE_CAPACITY = 1_000

/** Persist-behind window: a captured event reaches disk within this. */
internal const val ANALYTICS_PERSIST_DEBOUNCE_MS = 250L

/** Persist-behind batch: this many captures force an immediate write. */
private const val ANALYTICS_PERSIST_BATCH = 20

private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()

/**
 * One queued analytics event.
 *
 * @property sessionId the analytics session the event was captured in.
 * @property attempts how often this event's batch has been postponed.
 * @property availableAt epoch millis before which the event is not sent again.
 */
data class AnalyticsEvent(
    val uuid: String,
    val name: String,
    val distinctId: String,
    val sessionId: String,
    val timestamp: Long,
    val properties: Map<String, Any?>,
    val attempts: Int = 0,
    val availableAt: Long = 0L,
) {
    /**
     * The queue-file line for this event, or `null` when it cannot be encoded even after
     * non-finite numbers were written as `null` at every depth.
     */
    internal fun toRecord(): String? = runCatching {
        val encoded: String? = JSONObject().apply {
            put("uuid", uuid)
            put("name", name)
            put("distinctId", distinctId)
            put("sessionId", sessionId)
            put("timestamp", timestamp)
            put("attempts", attempts)
            put("availableAt", availableAt)
            put("properties", sanitizeJsonObject(properties))
        }.toString()
        encoded
    }.getOrNull()

    internal companion object {
        fun fromRecord(record: String): AnalyticsEvent? {
            val json = runCatching { JSONObject(record) }.getOrNull() ?: return null
            val uuid = json.optString("uuid").takeIf { it.isNotEmpty() } ?: return null
            val properties = json.optJSONObject("properties") ?: JSONObject()
            return AnalyticsEvent(
                uuid = uuid,
                name = json.optString("name"),
                distinctId = json.optString("distinctId"),
                sessionId = json.optString("sessionId"),
                timestamp = json.optLong("timestamp"),
                properties = properties.keys().asSequence().associateWith { key ->
                    properties.get(key).takeUnless { it === JSONObject.NULL }
                },
                attempts = json.optInt("attempts"),
                availableAt = json.optLong("availableAt"),
            )
        }
    }
}

/** Outcome of a [AnalyticsClient.flush]. */
data class FlushStatus(
    /** Events the server accepted during this flush. */
    val flushed: Int,
    /** Events still queued, either postponed or not yet due. */
    val pending: Int,
    /** Why the flush stopped early, when it did. */
    val lastError: String? = null,
)

/**
 * Builds the standardized `$`-prefixed properties every captured event carries,
 * mirroring `src/core/analytics/utils.ts`. `environment` is the SDK's
 * environment mode, the same value sent as the `x-environment` header.
 */
fun analyticsStandardProperties(
    platform: PlatformInfo,
    sdkVersion: String = VOIDHASH_SDK_VERSION,
    environment: String = "production",
    timezone: String? = TimeZone.getDefault().id,
): Map<String, Any?> = mapOf(
    "\$app_build" to platform.appBuild,
    "\$app_name" to (platform.appName ?: platform.bundleId),
    "\$app_version" to platform.appVersion,
    "\$bundle_id" to platform.bundleId,
    "\$device_brand" to platform.deviceBrand,
    "\$device_name" to platform.deviceName,
    "\$environment" to environment,
    "\$locale" to platform.locales.firstOrNull(),
    "\$platform" to "android",
    "\$platform_version" to platform.systemVersion,
    "\$sdk" to "android",
    "\$sdk_version" to sdkVersion,
    "\$timezone" to timezone,
)

/**
 * Durable, batching analytics queue.
 *
 * Captured events are appended to a persistent queue and flushed once 20 are due or every
 * five seconds, whichever comes first. The queue survives process death, so an event
 * captured offline is still delivered after the next launch.
 *
 * Retries are unbounded and backed off: transport failure is a temporary condition, and an
 * attempt cap would turn any outage longer than a few seconds into silent data loss. Events
 * leave the queue for exactly three reasons — the server accepted them, the server gave a
 * verdict it will repeat (a 4xx other than 408/429, or a single event too large to send), or
 * the queue reached its capacity and evicted the oldest to make room. Each of the last two
 * emits a diagnostic.
 *
 * Persistence is handed to [writer] rather than performed inline, so `capture` never touches
 * a file on the thread that called it.
 *
 * @param store persistent backing for the queue.
 * @param sessionIdProvider called at capture time, so every queued event carries the session
 *   it was captured in even if the session rotates before the batch is sent.
 * @param standardProperties resolved once and merged into every event.
 */
class AnalyticsClient(
    ingestUrl: String,
    private val publishableKey: String,
    private val distinctIdProvider: () -> String,
    private val sessionIdProvider: () -> String,
    private val httpClient: OkHttpClient = buildSdkHttpClient(),
    private val dispatcher: CoroutineDispatcher = Dispatchers.IO,
    private val clock: SdkClock = SystemSdkClock,
    private val uuidFactory: () -> String = { UUID.randomUUID().toString() },
    private val standardProperties: () -> Map<String, Any?> = { emptyMap() },
    private val store: RecordStore = InMemoryRecordStore(),
    /**
     * Serializes every write to [store] off the caller's thread. Without one the queue is
     * persisted inline, which is only appropriate in tests.
     */
    private val writer: PersistenceWriter? = null,
    private val gate: OutboundGate? = null,
    private val diagnostics: DiagnosticEmitter = DiagnosticEmitter(),
    private val onWarning: (String) -> Unit = {},
) {
    private val ingestUrl: String = ingestUrl.trimEnd('/')

    /** Host the queue posts to; the circuit breaker is keyed by it. */
    val host: String = runCatching { java.net.URI(this.ingestUrl).host }.getOrNull()
        ?: this.ingestUrl

    /** Ingest-plane breaker key, separate from configuration on the same origin. */
    val circuitKey: String = "ingest:$host"

    private val queue = ArrayList<AnalyticsEvent>()
    private val unpersisted = ArrayList<AnalyticsEvent>()
    private val appendsInFlight = HashSet<String>()

    /** Whether the queue file has fallen behind the queue in a way an append cannot fix. */
    private var queueDirty = false
    private val flushMutex = Mutex()
    private val daemonLock = Any()
    private val inFlightFlushLock = Any()
    private var inFlightFlush: CompletableDeferred<FlushStatus>? = null
    private var daemon: Job? = null
    private var persistJob: Job? = null
    @Volatile
    private var storeReadFailed = false

    /**
     * Completes once the queue held on disk has been merged into memory.
     *
     * Reading the queue file is IO, so it cannot happen while the host is constructing the
     * SDK. Captures made before the load lands are kept in memory and the restored records
     * are inserted *ahead* of them, which is what preserves FIFO across a restart.
     */
    private val restored = CompletableDeferred<Unit>()

    private val resolvedStandardProperties: Map<String, Any?> by lazy(LazyThreadSafetyMode.PUBLICATION) {
        standardProperties()
    }

    init {
        if (writer == null) {
            restoreFromStore()
        } else {
            writer.submit(::restoreFromStore)
        }
    }

    private fun restoreFromStore() {
        val loaded = store.load()
        storeReadFailed = loaded.readFailed
        val fromDisk = loaded.records.mapNotNull(AnalyticsEvent::fromRecord)
        synchronized(queue) {
            val liveIds = queue.mapTo(HashSet()) { it.uuid }
            val recovered = fromDisk.filter { liveIds.add(it.uuid) }
            if (recovered.isNotEmpty()) queue.addAll(0, recovered)
        }
        restored.complete(Unit)
    }

    /** Suspends until the persisted queue has been merged in. */
    internal suspend fun awaitRestored() {
        restored.await()
    }

    /** Number of events waiting to be sent. */
    val queueLength: Int get() = synchronized(queue) { queue.size }

    /** Snapshot of the queue, for tests. */
    internal val queuedEvents: List<AnalyticsEvent> get() = synchronized(queue) { queue.toList() }

    /**
     * Starts the periodic flush daemon in [scope].
     *
     * Every tick runs [onTick] first — the client uses it to probe a paused publishable key
     * once its recovery interval has elapsed, so a foregrounded app is not stuck until the
     * next foreground transition — and then flushes, but only while there is something
     * queued: an idle app must not wake the network or the disk every five seconds.
     */
    fun start(scope: CoroutineScope, onTick: suspend () -> Unit = {}) {
        synchronized(daemonLock) {
            if (daemon != null) return
            daemon = scope.launch {
                while (isActive) {
                    clock.sleep(ANALYTICS_FLUSH_INTERVAL_MS)
                    try {
                        onTick()
                    } catch (error: CancellationException) {
                        throw error
                    } catch (error: Throwable) {
                        // A failing tick is the tick's problem; the daemon keeps flushing.
                        onWarning("Analytics daemon tick failed: ${error.message}")
                    }
                    if (queueLength > 0) flushQuietly()
                }
            }
        }
    }

    /** Stops the periodic flush daemon. */
    fun stop() {
        synchronized(daemonLock) {
            daemon?.cancel()
            daemon = null
        }
    }

    /**
     * Queues an event. Reaching the batch size flushes on the caller's [scope]; otherwise
     * the event reaches disk within the persist-behind window.
     */
    fun capture(
        name: String,
        properties: Map<String, Any?> = emptyMap(),
        scope: CoroutineScope? = null,
    ) {
        val now = clock.now()
        val event = AnalyticsEvent(
            uuid = uuidFactory(),
            name = name,
            distinctId = distinctIdProvider(),
            sessionId = sessionIdProvider(),
            timestamp = now,
            // The standardized properties describe the app and device this event came from,
            // so they win on a key conflict.
            properties = properties + resolvedStandardProperties,
            availableAt = now,
        )

        val evicted = mutableListOf<AnalyticsEvent>()
        val shouldFlush: Boolean
        val shouldPersistNow: Boolean
        synchronized(queue) {
            queue.add(event)
            unpersisted.add(event)
            while (queue.size > ANALYTICS_QUEUE_CAPACITY) {
                evicted.add(queue.removeAt(0))
            }
            if (evicted.isNotEmpty()) {
                queueDirty = true
                val evictedIds = evicted.mapTo(HashSet()) { it.uuid }
                unpersisted.removeAll { it.uuid in evictedIds }
            }
            shouldFlush = queue.size >= ANALYTICS_BATCH_SIZE
            shouldPersistNow = evicted.isNotEmpty() || unpersisted.size >= ANALYTICS_PERSIST_BATCH
        }

        if (evicted.isNotEmpty()) {
            diagnostics.emit(
                VoidhashDiagnosticKind.EVICTION,
                code = "ANALYTICS_EVENT_DROPPED",
                operation = "analytics.capture",
                message = "Dropped ${evicted.size} oldest analytics events: the queue reached " +
                    "its capacity of $ANALYTICS_QUEUE_CAPACITY",
            )
        }

        // Persisting is always handed to the writer: `capture` is called from the UI thread
        // and must never wait on a file.
        if (shouldPersistNow) {
            persistNow()
        } else if (scope != null) {
            schedulePersist(scope)
        } else {
            persistNow()
        }

        if (shouldFlush && scope != null) {
            scope.launch { flushQuietly() }
        }
    }

    /**
     * Sends everything currently due.
     *
     * Only one flush runs at a time; a concurrent caller returns the queue's current state
     * rather than queueing behind the one in flight, so a foreground burst cannot stack up
     * duplicate sends of the same batch.
     */
    suspend fun flush(): FlushStatus {
        // A second caller joins the flush already running instead of being told "nothing
        // happened"; the lock alone would make a foreground burst report a false zero.
        while (true) {
            val shared = CompletableDeferred<FlushStatus>()
            val leader = synchronized(inFlightFlushLock) {
                val raced = inFlightFlush
                if (raced != null) raced else { inFlightFlush = shared; null }
            }
            if (leader != null) {
                try {
                    return leader.await()
                } catch (error: CancellationException) {
                    // The leader's coroutine went away, not this one: a host awaiting a flush
                    // must not be told it was cancelled. Run the flush ourselves instead.
                    currentCoroutineContext().ensureActive()
                    continue
                }
            }

            try {
                val status = flushMutex.withLock { runFlush() }
                shared.complete(status)
                return status
            } catch (error: Throwable) {
                shared.completeExceptionally(error)
                throw error
            } finally {
                synchronized(inFlightFlushLock) { inFlightFlush = null }
            }
        }
    }

    private suspend fun runFlush(): FlushStatus {
        restored.await()
        reloadAfterFailedRead()
        persistAndAwait()
        var flushed = 0
        var lastError: String? = null
        while (true) {
            val batch = takeDueBatch()
            if (batch.isEmpty()) break
            val result = processBatch(batch)
            flushed += result.flushed
            if (result.stop) {
                lastError = result.error
                break
            }
        }
        persistQueue()
        return FlushStatus(flushed = flushed, pending = queueLength, lastError = lastError)
    }

    /** Flushes, reporting failures instead of tearing the flush daemon down. */
    internal suspend fun flushQuietly() {
        try {
            flush()
        } catch (error: CancellationException) {
            throw error
        } catch (error: Throwable) {
            onWarning("Analytics flush failed: ${error.message}")
        }
    }

    /**
     * Queues anything captured but not yet on disk for writing.
     *
     * Returns immediately; the write itself runs on the SDK's writer thread. Called on the
     * capture path and on backgrounding, both of which run on the UI thread.
     */
    fun persistNow() {
        val pending = reserveUnpersisted()
        if (pending.isEmpty()) return
        // Appending only the new lines keeps a capture O(1) on disk; the file is rewritten
        // whole only when a flush compacts it.
        val records = encodeRecords(pending)
        val persist = { completeAppend(pending, store.append(records)) }
        if (writer == null) persist() else writer.submit(persist)
    }

    /** [persistNow], but suspends until the write has landed. */
    suspend fun persistAndAwait() {
        writer?.drain()
        val pending = reserveUnpersisted()
        if (pending.isEmpty()) return
        val records = encodeRecords(pending)
        val persist = { completeAppend(pending, store.append(records)) }
        if (writer == null) persist() else writer.await(persist)
    }

    /**
     * Encodes [events] for the queue file. An event that cannot be encoded is removed from
     * the queue as well: it could not be sent either, and keeping it in memory would only
     * postpone the same verdict to the next flush.
     */
    private fun encodeRecords(events: List<AnalyticsEvent>): List<String> {
        val records = ArrayList<String>(events.size)
        for (event in events) {
            val record = event.toRecord()
            if (record != null) {
                records.add(record)
            } else {
                dropUnencodable(event, "analytics.persist")
            }
        }
        return records
    }

    private fun dropUnencodable(event: AnalyticsEvent, operation: String) {
        synchronized(queue) {
            queue.removeAll { it.uuid == event.uuid }
            unpersisted.removeAll { it.uuid == event.uuid }
            queueDirty = true
        }
        diagnostics.emit(
            VoidhashDiagnosticKind.EVICTION,
            code = "ANALYTICS_EVENT_DROPPED",
            operation = operation,
            message = "Dropped the analytics event ${event.name}, which the SDK could not encode",
        )
        onWarning("Dropping unencodable analytics event ${event.name}")
    }

    private fun reserveUnpersisted(): List<AnalyticsEvent> = synchronized(queue) {
        val snapshot = unpersisted.filterNot { it.uuid in appendsInFlight }
        appendsInFlight.addAll(snapshot.map { it.uuid })
        snapshot
    }

    private fun completeAppend(events: List<AnalyticsEvent>, succeeded: Boolean) {
        val ids = events.mapTo(HashSet()) { it.uuid }
        synchronized(queue) {
            appendsInFlight.removeAll(ids)
            if (succeeded) unpersisted.removeAll { it.uuid in ids }
        }
    }

    private fun schedulePersist(scope: CoroutineScope) {
        // A cancelled scope (the client was shut down) would never run the delayed write.
        if (!scope.isActive) {
            persistNow()
            return
        }
        synchronized(daemonLock) {
            if (persistJob?.isActive == true) return
            persistJob = scope.launch {
                clock.sleep(ANALYTICS_PERSIST_DEBOUNCE_MS)
                persistNow()
            }
        }
    }

    /**
     * Rewrites the queue file to the queue's current contents.
     *
     * The snapshot is taken and handed to the writer as one unit, and the writer runs tasks
     * in submission order, so a compaction can never overwrite an append that was queued
     * after it.
     */
    private suspend fun persistQueue() {
        if (storeReadFailed) return
        val snapshot = synchronized(queue) {
            if (!queueDirty && unpersisted.isEmpty()) return
            queue.toList()
        }
        val records = snapshot.mapNotNull { it.toRecord() }
        val succeeded = if (writer == null) {
            store.replaceAll(records)
        } else {
            var result = false
            writer.await { result = store.replaceAll(records) }
            result
        }
        if (!succeeded) return

        val persistedIds = snapshot.mapTo(HashSet()) { it.uuid }
        synchronized(queue) {
            // The rewrite covers the snapshot; anything that has left the queue since it was
            // sent or dropped, and appending it later would resurrect it on the next launch.
            val live = queue.mapTo(HashSet()) { it.uuid }
            unpersisted.removeAll { it.uuid in persistedIds || it.uuid !in live }
            if (queue == snapshot) queueDirty = false
        }
    }

    private suspend fun reloadAfterFailedRead() {
        if (!storeReadFailed) return
        if (writer == null) restoreFromStore() else writer.await(::restoreFromStore)
    }

    /** Pops the events at the head of the queue whose cool-down has elapsed. */
    private fun takeDueBatch(): List<AnalyticsEvent> = synchronized(queue) {
        val now = clock.now()
        val batch = mutableListOf<AnalyticsEvent>()
        for (event in queue) {
            if (event.availableAt > now || batch.size >= ANALYTICS_BATCH_SIZE) {
                break
            }
            batch.add(event)
        }
        repeat(batch.size) { queue.removeAt(0) }
        batch
    }

    private class BatchResult(val flushed: Int, val stop: Boolean, val error: String? = null)

    private suspend fun processBatch(events: List<AnalyticsEvent>): BatchResult {
        if (events.isEmpty()) return BatchResult(0, stop = false)

        val outcome = try {
            send(events)
        } catch (error: CancellationException) {
            // The batch left `queue` before the send began. Put this exact
            // remainder back before propagating cancellation so a later
            // compaction cannot erase the only durable copy.
            requeue(events)
            throw error
        }
        // Every verdict but a pause changes what the queue file should hold: events left it,
        // or their retry state moved on. A pause puts the batch back exactly as it was.
        if (outcome !is SendOutcome.Pause) synchronized(queue) { queueDirty = true }

        return when (outcome) {
            SendOutcome.Success -> BatchResult(events.size, stop = false)

            SendOutcome.Split -> {
                if (events.size == 1) {
                    diagnostics.emit(
                        VoidhashDiagnosticKind.EVICTION,
                        code = "ANALYTICS_EVENT_DROPPED",
                        operation = "analytics.flush",
                        httpStatus = 413,
                        message = "Dropped the oversized analytics event ${events.first().name}",
                    )
                    onWarning("Dropping oversized analytics event ${events.first().name}")
                    BatchResult(0, stop = false)
                } else {
                    splitAndSend(events)
                }
            }

            is SendOutcome.Retry -> {
                postpone(
                    events,
                    outcome.retryAfterMs?.coerceAtMost(QUEUE_BACKOFF_CAP_MS) ?: backoffDelayMs(
                        events.first().attempts + 1,
                        QUEUE_BACKOFF_CAP_MS,
                    ),
                )
                diagnostics.emit(
                    VoidhashDiagnosticKind.TRANSPORT,
                    code = "ANALYTICS_FLUSH_RETRY",
                    operation = "analytics.flush",
                    retryable = true,
                    httpStatus = outcome.status,
                    message = "Postponed ${events.size} analytics events: ${outcome.reason}",
                )
                BatchResult(0, stop = true, error = outcome.reason)
            }

            is SendOutcome.Drop -> {
                diagnostics.emit(
                    VoidhashDiagnosticKind.EVICTION,
                    code = "ANALYTICS_EVENT_DROPPED",
                    operation = "analytics.flush",
                    httpStatus = outcome.status,
                    message = "Dropped ${events.size} analytics events: ${outcome.reason}",
                )
                onWarning("Dropping ${events.size} analytics events: ${outcome.reason}")
                BatchResult(0, stop = false)
            }

            is SendOutcome.Unserializable -> {
                // A single event the SDK cannot put on the wire is a bug in this SDK, not a
                // server verdict. Isolating it keeps the rest of the batch deliverable.
                if (events.size == 1) {
                    dropUnencodable(events.first(), "analytics.flush")
                    BatchResult(0, stop = false)
                } else {
                    splitAndSend(events)
                }
            }

            is SendOutcome.Pause -> {
                requeue(events)
                BatchResult(0, stop = true, error = outcome.reason)
            }
        }
    }

    /**
     * Halves [events] and sends each half.
     *
     * When the first half has to stop it has already gone back to the head of the queue, so
     * the second half is re-inserted *behind* it. Putting it at the head instead would leave
     * the queue holding the tail before the head and deliver them out of order.
     */
    private suspend fun splitAndSend(events: List<AnalyticsEvent>): BatchResult {
        val half = events.size / 2
        val firstHalf = events.subList(0, half)
        val secondHalf = events.subList(half, events.size)

        val first = try {
            processBatch(firstHalf)
        } catch (error: CancellationException) {
            // The first half put itself back at the head; the second half is still only in
            // memory here and has to follow it, or the next compaction erases it for good.
            requeueAfter(firstHalf.mapTo(mutableSetOf()) { it.uuid }, secondHalf)
            throw error
        }
        if (first.stop) {
            requeueAfter(firstHalf.mapTo(mutableSetOf()) { it.uuid }, secondHalf)
            return first
        }
        val second = processBatch(secondHalf)
        return BatchResult(first.flushed + second.flushed, second.stop, second.error)
    }

    /** Inserts [events] directly after the last queued event whose uuid is in [anchors]. */
    private fun requeueAfter(anchors: Set<String>, events: List<AnalyticsEvent>) {
        synchronized(queue) {
            val lastAnchor = queue.indexOfLast { it.uuid in anchors }
            queue.addAll(lastAnchor + 1, events)
        }
    }

    private suspend fun send(events: List<AnalyticsEvent>): SendOutcome {
        // The platform encoder reports an unwritable document as `null` rather than throwing.
        val body: String? = try {
            buildBody(events).toString()
        } catch (error: Throwable) {
            return SendOutcome.Unserializable(error.message.orEmpty())
        }
        if (body == null) return SendOutcome.Unserializable("the batch is not encodable as JSON")

        val permit = gate?.tryAcquire(circuitKey, "analytics.flush")
        if (gate != null && permit == null) {
            return SendOutcome.Pause(
                if (gate.isPaused) "outbound traffic is paused" else "the circuit is open",
            )
        }

        var settled = false
        try {
            val outcome = post(body, permit)
            settled = true
            return outcome
        } catch (error: CancellationException) {
            throw error
        } catch (error: Throwable) {
            if (error is VoidhashNetworkException) {
                gate?.recordRetryableFailure(permit, "analytics.flush")
                settled = true
                return SendOutcome.Retry(null, null, error.description)
            }
            // Not a transport failure: the host is fine, this SDK is not. Keep the events
            // and report it as our problem.
            diagnostics.emit(
                VoidhashDiagnosticKind.TRANSPORT,
                code = "ANALYTICS_SEND_FAILED",
                operation = "analytics.flush",
                retryable = true,
                message = "The analytics send path failed unexpectedly: ${error.message}",
            )
            return SendOutcome.Retry(null, null, error.message.orEmpty())
        } finally {
            if (!settled) gate?.release(permit)
        }
    }

    /** Re-inserts a batch at the head of the queue, unchanged. */
    private fun requeue(events: List<AnalyticsEvent>) {
        synchronized(queue) { queue.addAll(0, events) }
    }

    /** Re-inserts a failed batch at the head of the queue, due after [delayMs]. */
    private fun postpone(events: List<AnalyticsEvent>, delayMs: Long) {
        val nextAvailableAt = clock.now() + delayMs.coerceAtLeast(1L)
        requeue(events.map { it.copy(attempts = it.attempts + 1, availableAt = nextAvailableAt) })
    }

    private class HttpResult(val status: Int, val body: String, val retryAfter: String?)

    private suspend fun post(body: String, permit: CircuitPermit?): SendOutcome {
        val request = Request.Builder()
            .url("$ingestUrl/i/v1/batch")
            .post(body.toRequestBody(JSON_MEDIA_TYPE))
            .build()

        // The call and the body read share one IO hop: `body.string()` is a blocking socket
        // read, so reading it after `withContext` returned would put the network back on the
        // caller's thread.
        val result = withContext(dispatcher) {
            try {
                httpClient.newCall(request).execute().use { response ->
                    HttpResult(
                        response.code,
                        response.body?.string().orEmpty(),
                        response.header("Retry-After"),
                    )
                }
            } catch (error: IOException) {
                throw VoidhashNetworkException("Failed to reach ${request.url}", error)
            }
        }

        if (result.status == 202) {
            gate?.recordSuccess(permit)
            return SendOutcome.Success
        }
        if (result.status in 200..299) {
            gate?.recordSuccess(permit)
            return SendOutcome.Retry(
                null,
                result.status,
                "status ${result.status}; only 202 confirms delivery",
            )
        }
        if (result.status == 413) {
            gate?.recordSuccess(permit)
            return SendOutcome.Split
        }
        if (result.status == 401 || result.status == 403) {
            gate?.recordAuthFailure(
                permit,
                result.status,
                "analytics.flush",
                "The ingest API rejected the publishable key",
            )
            return SendOutcome.Pause("the publishable key was rejected")
        }
        if (result.status in RETRYABLE_STATUS_CODES) {
            if (countsTowardsCircuitBreaker(result.status)) {
                gate?.recordRetryableFailure(permit, "analytics.flush")
            } else {
                gate?.recordAuthenticatedResponse(permit)
            }
            return SendOutcome.Retry(
                parseRetryAfterMs(
                    result.retryAfter,
                    result.body,
                    clock.now(),
                    capMs = QUEUE_BACKOFF_CAP_MS,
                ),
                result.status,
                "status ${result.status}",
            )
        }
        // Any other 4xx is a verdict about the payload, not about the host.
        gate?.recordAuthenticatedResponse(permit)
        return SendOutcome.Drop(result.status, "status ${result.status}")
    }

    internal fun buildBody(events: List<AnalyticsEvent>): JSONObject = JSONObject().apply {
        val now = clock.now()
        put("token", publishableKey)
        put("sent_at", formatIsoTimestamp(now))
        // The batch's own send time lets the server correct clock skew on events that sat in
        // the queue through an outage.
        put("sent_ts", now)
        put(
            "events",
            JSONArray(
                events.map { event ->
                    JSONObject().apply {
                        put("uuid", event.uuid)
                        put("event", event.name)
                        put("distinct_id", event.distinctId)
                        put("session_id", event.sessionId)
                        put("timestamp", formatIsoTimestamp(event.timestamp))
                        put("context", JSONObject())
                        put("properties", encodeProperties(event))
                    }
                },
            ),
        )
    }

    /**
     * Encodes an event's properties for the wire. Non-finite numbers are not representable
     * in JSON and would make the whole batch unserializable, so they are reported and sent
     * as `null`, however deeply they are nested.
     */
    private fun encodeProperties(event: AnalyticsEvent): JSONObject =
        sanitizeJsonObject(event.properties) { path ->
            onWarning("Dropping non-finite analytics property '$path' on ${event.name}")
        }

    private sealed class SendOutcome {
        object Success : SendOutcome()
        object Split : SendOutcome()
        data class Retry(val retryAfterMs: Long?, val status: Int?, val reason: String) : SendOutcome()
        data class Drop(val status: Int?, val reason: String) : SendOutcome()
        data class Unserializable(val reason: String) : SendOutcome()
        data class Pause(val reason: String) : SendOutcome()
    }
}
