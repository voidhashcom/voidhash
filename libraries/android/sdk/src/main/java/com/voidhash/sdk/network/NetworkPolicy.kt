package com.voidhash.sdk.network

import com.voidhash.sdk.VoidhashApiException
import com.voidhash.sdk.VoidhashException
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import kotlin.math.ceil
import kotlin.random.Random

/** What a failed request means for the data it was carrying. */
enum class FailureClass {
    /** A tagged 401/403: the API rejected the publishable key. Traffic pauses; queues are kept. */
    AUTH,

    /** The server gave no usable answer. The data is kept and retried with backoff. */
    TRANSIENT,

    /** A definite answer, such as a tagged Voidhash API error, that a retry would only repeat. */
    VERDICT,
}

/** Request failures raised before anything is sent: the same request can never be built. */
private val TERMINAL_REQUEST_CODES = setOf("INVALID_REQUEST", "INVALID_PAYLOAD", "INVALID_ARGUMENT")

/** The tag of the API's answer that it has no person for the distinct id a request was made as. */
internal const val PERSON_NOT_FOUND_TAG = "Api/SdkPersonNotFoundError"

/**
 * Whether [error] is the API's own answer that it has no person for the request's distinct id.
 * Only the tagged 404 says so; any other 404 comes from something in between.
 */
internal fun isPersonNotFound(error: Throwable): Boolean =
    error is VoidhashApiException && error.status == 404 && error.tag == PERSON_NOT_FOUND_TAG

/**
 * Whether [error] is the API's answer to an identify that the alias it was made from already
 * belongs to another identified person, so it was not merged into the target.
 */
internal fun isAliasAlreadyIdentified(error: Throwable): Boolean =
    error is VoidhashApiException && error.status == 409 && error.tag == "Api/SdkPersonAlreadyIdentifiedError"

/**
 * Classifies a failed response by its [status] and whether its body is a Voidhash API error
 * ([tagged]: a JSON object carrying `_tag`).
 *
 * Only a tagged 4xx is the API's answer: a rejected key for 401 and 403, a verdict otherwise. An
 * untagged 3xx or 4xx, 401 and 403 included, comes from something between the SDK and the API —
 * an edge, a firewall, a proxy, a captive portal — and says nothing about the request or the
 * key, and a 2xx only reaches this function when its body could not be used. 408, 425, 429 and
 * every 5xx are transient whatever their body says.
 */
fun classifyStatus(status: Int, tagged: Boolean): FailureClass = when {
    status == 408 || status == 425 || status == 429 || status >= 500 -> FailureClass.TRANSIENT
    !tagged -> FailureClass.TRANSIENT
    status == 401 || status == 403 -> FailureClass.AUTH
    status in 400..499 -> FailureClass.VERDICT
    else -> FailureClass.TRANSIENT
}

/**
 * Classifies a failure raised by an SDK request.
 *
 * A request that could not even be built (`INVALID_REQUEST`, `INVALID_PAYLOAD`,
 * `INVALID_ARGUMENT`) is a verdict:
 * building it again fails the same way. Anything the SDK cannot attribute to a server answer
 * — the network, an open circuit, an unexpected exception — is transient.
 */
fun classifyFailure(error: Throwable): FailureClass = when (error) {
    is VoidhashOutboundPausedException -> FailureClass.AUTH
    is VoidhashApiException -> classifyStatus(error.status, error.tag != null)
    is VoidhashException ->
        if (error.code in TERMINAL_REQUEST_CODES) FailureClass.VERDICT else FailureClass.TRANSIENT
    else -> FailureClass.TRANSIENT
}

/**
 * Whether a failed response is evidence that the host is unhealthy: every transient failure,
 * rate limiting included. A rejected key and a verdict are answers, and never count.
 */
fun countsTowardsCircuitBreaker(status: Int, tagged: Boolean): Boolean =
    classifyStatus(status, tagged) == FailureClass.TRANSIENT

/** Reads the `_tag` of a Voidhash API error body; `null` when [body] is not one. */
internal fun parseApiErrorTag(body: String?): String? {
    if (body.isNullOrBlank()) return null
    val json = runCatching { JSONObject(body) }.getOrNull() ?: return null
    return (json.opt("_tag") as? String)?.takeIf { it.isNotEmpty() }
}

/** Backoff ceiling for queue flushes. */
const val QUEUE_BACKOFF_CAP_MS: Long = 30_000L

/** Backoff ceiling for configuration refreshes (schema, person, flags, paywalls). */
const val CONFIG_BACKOFF_CAP_MS: Long = 60_000L

/** The longest delay a queue's own backoff schedules: the cap plus its maximum jitter. */
const val MAX_QUEUE_BACKOFF_MS: Long = QUEUE_BACKOFF_CAP_MS * 5 / 4

/** Shortest server-requested cool-down the SDK honours, so a retry never loops without pause. */
const val MIN_RETRY_AFTER_MS: Long = 1_000L

/**
 * Longest server-requested cool-down the SDK honours, the queue backoff ceiling: a `Retry-After`
 * asking for longer is cut to this, so one answer cannot hold the queues back for long after an
 * outage, the same rule as the other Voidhash SDKs.
 */
const val MAX_RETRY_AFTER_MS: Long = QUEUE_BACKOFF_CAP_MS

/** How long a part of the API is left alone after a 429 that names no `Retry-After`. */
const val DEFAULT_THROTTLE_COOLDOWN_MS: Long = 5_000L

/** How long an interactive read waits on an in-flight refresh before serving a stale value. */
const val FRESHNESS_BUDGET_MS: Long = 500L

/**
 * How long a flow may take from the call that presents it until it is handed to the renderer:
 * resolving its paywall and downloading its package together. A flow not ready by then is not
 * shown, as it would appear over whatever the user went on to do; the same on every Voidhash SDK.
 */
const val FLOW_PRESENTATION_DEADLINE_MS: Long = 15_000L

private const val BACKOFF_BASE_MS = 1_000L

private val HTTP_DATE_FORMATS = listOf(
    "EEE, dd MMM yyyy HH:mm:ss zzz",
    "EEE, dd-MMM-yy HH:mm:ss zzz",
    "EEE MMM d HH:mm:ss yyyy",
)

/**
 * Jittered exponential backoff: `min(cap, 1 s · 2^(attempt - 1)) + rand(0, 25 %)`.
 *
 * @param attempt 1-based attempt number.
 * @param capMs upper bound before jitter.
 */
fun backoffDelayMs(
    attempt: Int,
    capMs: Long = QUEUE_BACKOFF_CAP_MS,
    random: Random = Random.Default,
): Long {
    val exponent = (attempt - 1).coerceIn(0, 30)
    val base = minOf(BACKOFF_BASE_MS shl exponent, capMs)
    return base + random.nextLong((base / 4).coerceAtLeast(1L))
}

/**
 * Whether a persisted record scheduled for [availableAt] is due at wall-clock time [now].
 *
 * [maxDelayMs] is the longest delay the SDK can schedule for this kind of record. A record
 * further ahead than that was scheduled under a wall clock that has since moved back, so it
 * is due now instead of waiting days for real time to catch up.
 */
fun isDue(availableAt: Long, now: Long, maxDelayMs: Long): Boolean =
    availableAt <= now || availableAt - now > maxDelayMs

/**
 * Parses a `Retry-After` cool-down, header first and response body second.
 *
 * The header carries either a delay in seconds or an HTTP date; the body carries
 * `retry_after_ms`. Returns `null` when neither is present or parseable. A parsed value is
 * clamped between [MIN_RETRY_AFTER_MS] and [MAX_RETRY_AFTER_MS]: `0`, a negative delay or a
 * date already past still waits a second, and no server can park the SDK for more than 30 s.
 */
fun parseRetryAfterMs(
    header: String?,
    body: String? = null,
    now: Long = 0L,
): Long? {
    val requested = parseRetryAfterHeaderMs(header, now) ?: parseRetryAfterBodyMs(body) ?: return null
    return requested.coerceIn(MIN_RETRY_AFTER_MS, MAX_RETRY_AFTER_MS)
}

private fun parseRetryAfterHeaderMs(header: String?, now: Long): Long? {
    val raw = header?.trim().orEmpty()
    if (raw.isEmpty()) return null

    raw.toDoubleOrNull()?.let { seconds ->
        if (seconds.isNaN()) return null
        return ceil(seconds.coerceIn(0.0, MAX_RETRY_AFTER_MS / 1000.0) * 1000).toLong()
    }

    for (pattern in HTTP_DATE_FORMATS) {
        val parsed = runCatching {
            SimpleDateFormat(pattern, Locale.US)
                .apply { timeZone = TimeZone.getTimeZone("UTC") }
                .parse(raw)
        }.getOrNull() ?: continue
        return parsed.time - now
    }
    return null
}

private fun parseRetryAfterBodyMs(body: String?): Long? {
    if (body.isNullOrBlank()) return null
    val json = runCatching { JSONObject(body) }.getOrNull() ?: return null
    if (!json.has("retry_after_ms") || json.isNull("retry_after_ms")) return null
    val milliseconds = (json.opt("retry_after_ms") as? Number)?.toDouble() ?: return null
    if (milliseconds.isNaN()) return null
    return ceil(milliseconds.coerceIn(0.0, MAX_RETRY_AFTER_MS.toDouble())).toLong()
}

/** Formats [epochMillis] as the ISO-8601 instant the ingest API expects. */
internal fun formatIsoTimestamp(epochMillis: Long): String {
    val formatter = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
    formatter.timeZone = TimeZone.getTimeZone("UTC")
    return formatter.format(Date(epochMillis))
}
