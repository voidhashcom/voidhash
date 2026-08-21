package com.voidhash.sdk.schema

import com.voidhash.sdk.api.VoidhashApiClient
import com.voidhash.sdk.cache.CacheManager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

/**
 * 30 days. Covers long offline gaps (user reopens the app after a month) while
 * bounding cache staleness. Combined with the unconditional background refresh
 * on cache hits this gives a stale-while-revalidate read path.
 */
private const val SCHEMA_CACHE_TTL_MS = 1000L * 60 * 60 * 24 * 30

/**
 * Resolves the runtime schema with a stale-while-revalidate cache keyed by the
 * current app version.
 *
 * App-version keying matters because features in a new app build may reference
 * products or locations that don't exist in an older cached schema — a separate
 * cache key per version forces a fresh fetch on the first launch of a new build.
 * On a cold cache the fetch is fatal; with no app version the cache is skipped
 * entirely.
 */
class SchemaManager(
    private val apiClient: VoidhashApiClient,
    private val cacheManager: CacheManager,
    private val appVersion: String?,
    private val refreshScope: CoroutineScope,
    private val onSchema: (RuntimeSchema) -> Unit = {},
    private val onWarning: (String) -> Unit = {},
) {
    /** Cache key for the schema of [appVersion]. */
    fun cacheKey(appVersion: String): String = "schema:$appVersion"

    /** Returns the schema, serving a warm cache immediately and revalidating in the background. */
    suspend fun resolveSchema(distinctId: String): RuntimeSchema {
        if (appVersion == null) {
            val schema = RuntimeSchema.fromJson(apiClient.getSchema(distinctId))
            onSchema(schema)
            return schema
        }

        val cacheKey = cacheKey(appVersion)
        val cached = cacheManager.getObject(cacheKey)
        if (cached != null) {
            val schema = RuntimeSchema.fromJson(cached.value)
            onSchema(schema)
            scheduleBackgroundRefresh(cacheKey, distinctId)
            return schema
        }

        val json = apiClient.getSchema(distinctId)
        cacheManager.set(cacheKey, json, ttlMs = SCHEMA_CACHE_TTL_MS)
        val schema = RuntimeSchema.fromJson(json)
        onSchema(schema)
        return schema
    }

    private fun scheduleBackgroundRefresh(cacheKey: String, distinctId: String) {
        refreshScope.launch {
            try {
                val json = apiClient.getSchema(distinctId)
                cacheManager.set(cacheKey, json, ttlMs = SCHEMA_CACHE_TTL_MS)
                onSchema(RuntimeSchema.fromJson(json))
            } catch (error: CancellationException) {
                throw error
            } catch (error: Throwable) {
                onWarning("Failed to refresh the Voidhash schema: ${error.message}")
            }
        }
    }
}
