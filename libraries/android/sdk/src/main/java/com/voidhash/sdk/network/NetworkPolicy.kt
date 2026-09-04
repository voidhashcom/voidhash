package com.voidhash.sdk.network

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import kotlin.math.ceil
import kotlin.random.Random

/** Statuses the SDK retries. Everything else is a verdict the server will repeat. */
val RETRYABLE_STATUS_CODES: Set<Int> = setOf(408, 429, 500, 502, 503, 504)

private val BREAKER_FAILURE_STATUS_CODES: Set<Int> = setOf(408, 500, 502, 503, 504)

/** Whether a response indicates host unavailability rather than a client verdict or throttle. */
fun countsTowardsCircuitBreaker(status: Int): Boolean = status in BREAKER_FAILURE_STATUS_CODES

/** Backoff ceiling for queue flushes. */
const val QUEUE_BACKOFF_CAP_MS: Long = 30_000L

/** Backoff ceiling for configuration refreshes (schema, person, flags, paywalls). */
const val CONFIG_BACKOFF_CAP_MS: Long = 60_000L

/** How long an interactive read waits on an in-flight refresh before serving a stale value. */
const val FRESHNESS_BUDGET_MS: Long = 500L

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
 * Parses a `Retry-After` cool-down, header first and response body second.
 *
 * The header carries either a delay in seconds or an HTTP date; the body carries
 * `retry_after_ms`. Returns `null` when neither is present or parseable. [capMs] clamps the
 * result to the caller's backoff ceiling: a server asking for an hour must not park a queue
 * for longer than the SDK would ever back off on its own.
 */
fun parseRetryAfterMs(
    header: String?,
    body: String? = null,
    now: Long = 0L,
    capMs: Long? = null,
): Long? {
    val parsed = parseRetryAfterHeaderMs(header, now) ?: parseRetryAfterBodyMs(body) ?: return null
    return if (capMs == null) parsed else parsed.coerceAtMost(capMs)
}

private fun parseRetryAfterHeaderMs(header: String?, now: Long): Long? {
    val raw = header?.trim().orEmpty()
    if (raw.isEmpty()) return null

    raw.toDoubleOrNull()?.let { seconds ->
        if (seconds < 0) return null
        return ceil(seconds * 1000).toLong()
    }

    for (pattern in HTTP_DATE_FORMATS) {
        val parsed = runCatching {
            SimpleDateFormat(pattern, Locale.US)
                .apply { timeZone = TimeZone.getTimeZone("UTC") }
                .parse(raw)
        }.getOrNull() ?: continue
        // An HTTP-date in the past means "retry now", not "retry in the past".
        return (parsed.time - now).coerceAtLeast(0L)
    }
    return null
}

private fun parseRetryAfterBodyMs(body: String?): Long? {
    if (body.isNullOrBlank()) return null
    val json = runCatching { org.json.JSONObject(body) }.getOrNull() ?: return null
    if (!json.has("retry_after_ms") || json.isNull("retry_after_ms")) return null
    val milliseconds = (json.opt("retry_after_ms") as? Number)?.toDouble() ?: return null
    return milliseconds.takeIf { it.isFinite() && it >= 0 }?.let { ceil(it).toLong() }
}

/** Formats [epochMillis] as the ISO-8601 instant the ingest API expects. */
internal fun formatIsoTimestamp(epochMillis: Long): String {
    val formatter = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
    formatter.timeZone = TimeZone.getTimeZone("UTC")
    return formatter.format(Date(epochMillis))
}
