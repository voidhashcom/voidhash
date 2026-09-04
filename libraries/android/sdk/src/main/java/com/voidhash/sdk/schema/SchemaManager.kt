package com.voidhash.sdk.schema

import com.voidhash.sdk.VoidhashApiException
import com.voidhash.sdk.VoidhashException
import com.voidhash.sdk.api.VoidhashApiClient
import com.voidhash.sdk.cache.CacheManager
import com.voidhash.sdk.diagnostics.DiagnosticEmitter
import com.voidhash.sdk.diagnostics.VoidhashDiagnosticKind
import com.voidhash.sdk.network.CONFIG_BACKOFF_CAP_MS
import com.voidhash.sdk.network.OutboundGate
import com.voidhash.sdk.network.RETRYABLE_STATUS_CODES
import com.voidhash.sdk.network.SdkClock
import com.voidhash.sdk.network.SystemSdkClock
import com.voidhash.sdk.network.backoffDelayMs
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import org.json.JSONObject

/**
 * 30 days. Covers long offline gaps (a user reopens the app after a month) while bounding
 * cache staleness. Combined with the background refresh on cache hits this gives a
 * stale-while-revalidate read path.
 */
private const val SCHEMA_CACHE_TTL_MS = 1000L * 60 * 60 * 24 * 30

/** 24 hours — after this a cached schema is still served but scheduled for refresh. */
private const val SCHEMA_CACHE_STALE_TIME_MS = 1000L * 60 * 60 * 24

/** Cache key of the current schema. The app version lives inside the envelope, not in the key. */
const val SCHEMA_CACHE_KEY: String = "schema:current"

/** Raised when no cached schema is available and the server fetch fails. */
class FailedToFetchSchemaException(cause: Throwable) : VoidhashException(
    "FAILED_TO_FETCH_SCHEMA",
    "Failed to fetch schema at init",
    cause,
)

/**
 * Resolves the runtime schema with a stale-while-revalidate cache.
 *
 * The schema is stored under one key with the app version recorded inside the envelope, so
 * a device holds one schema rather than one per release it has ever run. A version change
 * marks the entry stale — a new build may reference products the old schema does not
 * describe — but never unusable, which is what keeps a first offline launch of an update
 * working. Entries written by older SDK releases under the per-version key are adopted on
 * first read.
 *
 * [resolveSchema] never throws for transport: a cold cache with an unreachable server
 * returns `null`. The background refresh then retries **for as long as the SDK is alive**,
 * backing off to a minute between attempts and standing down while the circuit for the API
 * host is open. A device that boots offline and reconnects an hour later still ends up with
 * a schema; giving up after a handful of attempts would leave store operations failing with
 * `CONFIGURATION_MISSING` for the rest of the process.
 */
class SchemaManager(
    private val apiClient: VoidhashApiClient,
    private val cacheManager: CacheManager,
    private val appVersion: String?,
    private val refreshScope: CoroutineScope,
    private val onSchema: (RuntimeSchema) -> Unit = {},
    private val onWarning: (String) -> Unit = {},
    private val clock: SdkClock = SystemSdkClock,
    private val gate: OutboundGate? = null,
    private val diagnostics: DiagnosticEmitter = DiagnosticEmitter(),
) {
    private data class FetchedSchema(val raw: JSONObject, val value: RuntimeSchema)

    private val refreshLock = Any()
    private var refreshJob: Job? = null

    /** Legacy per-app-version cache key, read once for migration. */
    fun legacyCacheKey(appVersion: String): String = "schema:$appVersion"

    /**
     * Returns the schema, serving any cached copy immediately and revalidating in the
     * background. Returns `null` only when nothing is cached and the server is unreachable;
     * the refresh started here keeps trying.
     * @param localOnly Return immediately on a cache miss and fetch in the background during boot.
     */
    suspend fun resolveSchema(distinctId: String, localOnly: Boolean = false): RuntimeSchema? {
        val cached = readCachedSchema()
        if (cached != null) {
            val schema = RuntimeSchema.fromJson(cached.raw)
            onSchema(schema)
            if (cached.isStale || cached.appVersion != appVersion) {
                scheduleBackgroundRefresh(distinctId)
            }
            return schema
        }

        if (localOnly) {
            scheduleBackgroundRefresh(distinctId)
            return null
        }

        val fetched = try {
            fetchFromServer(distinctId)
        } catch (error: CancellationException) {
            throw error
        } catch (error: Throwable) {
            // Cold cache and no server: the client still boots, and the background refresh
            // takes over. Analytics and lifecycle observation do not depend on the schema.
            diagnostics.emit(
                VoidhashDiagnosticKind.TRANSPORT,
                code = "SCHEMA_FETCH_FAILED",
                operation = "schema.resolve",
                retryable = true,
                message = "Failed to fetch the Voidhash schema: ${error.message}",
            )
            scheduleBackgroundRefresh(distinctId)
            return null
        }

        writeSchema(fetched)
        onSchema(fetched.value)
        return fetched.value
    }

    /**
     * Starts a background refresh, or joins the one already running.
     *
     * Safe to call from every refresh trigger — boot, app foreground, connectivity restored.
     * A refresh already in flight is left alone; a stood-down one is restarted, which is how
     * a device that reconnects picks the schema up again.
     */
    fun scheduleBackgroundRefresh(distinctId: String) {
        synchronized(refreshLock) {
            if (refreshJob?.isActive == true) return
            refreshJob = refreshScope.launch { refreshUntilResolved(distinctId) }
        }
    }

    /** Whether a background refresh is currently running. */
    internal val isRefreshing: Boolean
        get() = synchronized(refreshLock) { refreshJob?.isActive == true }

    private suspend fun refreshUntilResolved(distinctId: String) {
        var attempt = 1
        while (true) {
            // While the circuit is open there is nothing to gain from trying; wait out the
            // backoff and look again rather than spending the breaker's single probe here.
            if (gate?.isBlocked(apiClient.circuitKey) != true) {
                try {
                    val fetched = fetchFromServer(distinctId)
                    writeSchema(fetched)
                    onSchema(fetched.value)
                    return
                } catch (error: CancellationException) {
                    throw error
                } catch (error: Throwable) {
                    if (!isRetryable(error)) {
                        onWarning("Failed to refresh the Voidhash schema: ${error.message}")
                        return
                    }
                    if (attempt == 1) {
                        onWarning("Failed to refresh the Voidhash schema: ${error.message}")
                    }
                }
            }
            clock.sleep(retryDelayMs(attempt, lastRetryAfterMs))
            attempt += 1
        }
    }

    @Volatile
    private var lastRetryAfterMs: Long? = null

    private fun retryDelayMs(attempt: Int, retryAfterMs: Long?): Long =
        retryAfterMs?.coerceAtMost(CONFIG_BACKOFF_CAP_MS)
            ?: backoffDelayMs(attempt, CONFIG_BACKOFF_CAP_MS)

    private data class CachedSchema(
        val raw: JSONObject,
        val appVersion: String?,
        val isStale: Boolean,
    )

    private fun readCachedSchema(): CachedSchema? {
        cacheManager.getObject(SCHEMA_CACHE_KEY)?.let { hit ->
            val raw = hit.value.optJSONObject("schema") ?: hit.value
            val version = hit.value.optString("appVersion").takeIf { it.isNotEmpty() }
            if (!decodes(raw, SCHEMA_CACHE_KEY)) return null
            return CachedSchema(raw, version, hit.isStale)
        }

        // Migration: releases before the single-key layout wrote one entry per app version.
        // The legacy prefs migration copies those entries into this namespace first, so this
        // read finds them and rewrites them under `schema:current`.
        val legacyKey = appVersion?.let(::legacyCacheKey) ?: return null
        val legacy = cacheManager.getObject(legacyKey) ?: return null
        cacheManager.delete(legacyKey)
        if (!decodes(legacy.value, legacyKey)) return null
        writeSchema(FetchedSchema(legacy.value, RuntimeSchema.fromJson(legacy.value)))
        return CachedSchema(legacy.value, appVersion, legacy.isStale)
    }

    /**
     * Whether a stored schema still parses. A cache entry is the one input the SDK cannot
     * trust the shape of; one that no longer decodes is a miss with a diagnostic, never a
     * failed boot.
     */
    private fun decodes(raw: JSONObject, key: String): Boolean {
        val failure = runCatching { RuntimeSchema.fromJson(raw) }.exceptionOrNull() ?: return true
        diagnostics.emit(
            VoidhashDiagnosticKind.CACHE,
            code = "CACHE_READ_FAILED",
            operation = "schema.resolve",
            message = "Discarded an undecodable cached schema under $key: ${failure.message}",
        )
        cacheManager.delete(key)
        return false
    }

    private fun writeSchema(fetched: FetchedSchema) {
        cacheManager.set(
            SCHEMA_CACHE_KEY,
            JSONObject()
                .put("appVersion", appVersion ?: JSONObject.NULL)
                .put("schema", fetched.raw),
            ttlMs = SCHEMA_CACHE_TTL_MS,
            staleTimeMs = SCHEMA_CACHE_STALE_TIME_MS,
        )
    }

    private suspend fun fetchFromServer(distinctId: String): FetchedSchema = try {
        val raw = apiClient.getSchema(distinctId)
        lastRetryAfterMs = null
        FetchedSchema(raw, RuntimeSchema.fromJson(raw))
    } catch (error: CancellationException) {
        throw error
    } catch (error: Throwable) {
        // A server that named a cool-down gets it honored instead of our own backoff.
        lastRetryAfterMs = (error as? VoidhashApiException)?.retryAfterMs
        throw FailedToFetchSchemaException(error)
    }

    private fun isRetryable(error: Throwable): Boolean {
        val cause = (error as? FailedToFetchSchemaException)?.cause ?: error
        val status = (cause as? VoidhashApiException)?.status ?: return true
        return status in RETRYABLE_STATUS_CODES
    }
}
