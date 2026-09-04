package com.voidhash.sdk.cache

import com.voidhash.sdk.diagnostics.DiagnosticEmitter
import com.voidhash.sdk.diagnostics.VoidhashDiagnosticKind
import com.voidhash.sdk.storage.PersistenceWriter
import kotlinx.coroutines.CompletableDeferred
import org.json.JSONArray
import org.json.JSONObject
import java.util.Collections
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CountDownLatch

private const val CACHE_KEYS_KEY = "cache-keys"

/** Key/value string store backing [CacheManager]. */
interface CacheAdapter {
    /** Returns the stored envelope for [key], or `null` when nothing is stored. */
    fun get(key: String): String?

    /** Stores [value] under [key], replacing anything already there. */
    fun set(key: String, value: String)

    /** Removes [key]; a missing key is not an error. */
    fun delete(key: String)

    /**
     * Every entry this adapter owns, or `null` when it cannot enumerate itself.
     *
     * An adapter that can answer this lets [CacheManager] load the whole namespace once, on
     * the writer thread, after which no read ever touches storage again.
     */
    fun snapshot(): Map<String, String>? = null
}

/** In-memory adapter, useful for tests and for `enabled = false` clients. */
class InMemoryCacheAdapter : CacheAdapter {
    private val values = mutableMapOf<String, String>()

    override fun get(key: String): String? = synchronized(values) { values[key] }

    override fun set(key: String, value: String) {
        synchronized(values) { values[key] = value }
    }

    override fun delete(key: String) {
        synchronized(values) { values.remove(key) }
    }

    override fun snapshot(): Map<String, String> = synchronized(values) { values.toMap() }
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
 * Every entry is stored as `{value, createdAt, staleAt, expiresAt}`. An expired entry is
 * still returned, flagged `isExpired`: the TTL says how urgently the value should be
 * refreshed, not whether it may be used. An offline device that serves a two-day-old
 * entitlement is doing the right thing; one that reports "no entitlement" because the TTL
 * lapsed is not. Entries are removed only by an overwrite, [delete], or [clear].
 *
 * Written keys are tracked in a deduplicated `cache-keys` index so [clear] can drop the
 * whole namespace.
 */
class CacheManager(
    private val adapter: CacheAdapter,
    private val diagnostics: DiagnosticEmitter = DiagnosticEmitter(),
    /**
     * Serializes adapter writes off the caller's thread and performs the one-time warm-up.
     * Without one the cache reads and writes inline, which is only appropriate in tests.
     */
    private val writer: PersistenceWriter? = null,
    /** Runs on the writer thread before the first warm read; used for the legacy migration. */
    private val onWarmUp: () -> Unit = {},
    // Last so `CacheManager(adapter) { now }` still binds the trailing lambda to the clock.
    private val clock: () -> Long = { System.currentTimeMillis() },
) {
    /**
     * Write-through mirror of the adapter.
     *
     * Reads are answered from here so no caller waits on `SharedPreferences`, which parses
     * its whole backing file the first time it is touched. Before the warm-up a key that is
     * not mirrored yet falls through to the adapter; after it a memory miss is the answer.
     */
    private val memory = ConcurrentHashMap<String, String>()

    /** Keys erased before the warm-up, which the snapshot must not resurrect. */
    // `ConcurrentHashMap.newKeySet` is API 24; this is the same set on API 23.
    private val absent: MutableSet<String> = Collections.newSetFromMap(ConcurrentHashMap())
    private val cacheKeysLock = Any()
    private val warmed = CompletableDeferred<Unit>()
    private val warmedLatch = CountDownLatch(1)

    /** Set once the whole namespace is mirrored; from then on reads never touch storage. */
    @Volatile
    private var fullyLoaded = false

    /** Whether the one-time storage snapshot and migration have completed. */
    val isWarm: Boolean get() = warmed.isCompleted

    init {
        if (writer == null) warmUp() else writer.submit(::warmUp)
    }

    /**
     * Mirrors the namespace into memory once, on the writer thread.
     *
     * Anything written before this lands — the host's `distinctId` option, an identity
     * minted by an early capture — is newer than what storage holds, and its own write is
     * already queued behind this task. The snapshot therefore only fills gaps: a key already
     * in memory keeps its value, and a key erased before the warm-up stays erased.
     */
    private fun warmUp() {
        try {
            onWarmUp()
            adapter.snapshot()?.let { stored ->
                for ((key, value) in stored) {
                    if (!absent.contains(key)) memory.putIfAbsent(key, value)
                }
                fullyLoaded = true
            }
            compactCacheKeys()
        } finally {
            warmed.complete(Unit)
            warmedLatch.countDown()
        }
    }

    /**
     * Suspends until the one-time warm-up — legacy migration and key-index compaction — has
     * run. Callers that need a correct identity (analytics start-up, the first schema
     * resolve) await this; interactive reads do not, and fall through to the adapter.
     */
    suspend fun awaitWarm() {
        warmed.await()
    }

    /**
     * Blocks the calling thread until the warm-up has run.
     *
     * For the rare non-suspending caller that must not act on a miss it cannot trust: an
     * identity minted before the legacy migration ran would split the device into two
     * people. Returns immediately once warm, so it costs nothing after start-up.
     */
    fun awaitWarmBlocking() {
        warmedLatch.await()
    }

    private fun read(key: String): String? {
        memory[key]?.let { return it }
        // Once the namespace is mirrored, a memory miss *is* the answer.
        if (fullyLoaded || absent.contains(key)) return null
        // Only reachable before the warm-up lands, which is before `initialize` returns. A
        // miss here is not remembered: the legacy migration may still produce the key.
        val stored = adapter.get(key)
        if (stored != null) memory.putIfAbsent(key, stored)
        return memory[key]
    }

    private fun write(key: String, value: String) {
        memory[key] = value
        absent.remove(key)
        if (writer == null) adapter.set(key, value) else writer.submit { adapter.set(key, value) }
    }

    private fun erase(key: String) {
        memory.remove(key)
        absent.add(key)
        if (writer == null) adapter.delete(key) else writer.submit { adapter.delete(key) }
    }

    /** Reads the raw envelope for [key]. */
    fun get(key: String): CacheHit<Any?>? {
        val stored = read(key) ?: return null
        val envelope = runCatching { JSONObject(stored) }.getOrNull()
        val createdAt = (envelope?.opt("createdAt") as? Number)?.toLong()
        val hasValue = envelope?.has("value") == true
        val validDeadlines = envelope != null &&
            listOf("staleAt", "expiresAt").all { deadline ->
                !envelope.has(deadline) || envelope.isNull(deadline) || envelope.opt(deadline) is Number
            }
        if (envelope == null || createdAt == null || !hasValue || !validDeadlines) {
            // A corrupt entry is a miss, never a failure: the caller refetches.
            diagnostics.emit(
                VoidhashDiagnosticKind.CACHE,
                code = "CACHE_READ_FAILED",
                operation = "cache.get",
                message = "Discarded an unreadable cache entry for $key",
            )
            delete(key)
            return null
        }

        val now = clock()
        val expiresAt = envelope.deadlineOrNull("expiresAt")
        val staleAt = envelope.deadlineOrNull("staleAt")
        val isExpired = expiresAt != null && expiresAt < now

        return CacheHit(
            value = envelope.opt("value").takeUnless { it === JSONObject.NULL },
            createdAt = createdAt,
            staleAt = staleAt,
            expiresAt = expiresAt,
            // An expired entry is stale by definition, even when no stale window was set.
            isStale = isExpired || (staleAt != null && staleAt < now),
            isExpired = isExpired,
        )
    }

    /** Reads [key] as a string entry. */
    fun getString(key: String): CacheHit<String>? = getTyped(key)

    /** Reads [key] as an object entry. */
    fun getObject(key: String): CacheHit<JSONObject>? = getTyped(key)

    /** Reads [key] as an array entry. */
    fun getArray(key: String): CacheHit<JSONArray>? = getTyped(key)

    @PublishedApi
    internal fun reportTypeMismatch(key: String, expected: String) {
        diagnostics.emit(
            VoidhashDiagnosticKind.CACHE,
            code = "CACHE_READ_FAILED",
            operation = "cache.get",
            message = "The cache entry for $key is not a $expected; treating it as a miss",
        )
    }

    private inline fun <reified T : Any> getTyped(key: String): CacheHit<T>? {
        val hit = get(key) ?: return null
        val value = hit.value as? T
        if (value == null) {
            // A value of the wrong shape is a miss, but a silent one would hide a real
            // encoding bug behind an endless stream of refetches.
            reportTypeMismatch(key, T::class.java.simpleName)
            return null
        }
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
     * Writes [value] under [key], optionally with a time-to-live and a stale-after window
     * (both in milliseconds). A `null` or `0` window means "never expires" / "never stale"
     * and is written as an explicit `null`, matching the envelope the other Voidhash SDKs
     * write.
     */
    fun set(key: String, value: Any?, ttlMs: Long? = null, staleTimeMs: Long? = null) {
        val now = clock()
        val envelope = JSONObject().apply {
            put("createdAt", now)
            put("expiresAt", ttlMs?.takeIf { it != 0L }?.let { now + it } ?: JSONObject.NULL)
            put("staleAt", staleTimeMs?.takeIf { it != 0L }?.let { now + it } ?: JSONObject.NULL)
            put("value", value ?: JSONObject.NULL)
        }
        write(key, envelope.toString())
        storeCacheKey(key)
    }

    /** Removes a single entry. */
    fun delete(key: String) {
        synchronized(cacheKeysLock) {
            erase(key)
            if (key == CACHE_KEYS_KEY) return
            val keys = readCacheKeys()
            if (keys.remove(key)) writeCacheKeys(keys)
        }
    }

    /** Removes every entry whose key starts with [prefix]. */
    fun deleteByPrefix(prefix: String) {
        synchronized(cacheKeysLock) {
            val remaining = linkedSetOf<String>()
            for (key in readCacheKeys()) {
                if (key.startsWith(prefix)) erase(key) else remaining.add(key)
            }
            writeCacheKeys(remaining)
        }
    }

    /** Removes every entry recorded in the `cache-keys` index. */
    fun clear() {
        synchronized(cacheKeysLock) {
            for (key in readCacheKeys()) {
                erase(key)
            }
            erase(CACHE_KEYS_KEY)
        }
    }

    /** Returns the tracked cache keys, in insertion order and without duplicates. */
    fun getCacheKeys(): List<String> = readCacheKeys().toList()

    private fun readCacheKeys(): LinkedHashSet<String> {
        val stored = read(CACHE_KEYS_KEY) ?: return linkedSetOf()
        val keys = runCatching { JSONArray(stored) }.getOrNull() ?: return linkedSetOf()
        val unique = linkedSetOf<String>()
        for (index in 0 until keys.length()) {
            keys.optString(index).takeIf { it.isNotEmpty() }?.let(unique::add)
        }
        return unique
    }

    /**
     * Adds [key] to the index.
     *
     * Read-modify-write under a lock: two concurrent writers reading the same index and
     * writing back their own copy would lose one of the keys, and a lost key is an entry
     * [clear] can never remove.
     */
    private fun storeCacheKey(key: String) {
        synchronized(cacheKeysLock) {
            val keys = readCacheKeys()
            if (!keys.add(key)) return
            writeCacheKeys(keys)
        }
    }

    private fun writeCacheKeys(keys: Set<String>) {
        write(CACHE_KEYS_KEY, JSONArray(keys.toList()).toString())
    }

    /**
     * Rewrites the index once at construction, dropping the duplicates earlier SDK versions
     * appended on every write. Left alone, that index grew without bound and made [clear]
     * O(writes) instead of O(keys).
     */
    private fun compactCacheKeys() {
        synchronized(cacheKeysLock) {
            val stored = read(CACHE_KEYS_KEY) ?: return
            val unique = readCacheKeys()
            val compacted = JSONArray(unique.toList()).toString()
            if (compacted != stored) {
                write(CACHE_KEYS_KEY, compacted)
            }
        }
    }

    /**
     * Reads a deadline field. A real deadline is always an epoch-millis timestamp, so `0` is
     * the shared "no deadline" sentinel and must not read as a moment long past.
     */
    private fun JSONObject.deadlineOrNull(key: String): Long? {
        if (!has(key) || isNull(key)) return null
        return optLong(key).takeUnless { it == 0L }
    }
}
