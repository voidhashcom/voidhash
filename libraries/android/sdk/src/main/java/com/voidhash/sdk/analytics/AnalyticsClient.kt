package com.voidhash.sdk.analytics

import com.voidhash.sdk.AnalyticsConsent
import com.voidhash.sdk.VOIDHASH_SDK_VERSION
import com.voidhash.sdk.VoidhashNetworkException
import com.voidhash.sdk.diagnostics.DiagnosticEmitter
import com.voidhash.sdk.diagnostics.VoidhashDiagnosticKind
import com.voidhash.sdk.network.CircuitPermit
import com.voidhash.sdk.network.FailureClass
import com.voidhash.sdk.network.MAX_QUEUE_BACKOFF_MS
import com.voidhash.sdk.network.MAX_RETRY_AFTER_MS
import com.voidhash.sdk.network.MIN_RETRY_AFTER_MS
import com.voidhash.sdk.network.OutboundGate
import com.voidhash.sdk.network.QUEUE_BACKOFF_CAP_MS
import com.voidhash.sdk.network.classifyStatus
import com.voidhash.sdk.network.SdkClock
import com.voidhash.sdk.network.SystemSdkClock
import com.voidhash.sdk.network.backoffDelayMs
import com.voidhash.sdk.network.bodyTextWithinLimit
import com.voidhash.sdk.network.lazySdkHttpClient
import com.voidhash.sdk.network.formatIsoTimestamp
import com.voidhash.sdk.network.isDue
import com.voidhash.sdk.network.parseApiErrorTag
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
import okhttp3.Call
import okhttp3.MediaType.Companion.toMediaType
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
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Events per request. Well under the server's hard cap of 100 per batch; the smaller size
 * keeps a single failed send from postponing a large slice of the queue.
 */
private const val ANALYTICS_BATCH_SIZE = 20

/** How often the daemon flushes while the queue is non-empty. */
private const val ANALYTICS_FLUSH_INTERVAL_MS = 5_000L

/** Queue capacity. Overflow evicts the oldest events first. */
internal const val ANALYTICS_QUEUE_CAPACITY = 1_000

/**
 * Batches one flush sends at most. After an outage every device holds a backlog; sending it a
 * few batches per daemon tick keeps them from all draining it into the recovering API at once.
 */
internal const val MAX_BATCHES_PER_FLUSH = 10

/** Evictions are reported at most this often, with the count since the last report. */
internal const val EVICTION_REPORT_INTERVAL_MS = 60_000L

/** Persist-behind window: a captured event reaches disk within this. */
internal const val ANALYTICS_PERSIST_DEBOUNCE_MS = 250L

/** Persist-behind batch: this many captures force an immediate write. */
private const val ANALYTICS_PERSIST_BATCH = 20

/**
 * Evictions that accumulate before a flush or a capture rewrites the queue file. Until then the
 * file still holds the evicted events ahead of the queue's, and a restore keeps only the newest
 * [ANALYTICS_QUEUE_CAPACITY]; rewriting a full queue for every event captured past the cap would
 * cost a megabyte of disk writes per capture.
 */
private const val EVICTIONS_BEFORE_COMPACTION = ANALYTICS_QUEUE_CAPACITY / 10

private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()

/** The event property naming the groups an event happened in, by group type. */
internal const val GROUPS_PROPERTY = "\$groups"

/**
 * The event that sets a group's properties. It describes a group, not something the end user
 * did, so it carries no `$groups` of its own.
 */
internal const val GROUP_IDENTIFY_EVENT = "\$groupidentify"

/**
 * [properties] with the end user's [groups] in `$groups`, where a group the event names itself
 * wins for its type.
 */
private fun withGroups(properties: Map<String, Any?>, groups: Map<String, String>): Map<String, Any?> {
    if (groups.isEmpty()) return properties
    val named = when (val own = properties[GROUPS_PROPERTY]) {
        is Map<*, *> -> own.entries.associate { (type, key) -> type.toString() to key }
        is JSONObject -> own.keys().asSequence().associateWith { type -> own.opt(type) }
        else -> emptyMap()
    }
    return properties + (GROUPS_PROPERTY to groups + named)
}

/**
 * One queued analytics event.
 *
 * @property sessionId the analytics session the event was captured in.
 * @property attempts how often this event's batch has been postponed.
 * @property availableAt epoch millis before which the event is not sent again.
 * @property isolated set once a request holding only this event was refused without the ingest
 *   API's own answer. The event is kept, and from then on sent in a request of its own, after the
 *   other events that are due; the mark is stored with it, so it holds after a restart.
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
    val isolated: Boolean = false,
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
            if (isolated) put("isolated", true)
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
                isolated = json.optBoolean("isolated"),
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
 * mirroring `src/core/analytics/utils.ts`. Voidhash adds `$environment`, the
 * publishable key's environment, when the event arrives.
 */
fun analyticsStandardProperties(
    platform: PlatformInfo,
    sdkVersion: String = VOIDHASH_SDK_VERSION,
    timezone: String? = TimeZone.getDefault().id,
    sdkName: String = "android",
): Map<String, Any?> = mapOf(
    "\$app_build" to platform.appBuild,
    "\$app_name" to (platform.appName ?: platform.bundleId),
    "\$app_version" to platform.appVersion,
    "\$bundle_id" to platform.bundleId,
    "\$device_brand" to platform.deviceBrand,
    "\$device_name" to platform.deviceName,
    "\$locale" to platform.locales.firstOrNull(),
    "\$platform" to "android",
    "\$platform_version" to platform.systemVersion,
    "\$sdk" to sdkName,
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
 * verdict it will repeat (a Voidhash API error about one event, one too large to send
 * included), or the queue reached its capacity and evicted the oldest to make room. Each of the last
 * two emits a diagnostic. One invalid event makes the ingest API refuse its whole batch, so a
 * refused batch is halved until the invalid event is alone; the rest is delivered. An event
 * without a name or a distinct id is never queued at all.
 *
 * A refusal without the ingest API's own error body — an edge with a smaller size limit, a proxy —
 * drops nothing. The batch is halved the same way, and an event refused on its own is kept and
 * marked [AnalyticsEvent.isolated]: it is retried in a request of its own, never ahead of events
 * that are due, so it cannot hold them back or spend the one request a half-open circuit lets
 * through. Such refusals count against the host only when nothing shows they are about particular
 * events (see [UntaggedRefusals]).
 *
 * Persistence is handed to [writer] rather than performed inline, so `capture` never touches
 * a file, nor encodes one, on the thread that called it.
 *
 * @param store persistent backing for the queue.
 * @param sessionIdProvider called at capture time, so every queued event carries the session
 *   it was captured in even if the session rotates before the batch is sent.
 * @param groupsProvider called at capture time for the groups the end user belongs to, by group
 *   type, which the event carries in `$groups`.
 * @param standardProperties resolved once and merged into every event.
 */
class AnalyticsClient(
    ingestUrl: String,
    private val publishableKey: String,
    private val distinctIdProvider: () -> String,
    private val sessionIdProvider: () -> String,
    private val groupsProvider: () -> Map<String, String> = { emptyMap() },
    private val httpClient: Call.Factory = lazySdkHttpClient(),
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
    /**
     * The end user's analytics consent. Unless it is granted, nothing is queued, restored from
     * disk or sent, and a batch sent as it is withdrawn carries it in `x-analytics-consent`.
     */
    private val consentProvider: () -> AnalyticsConsent = { AnalyticsConsent.GRANTED },
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

    /**
     * The events of the batch being sent that are neither settled nor back in [queue], by uuid.
     * They are still undelivered, so a rewrite of the queue file keeps them, ahead of the queue:
     * the process may be killed before the send settles. Guarded by [queue].
     */
    private val inFlight = LinkedHashMap<String, AnalyticsEvent>()

    /** Whether the queue file has fallen behind the queue in a way an append cannot fix. */
    private var queueDirty = false

    /** Events evicted since the queue file was last rewritten; they are still in it. Guarded by [queue]. */
    private var evictedSinceCompaction = 0

    /** Events evicted for capacity and not reported yet; guarded by [queue]. */
    private var unreportedEvictions = 0

    /** When evictions were last reported, on the monotonic clock; guarded by [queue]. */
    private var lastEvictionReportAt: Long? = null

    /** Set while appends to the queue file fail; captures then leave retrying to flushes. */
    @Volatile
    private var appendFailing = false

    /** Whether an append is queued on [writer] that has not started yet, and covers new captures. */
    private val appendScheduled = AtomicBoolean(false)

    /** Whether a capture queued a rewrite on [writer] that has not started yet. */
    private val compactionScheduled = AtomicBoolean(false)

    private val flushMutex = Mutex()
    private val daemonLock = Any()
    private val inFlightFlushLock = Any()
    private var inFlightFlush: CompletableDeferred<FlushStatus>? = null
    private var daemon: Job? = null
    private var persistJob: Job? = null
    @Volatile
    private var storeReadFailed = false

    /** Set by [detach]; the file then belongs to the client configured after this one. */
    @Volatile
    private var detached = false

    /** Advanced by every [discardQueued]; a batch taken before one is never put back. Guarded by [queue]. */
    private var discardGeneration = 0L

    /** The [discardGeneration] the running flush takes its batches in; guarded by [flushMutex]. */
    private var flushGeneration = 0L

    /** The ingest request in flight, cancelled by [discardQueued]. */
    @Volatile
    private var inFlightCall: Call? = null

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
        // Events queued before consent was withdrawn are never delivered: not while it is
        // withdrawn, nor once it is granted again after a discard the file predates.
        val discarded = synchronized(queue) { discardGeneration > 0 }
        if (discarded || consentProvider() != AnalyticsConsent.GRANTED) {
            if (loaded.records.isNotEmpty() || loaded.readFailed) {
                storeReadFailed = !store.replaceAll(emptyList())
            }
            restored.complete(Unit)
            return
        }
        // An earlier release queued events without a name; the ingest API refuses any batch holding one.
        val (fromDisk, invalid) = loaded.records
            .mapNotNull(AnalyticsEvent::fromRecord)
            .partition { it.name.isNotBlank() && it.distinctId.isNotBlank() }
        synchronized(queue) {
            val liveIds = queue.mapTo(HashSet()) { it.uuid }
            val recovered = fromDisk.filter { liveIds.add(it.uuid) }
            if (recovered.isNotEmpty()) queue.addAll(0, recovered)
            if (invalid.isNotEmpty()) queueDirty = true
            // The file is rewritten only every so many evictions, so it can hold more than the
            // queue did; the queue had kept the newest events.
            val excess = queue.size - ANALYTICS_QUEUE_CAPACITY
            if (excess > 0) {
                val trimmed = queue.subList(0, excess)
                val trimmedIds = trimmed.mapTo(HashSet()) { it.uuid }
                trimmed.clear()
                unpersisted.removeAll { it.uuid in trimmedIds }
                evictedSinceCompaction += excess
            }
        }
        if (invalid.isNotEmpty()) {
            reportInvalidEvent(
                "Dropped ${invalid.size} stored analytics events without a name or a distinct id",
                operation = "analytics.restore",
            )
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

    /** Events captured but not written to the queue file yet, for tests. */
    internal val unpersistedCount: Int get() = synchronized(queue) { unpersisted.size }

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

    /**
     * Hands the queue file over to the client configured after this one: a flush still in flight
     * here no longer rewrites the file from this queue, which may predate what that client wrote.
     */
    internal fun detach() {
        detached = true
    }

    /** Stops the periodic flush daemon. */
    fun stop() {
        synchronized(daemonLock) {
            daemon?.cancel()
            daemon = null
        }
    }

    /**
     * Drops every queued event, in memory and on disk, and cancels the batch in flight, which is
     * not put back whatever its outcome. For when analytics consent is withdrawn; call it after
     * [consentProvider] stopped answering granted, so no capture slips in behind it.
     */
    internal fun discardQueued() {
        synchronized(queue) {
            discardGeneration++
            queue.clear()
            inFlight.clear()
            unpersisted.clear()
            queueDirty = false
            evictedSinceCompaction = 0
        }
        inFlightCall?.cancel()
        val wipe = {
            // Behind the restore on the writer, so what it loads is gone too.
            if (!detached) storeReadFailed = !store.replaceAll(emptyList())
        }
        if (writer == null) wipe() else writer.submit(wipe)
    }

    /**
     * Queues an event. Reaching the batch size flushes on the caller's [scope]; otherwise
     * the event reaches disk within the persist-behind window.
     *
     * The name is trimmed. An event with a blank name, or captured while there is no distinct id
     * to attribute it to, is not queued: the ingest API would refuse it, and with it every event
     * sent in the same batch. It is reported as `ANALYTICS_EVENT_INVALID` instead.
     *
     * The distinct id, session and the end user's groups are read here, so the event keeps those
     * it was captured under.
     */
    fun capture(
        name: String,
        properties: Map<String, Any?> = emptyMap(),
        scope: CoroutineScope? = null,
    ) {
        capture(name, properties, scope, capturedAt = null, sendWhenFull = true)
    }

    /**
     * [capture] for an event that happened at [capturedAt] (epoch millis; `null` for now), which a
     * caller that held it back queues late. With [sendWhenFull] off a full batch waits for the next
     * flush instead of being sent from here.
     */
    internal fun capture(
        name: String,
        properties: Map<String, Any?>,
        scope: CoroutineScope?,
        capturedAt: Long?,
        sendWhenFull: Boolean,
    ) {
        if (consentProvider() != AnalyticsConsent.GRANTED) return
        val eventName = name.trim()
        if (eventName.isEmpty()) {
            reportInvalidEvent("Ignored an analytics event with a blank name")
            return
        }
        val distinctId = distinctIdProvider()
        if (distinctId.isBlank()) {
            reportInvalidEvent("Ignored the analytics event $eventName: there is no distinct id to attribute it to")
            return
        }
        val now = clock.now()
        val event = AnalyticsEvent(
            uuid = uuidFactory(),
            name = eventName,
            distinctId = distinctId,
            sessionId = sessionIdProvider(),
            timestamp = capturedAt ?: now,
            // The standardized properties describe the app and device this event came from,
            // so they win on a key conflict.
            properties = withGroups(
                properties,
                if (eventName == GROUP_IDENTIFY_EVENT) emptyMap() else groupsProvider(),
            ) + resolvedStandardProperties,
            availableAt = now,
        )

        val evicted = mutableListOf<AnalyticsEvent>()
        var evictionsToReport = 0
        val shouldFlush: Boolean
        val shouldPersistNow: Boolean
        val shouldCompact: Boolean
        synchronized(queue) {
            // Checked again under the lock that [discardQueued] clears the queue under, so a
            // capture racing a withdrawal of consent is either refused or cleared with the rest.
            if (consentProvider() != AnalyticsConsent.GRANTED) return
            queue.add(event)
            unpersisted.add(event)
            while (queue.size > ANALYTICS_QUEUE_CAPACITY) {
                evicted.add(queue.removeAt(0))
            }
            if (evicted.isNotEmpty()) {
                // The evicted events stay in the file until a compaction; appending the new one is
                // all this capture writes.
                evictedSinceCompaction += evicted.size
                val evictedIds = evicted.mapTo(HashSet()) { it.uuid }
                unpersisted.removeAll { it.uuid in evictedIds }
                unreportedEvictions += evicted.size
                val lastReport = lastEvictionReportAt
                if (lastReport == null || clock.elapsed() - lastReport >= EVICTION_REPORT_INTERVAL_MS) {
                    evictionsToReport = takeUnreportedEvictions()
                }
            }
            // With the head of the queue backing off a flush sends nothing; all it would do is
            // write this one event to the file on its own, capture after capture of an outage.
            shouldFlush = queue.size >= ANALYTICS_BATCH_SIZE && hasDueEvent(now)
            shouldPersistNow = unpersisted.size >= ANALYTICS_PERSIST_BATCH
            shouldCompact = evictedSinceCompaction >= EVICTIONS_BEFORE_COMPACTION
        }

        reportEvictions(evictionsToReport)

        // Persisting is always handed to the writer: `capture` is called from the UI thread
        // and must never wait on a file. While appends fail, the next flush and backgrounding
        // retry them; every capture trying again would only repeat the failure.
        if (!appendFailing) {
            if (shouldPersistNow || scope == null) persistNow() else schedulePersist(scope)
        }
        // Flushes rewrite the file as evictions add up, but nothing flushes in the background or
        // while the head of the queue backs off, and the file would grow with every capture.
        if (shouldCompact && compactionScheduled.compareAndSet(false, true)) {
            val compact = {
                compactionScheduled.set(false)
                compact(EVICTIONS_BEFORE_COMPACTION)
            }
            if (writer == null) compact() else writer.submit(compact)
        }

        // A paused key or an open circuit sends nothing; the daemon and the next foreground or
        // reconnect resume sending.
        if (sendWhenFull && shouldFlush && scope != null && gate?.isBlocked(circuitKey) != true) {
            scope.launch { flushQuietly() }
        }
    }

    /**
     * Whether [takeDueBatch] would take anything at [now]: an event that is due, with nothing
     * ahead of it but events retried on their own. Hold [queue].
     */
    private fun hasDueEvent(now: Long): Boolean {
        for (event in queue) {
            if (isDue(event.availableAt, now, MAX_QUEUE_BACKOFF_MS)) return true
            if (!event.isolated) return false
        }
        return false
    }

    /** Takes the evictions not reported yet and restarts the report interval; hold [queue]. */
    private fun takeUnreportedEvictions(): Int {
        val count = unreportedEvictions
        unreportedEvictions = 0
        if (count > 0) lastEvictionReportAt = clock.elapsed()
        return count
    }

    private fun reportEvictions(count: Int) {
        if (count == 0) return
        diagnostics.emit(
            VoidhashDiagnosticKind.EVICTION,
            code = "ANALYTICS_EVENT_DROPPED",
            operation = "analytics.capture",
            message = "Dropped $count oldest analytics events: the queue reached its capacity of " +
                "$ANALYTICS_QUEUE_CAPACITY",
        )
    }

    /**
     * Reports the evictions the once-a-minute limit held back. Called when delivery resumes and
     * when the client stops, so the last count of an outage is never lost.
     */
    internal fun reportPendingEvictions() {
        reportEvictions(synchronized(queue) { takeUnreportedEvictions() })
    }

    private fun reportInvalidEvent(message: String, operation: String = "analytics.capture") {
        diagnostics.emit(
            VoidhashDiagnosticKind.EVICTION,
            code = "ANALYTICS_EVENT_INVALID",
            operation = operation,
            message = message,
        )
        onWarning(message)
    }

    /**
     * Sends what is currently due, at most [MAX_BATCHES_PER_FLUSH] batches; the daemon sends the
     * rest on its next ticks.
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
        if (consentProvider() != AnalyticsConsent.GRANTED) return FlushStatus(flushed = 0, pending = queueLength)
        flushGeneration = synchronized(queue) { discardGeneration }
        reloadAfterFailedRead()
        persistAndAwait()
        var flushed = 0
        var lastError: String? = null
        var batches = 0
        while (batches++ < MAX_BATCHES_PER_FLUSH) {
            val batch = takeDueBatch()
            if (batch.isEmpty()) break
            val result = try {
                processBatch(batch, UntaggedRefusals(batch.size))
            } finally {
                // Every event of the batch was delivered, dropped or put back by now.
                synchronized(queue) { inFlight.clear() }
            }
            flushed += result.flushed
            if (result.stop) {
                lastError = result.error
                break
            }
        }
        if (flushed > 0) reportPendingEvictions()
        if (writer == null) {
            compact(EVICTIONS_BEFORE_COMPACTION)
        } else {
            writer.await { compact(EVICTIONS_BEFORE_COMPACTION) }
        }
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
     * Returns immediately; encoding and writing run on the SDK's writer thread. Called on the
     * capture path and on backgrounding, both of which run on the UI thread.
     */
    fun persistNow() {
        if (writer == null) {
            appendUnpersisted()
            return
        }
        // An append still waiting for the writer covers every capture made before it starts.
        if (appendScheduled.compareAndSet(false, true)) {
            writer.submit {
                appendScheduled.set(false)
                appendUnpersisted()
            }
        }
    }

    /**
     * [persistNow], but suspends until the write has landed, and returns whether every event queued
     * when it was called is in the store. On `false` the events stay queued in memory, and a later
     * write carries them.
     */
    suspend fun persistAndAwait(): Boolean {
        if (writer == null) return appendUnpersisted()
        var appended = false
        writer.await { appended = appendUnpersisted() }
        return appended
    }

    /**
     * [persistNow], plus a rewrite of the queue file when evictions left events in it that the
     * queue no longer holds, so a process killed next restores exactly the queue. For
     * backgrounding and shutdown; returns immediately.
     */
    internal fun persistAndCompact() {
        persistNow()
        if (writer == null) compact(evictionThreshold = 1) else writer.submit { compact(evictionThreshold = 1) }
    }

    /**
     * Appends the events not on disk yet. Appending only the new lines keeps a capture O(1) on
     * disk; the file is rewritten whole only when it is compacted.
     */
    private fun appendUnpersisted(): Boolean {
        val pending = reserveUnpersisted()
        if (pending.isEmpty()) return true
        val appended = store.append(encodeRecords(pending))
        completeAppend(pending, appended)
        return appended
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
            inFlight.remove(event.uuid)
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
        appendFailing = !succeeded
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
     * Rewrites the queue file to the undelivered events — the batch being sent, then the queue —
     * when it has fallen behind: events left the queue or changed, an append failed, or
     * [evictionThreshold] events were evicted since the last rewrite. Runs on the writer when
     * there is one.
     *
     * The snapshot is taken, encoded and written in this one task. The writer runs tasks in
     * submission order, so every append queued before it is in the snapshot, and none queued
     * after it can be overwritten.
     */
    private fun compact(evictionThreshold: Int) {
        if (storeReadFailed || detached) return
        val (snapshot, evictedAtSnapshot) = synchronized(queue) {
            val behind = queueDirty || appendFailing && unpersisted.isNotEmpty() ||
                evictedSinceCompaction >= evictionThreshold
            if (!behind) return
            undelivered() to evictedSinceCompaction
        }
        val succeeded = store.replaceAll(snapshot.mapNotNull { it.toRecord() })

        val persistedIds = snapshot.mapTo(HashSet()) { it.uuid }
        synchronized(queue) {
            // Anything that is neither queued nor being sent was delivered or dropped, whether or
            // not the rewrite landed: appending it later would resurrect it on the next launch.
            val current = undelivered()
            val live = current.mapTo(HashSet()) { it.uuid }
            unpersisted.removeAll { it.uuid !in live || succeeded && it.uuid in persistedIds }
            if (succeeded) {
                if (current == snapshot) queueDirty = false
                evictedSinceCompaction -= evictedAtSnapshot
            }
        }
        if (succeeded) appendFailing = false
    }

    /** What the queue file should hold: the batch being sent, then the queue. Hold [queue]. */
    private fun undelivered(): List<AnalyticsEvent> {
        if (inFlight.isEmpty()) return queue.toList()
        // An event put back since, postponed or not, is the queue's again.
        val queued = queue.mapTo(HashSet()) { it.uuid }
        return inFlight.values.filter { it.uuid !in queued } + queue
    }

    private suspend fun reloadAfterFailedRead() {
        if (!storeReadFailed) return
        if (writer == null) restoreFromStore() else writer.await(::restoreFromStore)
    }

    /**
     * Pops the next request's events: the events at the head of the queue whose cool-down has
     * elapsed, or, when none is due, one [AnalyticsEvent.isolated] event that is. The jittered
     * backoff ceiling is the longest delay an event can be postponed by; one due further out than
     * that was stamped under a wall clock that has since moved back.
     *
     * A batch backing off holds back everything behind it, so an outage is not retried once per
     * batch. An isolated event does not: the events behind it are sent past it, due or not, and it
     * goes out alone only once nothing else is due, so the request a half-open circuit lets
     * through is never spent on an event already known to be refused.
     */
    private fun takeDueBatch(): List<AnalyticsEvent> = synchronized(queue) {
        if (discardGeneration != flushGeneration) return emptyList()
        val now = clock.now()
        val batch = mutableListOf<AnalyticsEvent>()
        var alone: AnalyticsEvent? = null
        for (event in queue) {
            val due = isDue(event.availableAt, now, MAX_QUEUE_BACKOFF_MS)
            if (event.isolated) {
                if (due && alone == null) alone = event
                continue
            }
            if (!due) break
            batch.add(event)
            if (batch.size == ANALYTICS_BATCH_SIZE) break
        }
        if (batch.isEmpty()) alone?.let(batch::add)
        val taken = batch.mapTo(HashSet()) { it.uuid }
        queue.removeAll { it.uuid in taken }
        batch.forEach { inFlight[it.uuid] = it }
        batch
    }

    /**
     * What the requests of one batch refused without the ingest API's own answer have shown, while
     * the batch is halved.
     *
     * Such a refusal says either that an edge will not take one of the events, or that something
     * in front of the API answers every request that way. An accepted request among the halves
     * settles it for the first, and nothing is held against the host. Two events refused on their
     * own with nothing accepted — or the one event the batch held — settle it for the second: the
     * halving stops, and the batch counts as one failed request towards the circuit breaker.
     * Counting every halved request instead would open the circuit on a single refused event at
     * the head of a batch, before any request without it was tried.
     *
     * @property batchSize how many events the batch held before it was halved.
     */
    private class UntaggedRefusals(val batchSize: Int) {
        /** Whether the ingest API answered a request of the batch itself, accepting it or not. */
        var answered = false

        /** Events refused in a request of their own. */
        var refusedAlone = 0
    }

    private class BatchResult(val flushed: Int, val stop: Boolean, val error: String? = null)

    private suspend fun processBatch(events: List<AnalyticsEvent>, refusals: UntaggedRefusals): BatchResult {
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
        // or their retry state moved on. A pause puts the batch back exactly as it was, which is
        // also how a rewrite made while it was out stored it.
        if (outcome !is SendOutcome.Pause) synchronized(queue) { queueDirty = true }

        return when (outcome) {
            SendOutcome.Success -> {
                refusals.answered = true
                settled(events)
                BatchResult(events.size, stop = false)
            }

            is SendOutcome.Retry -> {
                postpone(
                    events,
                    outcome.retryAfterMs?.coerceIn(MIN_RETRY_AFTER_MS, MAX_RETRY_AFTER_MS) ?: backoffDelayMs(
                        events.first().attempts + 1,
                        QUEUE_BACKOFF_CAP_MS,
                    ),
                )
                diagnostics.emit(
                    VoidhashDiagnosticKind.TRANSPORT,
                    code = "ANALYTICS_SEND_FAILED",
                    operation = "analytics.flush",
                    retryable = true,
                    httpStatus = outcome.status,
                    message = "Postponed ${events.size} analytics events: ${outcome.reason}",
                )
                BatchResult(0, stop = true, error = outcome.reason)
            }

            // One invalid or oversized event makes the ingest API refuse the whole request;
            // halving the batch isolates it and delivers the rest.
            is SendOutcome.Invalid -> when {
                events.size > 1 -> {
                    if (outcome.tagged) refusals.answered = true
                    splitAndSend(events, refusals)
                }
                outcome.tagged -> {
                    refusals.answered = true
                    val event = events.single()
                    settled(events)
                    diagnostics.emit(
                        VoidhashDiagnosticKind.EVICTION,
                        code = "ANALYTICS_EVENT_DROPPED",
                        operation = "analytics.flush",
                        httpStatus = outcome.status,
                        message = if (outcome.status == 413) {
                            "Dropped the oversized analytics event ${event.name}"
                        } else {
                            "Dropped the analytics event ${event.name}, which the ingest API refused"
                        },
                    )
                    onWarning("Dropping analytics event ${event.name}: ${outcome.reason}")
                    BatchResult(0, stop = false)
                }
                else -> {
                    // Without a Voidhash error body the refusal may not be about this event at all:
                    // it is kept and retried on its own, and the events behind it go on.
                    val event = events.single()
                    postpone(
                        listOf(event.copy(isolated = true)),
                        backoffDelayMs(event.attempts + 1, QUEUE_BACKOFF_CAP_MS),
                    )
                    diagnostics.emit(
                        VoidhashDiagnosticKind.TRANSPORT,
                        code = "ANALYTICS_SEND_FAILED",
                        operation = "analytics.flush",
                        retryable = true,
                        httpStatus = outcome.status,
                        message = "Postponed the analytics event ${event.name}: ${outcome.reason}",
                    )
                    refusals.refusedAlone += 1
                    when {
                        // One retry of an event already known to be refused says nothing new about
                        // the host and is not held against it; a flush makes one such retry at most.
                        event.isolated -> BatchResult(0, stop = true, error = outcome.reason)
                        // Something accepted or answered by the API itself: this event is the matter.
                        refusals.answered -> BatchResult(0, stop = false)
                        // A second event refused alone, or the only one the request ever held, and
                        // nothing accepted: as far as anyone can tell the host refuses everything.
                        refusals.refusedAlone >= 2 || refusals.batchSize == 1 -> {
                            gate?.let { it.recordRetryableFailure(it.tryAcquire(circuitKey), "analytics.flush") }
                            BatchResult(0, stop = true, error = outcome.reason)
                        }
                        else -> BatchResult(0, stop = false)
                    }
                }
            }

            is SendOutcome.Drop -> {
                refusals.answered = true
                settled(events)
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
                    splitAndSend(events, refusals)
                }
            }

            is SendOutcome.Pause -> {
                requeue(events)
                BatchResult(0, stop = true, error = outcome.reason)
            }
        }
    }

    /** Takes [events], which were delivered or dropped, out of the batch being sent. */
    private fun settled(events: List<AnalyticsEvent>) {
        synchronized(queue) { events.forEach { inFlight.remove(it.uuid) } }
    }

    /**
     * Halves [events] and sends each half.
     *
     * When the first half has to stop it has already gone back to the head of the queue, so
     * the second half is re-inserted *behind* it. Putting it at the head instead would leave
     * the queue holding the tail before the head and deliver them out of order.
     */
    private suspend fun splitAndSend(events: List<AnalyticsEvent>, refusals: UntaggedRefusals): BatchResult {
        val half = events.size / 2
        val firstHalf = events.subList(0, half)
        val secondHalf = events.subList(half, events.size)

        val first = try {
            processBatch(firstHalf, refusals)
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
        val second = processBatch(secondHalf, refusals)
        return BatchResult(first.flushed + second.flushed, second.stop, second.error)
    }

    /** Inserts [events] directly after the last queued event whose uuid is in [anchors]. */
    private fun requeueAfter(anchors: Set<String>, events: List<AnalyticsEvent>) {
        synchronized(queue) {
            if (discardGeneration != flushGeneration) return
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

        val permit = gate?.tryAcquire(circuitKey)
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
            // A request cancelled because consent was withdrawn says nothing about the host.
            if (synchronized(queue) { discardGeneration != flushGeneration }) {
                return SendOutcome.Pause("analytics consent was withdrawn")
            }
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

    /** Re-inserts a batch at the head of the queue, unchanged, unless the queue was discarded since. */
    private fun requeue(events: List<AnalyticsEvent>) {
        synchronized(queue) {
            if (discardGeneration == flushGeneration) queue.addAll(0, events)
        }
    }

    /** Re-inserts a failed batch at the head of the queue, due after [delayMs]. */
    private fun postpone(events: List<AnalyticsEvent>, delayMs: Long) {
        val nextAvailableAt = clock.now() + delayMs.coerceAtLeast(1L)
        requeue(events.map { it.copy(attempts = it.attempts + 1, availableAt = nextAvailableAt) })
    }

    private class HttpResult(val status: Int, val body: String, val retryAfter: String?)

    /** The request that posts [body], a batch, to the ingest API, naming a consent that is not granted. */
    private fun batchRequest(body: String): Request {
        val consent = consentProvider()
        return Request.Builder()
            .url("$ingestUrl/i/v1/batch")
            .post(body.toRequestBody(JSON_MEDIA_TYPE))
            .apply { if (consent != AnalyticsConsent.GRANTED) header("x-analytics-consent", consent.wireValue) }
            .build()
    }

    /**
     * Sends one `$groupidentify` with [properties] (`$group_type`, `$group_key` and, when the
     * group has properties, `$group_set`), made at [timestamp], as a batch of its own and returns
     * whether the ingest API took the request. For a group described while analytics consent is
     * not granted: a group is what the app says about the end user, not something observed, so
     * it is sent whatever the consent, but outside the queue. The event names [distinctId], no
     * session, no groups and nothing about the device, nothing is stored for it, and it is not
     * retried.
     *
     * A paused publishable key stops it. The circuit breaker does not, and learns nothing from the
     * outcome: one best-effort request says too little about the host to open or close it.
     */
    internal suspend fun sendGroupDescription(
        distinctId: String,
        properties: Map<String, Any?>,
        timestamp: Long,
    ): Boolean {
        if (gate?.isPaused == true || distinctId.isBlank()) return false
        return try {
            withContext(dispatcher) {
                val event = AnalyticsEvent(
                    uuid = uuidFactory(),
                    name = GROUP_IDENTIFY_EVENT,
                    distinctId = distinctId,
                    sessionId = "",
                    timestamp = timestamp,
                    properties = properties,
                )
                httpClient.newCall(batchRequest(buildBody(listOf(event)).toString())).execute().use { it.isSuccessful }
            }
        } catch (error: IOException) {
            false
        }
    }

    private suspend fun post(body: String, permit: CircuitPermit?): SendOutcome {
        val request = batchRequest(body)

        // The call and the body read share one IO hop: `body.string()` is a blocking socket
        // read, so reading it after `withContext` returned would put the network back on the
        // caller's thread.
        val result = withContext(dispatcher) {
            val call = httpClient.newCall(request)
            inFlightCall = call
            // A discard that ran before the call was published could not cancel it.
            if (synchronized(queue) { discardGeneration != flushGeneration }) call.cancel()
            try {
                call.execute().use { response ->
                    // A body longer than the SDK reads is nobody's error document: only the status counts.
                    HttpResult(response.code, response.bodyTextWithinLimit().orEmpty(), response.header("Retry-After"))
                }
            } catch (error: IOException) {
                throw VoidhashNetworkException("Failed to reach ${request.url}", error)
            } finally {
                inFlightCall = null
            }
        }

        if (result.status == 202) {
            gate?.recordSuccess(permit, "analytics.flush")
            return SendOutcome.Success
        }
        if (result.status in 200..299) {
            // Something other than the ingest API answered, a captive portal typically: it counts
            // against the host like any outage, or a portal answering every request would keep
            // the circuit closed.
            gate?.recordRetryableFailure(permit, "analytics.flush")
            return SendOutcome.Retry(
                null,
                result.status,
                "status ${result.status}; only 202 confirms delivery",
            )
        }
        // Only a tagged API error is the ingest API's answer, about the key or about the payload.
        // An untagged one, a 401 or 403 included, comes from something in front of the API and
        // keeps the batch, like any outage does.
        val tagged = parseApiErrorTag(result.body) != null
        if (classifyStatus(result.status, tagged) == FailureClass.AUTH) {
            gate?.recordAuthFailure(
                permit,
                result.status,
                "analytics.flush",
                "The ingest API rejected the publishable key",
            )
            return SendOutcome.Pause("the publishable key was rejected")
        }
        // A 400 is bisected whatever its body says: earlier API versions refused an invalid
        // event with an empty one. So is a 413, which an edge with a smaller limit than the API's
        // answers too. Untagged, the permit is handed back without a verdict: whether the refusal
        // counts against the host is decided for the batch as a whole (see [UntaggedRefusals]).
        if (result.status == 400 || result.status == 413 || result.status == 422 && tagged) {
            if (tagged) {
                gate?.recordAuthenticatedResponse(permit)
            } else {
                gate?.release(permit)
            }
            return SendOutcome.Invalid(result.status, tagged, "status ${result.status}")
        }
        if (classifyStatus(result.status, tagged) == FailureClass.VERDICT) {
            gate?.recordAuthenticatedResponse(permit)
            return SendOutcome.Drop(result.status, "status ${result.status}")
        }
        val retryAfterMs = parseRetryAfterMs(result.retryAfter, result.body, clock.now())
        if (result.status == 429) {
            gate?.recordThrottled(permit, "analytics.flush", retryAfterMs)
        } else {
            gate?.recordRetryableFailure(permit, "analytics.flush")
        }
        return SendOutcome.Retry(retryAfterMs, result.status, "status ${result.status}")
    }

    internal fun buildBody(events: List<AnalyticsEvent>): JSONObject = JSONObject().apply {
        val now = clock.now()
        // An empty token fails the request schema, a 400 the queue would take for a verdict on
        // each event; without one the API answers 401 and the queue waits for a usable key.
        if (publishableKey.isNotBlank()) put("token", publishableKey)
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
                        // Optional on the wire, but refused when present and empty.
                        if (event.sessionId.isNotBlank()) put("session_id", event.sessionId)
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
        data class Retry(val retryAfterMs: Long?, val status: Int?, val reason: String) : SendOutcome()
        data class Drop(val status: Int?, val reason: String) : SendOutcome()

        /** Refused for what an event holds; [tagged] when the ingest API said so itself. */
        data class Invalid(val status: Int, val tagged: Boolean, val reason: String) : SendOutcome()
        data class Unserializable(val reason: String) : SendOutcome()
        data class Pause(val reason: String) : SendOutcome()
    }
}
