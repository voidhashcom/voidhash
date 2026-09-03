package com.voidhash.sdk.analytics

import com.voidhash.sdk.VOIDHASH_SDK_VERSION
import com.voidhash.sdk.VoidhashNetworkException
import com.voidhash.sdk.platform.PlatformInfo
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
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

private const val ANALYTICS_BATCH_SIZE = 20
private const val ANALYTICS_FLUSH_INTERVAL_MS = 5_000L
private const val MAX_ANALYTICS_ATTEMPTS = 3
private const val MAX_ANALYTICS_RETRY_DELAY_MS = 30_000L

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
 * Batching analytics capture queue.
 *
 * Events are flushed once 20 are queued or every 5 seconds, whichever comes
 * first. A batch that fails with a retryable status is retried inline up to 3
 * attempts with exponential backoff and then postponed in the queue — a
 * `Retry-After` response skips the inline retries and postpones straight away,
 * so the cool-down never holds the flush lock. A `413` splits the batch in
 * half; only non-retryable failures drop events, with a warning.
 *
 * @param sessionIdProvider called at capture time, so every queued event
 *   carries the session it was captured in even if the session rotates before
 *   the batch is sent.
 * @param standardProperties resolved once and merged into every event.
 */
class AnalyticsClient(
    ingestUrl: String,
    private val publishableKey: String,
    private val distinctIdProvider: () -> String,
    private val sessionIdProvider: () -> String,
    private val httpClient: OkHttpClient = OkHttpClient(),
    private val dispatcher: CoroutineDispatcher = Dispatchers.IO,
    private val clock: () -> Long = { System.currentTimeMillis() },
    private val uuidFactory: () -> String = { UUID.randomUUID().toString() },
    private val sleep: suspend (Long) -> Unit = { delay(it) },
    private val standardProperties: () -> Map<String, Any?> = { emptyMap() },
    private val onWarning: (String) -> Unit = {},
) {
    private val ingestUrl: String = ingestUrl.trimEnd('/')
    private val queue = mutableListOf<AnalyticsEvent>()
    private val flushMutex = Mutex()
    private var daemon: Job? = null

    private val resolvedStandardProperties: Map<String, Any?> by lazy(LazyThreadSafetyMode.PUBLICATION) {
        standardProperties()
    }

    /** Number of events waiting to be sent. */
    val queueLength: Int get() = synchronized(queue) { queue.size }

    /** Snapshot of the queue, for tests. */
    internal val queuedEvents: List<AnalyticsEvent> get() = synchronized(queue) { queue.toList() }

    /** Starts the periodic flush daemon in [scope]. */
    fun start(scope: CoroutineScope) {
        if (daemon != null) return
        daemon = scope.launch {
            while (isActive) {
                sleep(ANALYTICS_FLUSH_INTERVAL_MS)
                flushQuietly()
            }
        }
    }

    /** Stops the periodic flush daemon. */
    fun stop() {
        daemon?.cancel()
        daemon = null
    }

    /**
     * Queues an event. When the queue reaches the batch size the caller's
     * [scope] flushes it immediately.
     */
    fun capture(
        name: String,
        properties: Map<String, Any?> = emptyMap(),
        scope: CoroutineScope? = null,
    ) {
        val now = clock()
        val event = AnalyticsEvent(
            uuid = uuidFactory(),
            name = name,
            distinctId = distinctIdProvider(),
            sessionId = sessionIdProvider(),
            timestamp = now,
            // The standardized properties describe the app and device this
            // event came from, so they win on a key conflict — same merge order
            // as `mapQueuedAnalyticsEventToIngestEvent` in the TypeScript SDK.
            properties = properties + resolvedStandardProperties,
            availableAt = now,
        )

        val shouldFlush = synchronized(queue) {
            queue.add(event)
            queue.size >= ANALYTICS_BATCH_SIZE
        }

        if (shouldFlush && scope != null) {
            scope.launch { flushQuietly() }
        }
    }

    /** Sends everything currently due. */
    suspend fun flush() {
        flushMutex.withLock {
            while (true) {
                val batch = takeDueBatch()
                if (batch.isEmpty()) {
                    return
                }
                processBatch(batch)
            }
        }
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

    /** Pops the events at the head of the queue whose cool-down has elapsed. */
    private fun takeDueBatch(): List<AnalyticsEvent> = synchronized(queue) {
        val now = clock()
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

    private suspend fun processBatch(events: List<AnalyticsEvent>) {
        if (events.isEmpty()) {
            return
        }

        when (val outcome = sendWithInlineRetry(events)) {
            SendOutcome.Success -> return
            SendOutcome.Split -> {
                if (events.size == 1) {
                    onWarning("Dropping oversized analytics event ${events.first().name}")
                    return
                }
                val half = events.size / 2
                processBatch(events.subList(0, half))
                processBatch(events.subList(half, events.size))
            }
            is SendOutcome.Retry -> postpone(
                events,
                outcome.retryAfterMs ?: retryDelayMs((events.first().attempts) + 1),
            )
            is SendOutcome.Drop ->
                onWarning("Dropping ${events.size} analytics events: ${outcome.reason}")
        }
    }

    /**
     * Sends a batch, retrying inline on retryable failures. A `Retry-After`
     * response returns immediately so the caller can postpone the batch instead
     * of sleeping through the cool-down while holding the flush lock.
     */
    private suspend fun sendWithInlineRetry(events: List<AnalyticsEvent>): SendOutcome {
        var attempt = 1
        while (true) {
            val outcome = send(events)
            if (outcome !is SendOutcome.Retry ||
                outcome.retryAfterMs != null ||
                attempt >= MAX_ANALYTICS_ATTEMPTS
            ) {
                return outcome
            }
            sleep(retryDelayMs(attempt))
            attempt += 1
        }
    }

    private suspend fun send(events: List<AnalyticsEvent>): SendOutcome = try {
        post(events)
    } catch (error: CancellationException) {
        throw error
    } catch (error: Throwable) {
        if (error is VoidhashNetworkException) {
            SendOutcome.Retry(null)
        } else {
            SendOutcome.Drop(error.message.orEmpty())
        }
    }

    /** Re-inserts a failed batch at the head of the queue, due after [delayMs]. */
    private fun postpone(events: List<AnalyticsEvent>, delayMs: Long) {
        val nextAvailableAt = clock() + delayMs.coerceAtLeast(1L)
        val postponed = events.map { event ->
            event.copy(attempts = event.attempts + 1, availableAt = nextAvailableAt)
        }
        synchronized(queue) { queue.addAll(0, postponed) }
    }

    private suspend fun post(events: List<AnalyticsEvent>): SendOutcome {
        val request = Request.Builder()
            .url("$ingestUrl/i/v1/batch")
            .post(buildBody(events).toString().toRequestBody(JSON_MEDIA_TYPE))
            .build()

        val response = withContext(dispatcher) {
            try {
                httpClient.newCall(request).execute()
            } catch (error: IOException) {
                throw VoidhashNetworkException("Failed to reach ${request.url}", error)
            }
        }

        response.use {
            if (it.isSuccessful) {
                return SendOutcome.Success
            }
            if (it.code == 413) {
                return SendOutcome.Split
            }
            if (it.code == 429 || it.code == 503) {
                return SendOutcome.Retry(parseRetryAfterMs(it.header("Retry-After")))
            }
            if (it.code in setOf(408, 500, 502, 504)) {
                return SendOutcome.Retry(null)
            }
            return SendOutcome.Drop("status ${it.code}")
        }
    }

    internal fun buildBody(events: List<AnalyticsEvent>): JSONObject = JSONObject().apply {
        put("token", publishableKey)
        put("sent_at", formatTimestamp(clock()))
        put(
            "events",
            JSONArray(
                events.map { event ->
                    JSONObject().apply {
                        put("uuid", event.uuid)
                        put("event", event.name)
                        put("distinct_id", event.distinctId)
                        put("session_id", event.sessionId)
                        put("timestamp", formatTimestamp(event.timestamp))
                        put("context", JSONObject())
                        put("properties", JSONObject(encodeProperties(event)))
                    }
                },
            ),
        )
    }

    /**
     * Encodes an event's properties for the wire. Non-finite numbers are not
     * representable in JSON and would make the whole batch unserializable, so
     * they are reported and sent as `null`.
     */
    private fun encodeProperties(event: AnalyticsEvent): Map<String, Any> =
        event.properties.mapValues { (key, value) ->
            val isNonFinite = (value is Double && !value.isFinite()) ||
                (value is Float && !value.isFinite())
            if (isNonFinite) {
                onWarning("Dropping non-finite analytics property '$key' on ${event.name}")
                return@mapValues JSONObject.NULL
            }
            value ?: JSONObject.NULL
        }

    private fun retryDelayMs(attempt: Int): Long =
        minOf(1000L shl (attempt - 1).coerceAtLeast(0), MAX_ANALYTICS_RETRY_DELAY_MS)

    private fun parseRetryAfterMs(value: String?): Long? {
        if (value.isNullOrBlank()) {
            return null
        }
        val seconds = value.trim().toDoubleOrNull()
        if (seconds != null && seconds >= 0) {
            return Math.ceil(seconds * 1000).toLong()
        }
        return null
    }

    private fun formatTimestamp(epochMillis: Long): String {
        val formatter = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
        formatter.timeZone = TimeZone.getTimeZone("UTC")
        return formatter.format(Date(epochMillis))
    }

    private sealed class SendOutcome {
        object Success : SendOutcome()
        object Split : SendOutcome()
        data class Retry(val retryAfterMs: Long?) : SendOutcome()
        data class Drop(val reason: String) : SendOutcome()
    }
}
