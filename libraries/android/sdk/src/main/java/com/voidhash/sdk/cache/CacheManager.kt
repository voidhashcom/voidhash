package com.voidhash.sdk.cache

import org.json.JSONArray
import org.json.JSONObject

private const val CACHE_KEYS_KEY = "cache-keys"

/** Key/value string store backing [CacheManager]. */
interface CacheAdapter {
    /** Returns the stored envelope for [key], or `null` when nothing is stored. */
    fun get(key: String): String?

    /** Stores [value] under [key], replacing anything already there. */
    fun set(key: String, value: String)

    /** Removes [key]; a missing key is not an error. */
    fun delete(key: String)
}

/** In-memory adapter, useful for tests and for `enabled = false` clients. */
class InMemoryCacheAdapter : CacheAdapter {
    private val values = mutableMapOf<String, String>()

    override fun get(key: String): String? = values[key]

    override fun set(key: String, value: String) {
        values[key] = value
    }

    override fun delete(key: String) {
        values.remove(key)
    }
}

/** A cached entry plus its freshness verdicts. */
data class CacheHit<T>(
    val value: T,
    val createdAt: Long,
    val staleAt: Long?,
    val expiresAt: Long?,
    val isStale: Boolean,
    val isExpired: Boolean,
)

/**
 * JSON-envelope cache shared with the other Voidhash SDKs.
 *
 * Every entry is stored as `{value, createdAt, staleAt, expiresAt}`. Expired
 * entries are deleted on read, and every written key is tracked in a
 * `cache-keys` index so [clear] can drop the whole namespace.
 */
class CacheManager(
    private val adapter: CacheAdapter,
    private val clock: () -> Long = { System.currentTimeMillis() },
) {
    /** Reads the raw envelope for [key], dropping it when expired. */
    fun get(key: String): CacheHit<Any?>? {
        val stored = adapter.get(key) ?: return null
        val envelope = runCatching { JSONObject(stored) }.getOrNull() ?: return null

        val expiresAt = envelope.deadlineOrNull("expiresAt")
        val staleAt = envelope.deadlineOrNull("staleAt")
        val isExpired = expiresAt != null && expiresAt < clock()
        val isStale = staleAt != null && staleAt < clock()

        if (isExpired) {
            delete(key)
            return null
        }

        return CacheHit(
            value = envelope.opt("value").takeUnless { it === JSONObject.NULL },
            createdAt = envelope.optLong("createdAt"),
            staleAt = staleAt,
            expiresAt = expiresAt,
            isStale = isStale,
            isExpired = isExpired,
        )
    }

    /** Reads [key] as a string entry. */
    fun getString(key: String): CacheHit<String>? = getTyped(key)

    /** Reads [key] as an object entry. */
    fun getObject(key: String): CacheHit<JSONObject>? = getTyped(key)

    private inline fun <reified T : Any> getTyped(key: String): CacheHit<T>? {
        val hit = get(key) ?: return null
        val value = hit.value as? T ?: return null
        return CacheHit(
            value = value,
            createdAt = hit.createdAt,
            staleAt = hit.staleAt,
            expiresAt = hit.expiresAt,
            isStale = hit.isStale,
            isExpired = hit.isExpired,
        )
    }

    /**
     * Writes [value] under [key], optionally with a time-to-live and a
     * stale-after window (both in milliseconds). A `null` or `0` window means
     * "never expires" / "never stale" and is written as an explicit `null`,
     * matching the envelope the other Voidhash SDKs write.
     */
    fun set(key: String, value: Any?, ttlMs: Long? = null, staleTimeMs: Long? = null) {
        val now = clock()
        val envelope = JSONObject().apply {
            put("createdAt", now)
            put("expiresAt", ttlMs?.takeIf { it != 0L }?.let { now + it } ?: JSONObject.NULL)
            put("staleAt", staleTimeMs?.takeIf { it != 0L }?.let { now + it } ?: JSONObject.NULL)
            put("value", value ?: JSONObject.NULL)
        }
        adapter.set(key, envelope.toString())
        storeCacheKey(key)
    }

    /** Removes a single entry. */
    fun delete(key: String) {
        adapter.delete(key)
    }

    /** Removes every entry recorded in the `cache-keys` index. */
    fun clear() {
        for (key in getCacheKeys()) {
            adapter.delete(key)
        }
        adapter.delete(CACHE_KEYS_KEY)
    }

    /** Returns the tracked cache keys. */
    fun getCacheKeys(): List<String> {
        val stored = adapter.get(CACHE_KEYS_KEY) ?: return emptyList()
        val keys = runCatching { JSONArray(stored) }.getOrNull() ?: return emptyList()
        return (0 until keys.length()).map { keys.getString(it) }
    }

    private fun storeCacheKey(key: String) {
        val keys = getCacheKeys().toMutableList()
        keys.add(key)
        adapter.set(CACHE_KEYS_KEY, JSONArray(keys).toString())
    }

    /**
     * Reads a deadline field. A real deadline is always an epoch-millis
     * timestamp, so `0` is the shared "no deadline" sentinel and must not read
     * as a moment long past.
     */
    private fun JSONObject.deadlineOrNull(key: String): Long? {
        if (!has(key) || isNull(key)) return null
        return optLong(key).takeUnless { it == 0L }
    }
}
