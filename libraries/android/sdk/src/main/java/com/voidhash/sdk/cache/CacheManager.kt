package com.voidhash.sdk.cache

import com.voidhash.sdk.diagnostics.DiagnosticEmitter
import com.voidhash.sdk.diagnostics.VoidhashDiagnosticKind
import com.voidhash.sdk.network.CLOCK_SKEW_TOLERANCE_MS
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

    /** Removes every one of [keys]; an adapter that can do so in one write should. */
    fun deleteAll(keys: Collection<String>) {
        keys.forEach(::delete)
    }

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
 * lapsed is not. Entries are removed by an overwrite, [delete], [deleteByPrefix] or [clear],
 * and markers under [expiringKeyPrefixes] also once they have expired.
 *
 * Written keys are tracked in a deduplicated `cache-keys` index so [clear] can drop the
 * whole namespace.
 *
 * With a [writer], nothing here reads storage on the caller's thread once the warm-up has run.
 * Before it, a read of a key not written yet still falls through to the adapter, but writes and
 * deletes only change memory and leave storage and the index to the writer, behind the warm-up.
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
    /**
     * Key prefixes of markers that mean nothing once expired, unlike cached data, which is served
     * expired. The warm-up deletes their expired entries, so they cannot pile up.
     */
    private val expiringKeyPrefixes: Collection<String> = emptyList(),
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

    /**
     * Keys erased while reads can still fall through to storage, which must not resurrect them:
     * before the warm-up, and for good when the namespace could not be mirrored.
     */
    // `ConcurrentHashMap.newKeySet` is API 24; this is the same set on API 23.
    private val absent: MutableSet<String> = Collections.newSetFromMap(ConcurrentHashMap())

    /** How many erased keys are remembered, for tests. */
    internal val erasedKeyCount: Int get() = absent.size

    /** Prefixes erased before the warm-up; the snapshot drops what storage holds under them. */
    private val erasedPrefixes: MutableSet<String> = Collections.newSetFromMap(ConcurrentHashMap())
    private val cacheKeysLock = Any()

    /**
     * Makes an erase, the snapshot merge, and an early read's adoption of what it found in storage
     * atomic with respect to each other. Held for memory work only, never across storage.
     */
    private val mergeLock = Any()
    private val warmed = CompletableDeferred<Unit>()
    private val warmedLatch = CountDownLatch(1)

    /**
     * Set once the warm-up has merged storage into memory, or failed to. Until then writes leave
     * the index to the writer, which runs them after the warm-up.
     */
    @Volatile
    private var merged = false

    /** Set once the owning client was released; see [handOff]. */
    @Volatile
    private var handedOff: (() -> CacheManager?)? = null

    /**
     * Hands this cache over once its client was released while work of it still runs, such as a
     * purchase whose sheet was open. From then on reads and writes go to the cache [successor]
     * returns, the live client's over the same storage, so its memory and key index see them.
     * Without one, entries are still written to storage, where the next client's warm-up reads
     * them, but the index is left alone: this memory no longer reflects it.
     */
    internal fun handOff(successor: () -> CacheManager?) {
        handedOff = successor
    }

    private fun successor(): CacheManager? = handedOff?.invoke()?.takeIf { it !== this }

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
     * Anything written before this lands — an identity switched by an early `identify`, one
     * minted by an early capture — is newer than what storage holds, and its own write is
     * already queued behind this task. The snapshot therefore only fills gaps: a key already
     * in memory keeps its value, and a key erased before the warm-up stays erased.
     */
    private fun warmUp() {
        try {
            try {
                onWarmUp()
            } catch (error: Exception) {
                // A migration that could not be saved is tried again on the next launch; this one
                // still loads what storage holds.
                diagnostics.emit(
                    VoidhashDiagnosticKind.CACHE,
                    code = "CACHE_WRITE_FAILED",
                    operation = "cache.warmUp",
                    retryable = true,
                    message = "Could not adopt the state an earlier release stored: ${error.message}",
                )
            }
            val stored = adapter.snapshot()
            val obsolete = mutableListOf<String>()
            synchronized(mergeLock) {
                if (stored != null) {
                    val now = clock()
                    for ((key, value) in stored) {
                        if (absent.contains(key)) continue
                        val erased = erasedPrefixes.any { key.startsWith(it) }
                        if (erased || isExpiredMarker(key, value, now)) {
                            if (!memory.containsKey(key)) obsolete.add(key)
                            continue
                        }
                        memory.putIfAbsent(key, value)
                    }
                    fullyLoaded = true
                    // From here on a memory miss is the answer, and nothing consults these.
                    absent.clear()
                }
                merged = true
            }
            adapter.deleteAll(obsolete)
            compactCacheKeys()
        } finally {
            merged = true
            // The latch first: completing `warmed` can resume a caller on this very thread, which
            // may go on to block on the latch.
            warmedLatch.countDown()
            warmed.complete(Unit)
        }
    }

    private fun isExpiredMarker(key: String, stored: String, now: Long): Boolean {
        if (expiringKeyPrefixes.none { key.startsWith(it) }) return false
        val expiresAt = runCatching { JSONObject(stored) }.getOrNull()?.deadlineOrNull("expiresAt")
        return expiresAt != null && expiresAt < now
    }

    /**
     * Suspends until the one-time warm-up — legacy migration and key-index compaction — has
     * run. Callers that need a correct identity (analytics start-up, the first schema
     * resolve) and the client's suspending reads await this, after which every read is answered
     * from memory; only a synchronous read before it falls through to the adapter.
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
        if (fullyLoaded || absent.contains(key) || erasedPrefixes.any { key.startsWith(it) }) return null
        // Only reachable before the warm-up lands, which is before `initialize` returns. A
        // miss here is not remembered: the legacy migration may still produce the key.
        val stored = adapter.get(key)
        if (stored != null) {
            // Storage was read outside the lock, as it may take long. Meanwhile the key may have
            // been erased, its delete still queued, or the warm-up may have landed, after which
            // memory is the answer and nothing remembers the erase: checked again under the lock
            // an erase and the merge hold, what storage held is kept only if neither happened.
            synchronized(mergeLock) {
                if (!fullyLoaded && !absent.contains(key) && erasedPrefixes.none { key.startsWith(it) }) {
                    memory.putIfAbsent(key, stored)
                }
            }
        }
        return memory[key]
    }

    private fun write(key: String, value: String) {
        memory[key] = value
        absent.remove(key)
        if (writer == null) adapter.set(key, value) else writer.submit { adapter.set(key, value) }
    }

    private fun erase(key: String) {
        synchronized(mergeLock) {
            memory.remove(key)
            if (!fullyLoaded) absent.add(key)
        }
        if (writer == null) adapter.delete(key) else writer.submit { adapter.delete(key) }
    }

    /** Reads the raw envelope for [key]. */
    fun get(key: String): CacheHit<Any?>? {
        successor()?.let { return it.get(key) }
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
                message = "Discarded an unreadable ${key.substringBefore(':')} cache entry",
            )
            delete(key)
            return null
        }

        val now = clock()
        val expiresAt = envelope.deadlineOrNull("expiresAt")
        val staleAt = envelope.deadlineOrNull("staleAt")
        // An entry stamped in the future was written while the wall clock ran ahead, so its
        // deadlines are too. It is still served, but as expired, so the read refreshes it.
        val writtenAhead = createdAt - now > CLOCK_SKEW_TOLERANCE_MS
        val isExpired = writtenAhead || (expiresAt != null && expiresAt < now)

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
            message = "A ${key.substringBefore(':')} cache entry is not a $expected; treating it as a miss",
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
        setWithDeadlines(
            key,
            value,
            staleAt = staleTimeMs?.takeIf { it != 0L }?.let { now + it },
            expiresAt = ttlMs?.takeIf { it != 0L }?.let { now + it },
        )
    }

    /** Marks the entry under [key] stale from now, keeping its value and expiry; nothing when absent. */
    fun markStale(key: String) {
        val hit = get(key) ?: return
        setWithDeadlines(key, hit.value, staleAt = clock() - 1, expiresAt = hit.expiresAt)
    }

    /**
     * Writes [value] under [key] with absolute deadlines in epoch milliseconds, `null` meaning
     * "never". A [staleAt] already past writes an entry that is served but refreshed on its
     * first read, which is how a value carried over from elsewhere is marked as unconfirmed.
     */
    fun setWithDeadlines(key: String, value: Any?, staleAt: Long?, expiresAt: Long?) {
        successor()?.let { return it.setWithDeadlines(key, value, staleAt, expiresAt) }
        val envelope = JSONObject().apply {
            put("createdAt", clock())
            put("expiresAt", expiresAt ?: JSONObject.NULL)
            put("staleAt", staleAt ?: JSONObject.NULL)
            put("value", value ?: JSONObject.NULL)
        }
        write(key, envelope.toString())
        if (handedOff == null) changeCacheKeys { keys -> keys.add(key) }
    }

    /** Removes a single entry. */
    fun delete(key: String) {
        successor()?.let { return it.delete(key) }
        erase(key)
        if (key == CACHE_KEYS_KEY || handedOff != null) return
        changeCacheKeys { keys -> keys.remove(key) }
    }

    /** Removes every entry whose key starts with [prefix]. */
    fun deleteByPrefix(prefix: String) {
        successor()?.let { return it.deleteByPrefix(prefix) }
        // Without the index this memory no longer reflects, there is nothing to find them by.
        if (handedOff != null) return
        if (erasePrefixBeforeMerge(prefix)) return
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
        successor()?.let { return it.clear() }
        if (handedOff != null) return
        if (erasePrefixBeforeMerge("")) return
        synchronized(cacheKeysLock) {
            for (key in readCacheKeys()) {
                erase(key)
            }
            erase(CACHE_KEYS_KEY)
        }
    }

    /**
     * Before the warm-up has merged storage, erases what memory holds under [prefix] and has the
     * merge drop what storage holds under it, without reading the index. Returns `false` once the
     * merge has run.
     */
    private fun erasePrefixBeforeMerge(prefix: String): Boolean {
        synchronized(mergeLock) {
            if (merged) return false
            erasedPrefixes.add(prefix)
            memory.keys.filter { it.startsWith(prefix) }.forEach(::erase)
            return true
        }
    }

    /**
     * Returns the tracked cache keys, in insertion order and without duplicates. Before the
     * warm-up, when reading the stored index would parse the whole file on the caller's thread,
     * only the index memory holds is returned.
     */
    fun getCacheKeys(): List<String> =
        parseCacheKeys(if (merged) read(CACHE_KEYS_KEY) else memory[CACHE_KEYS_KEY]).toList()

    private fun readCacheKeys(): LinkedHashSet<String> = parseCacheKeys(read(CACHE_KEYS_KEY))

    private fun parseCacheKeys(stored: String?): LinkedHashSet<String> {
        if (stored == null) return linkedSetOf()
        val keys = runCatching { JSONArray(stored) }.getOrNull() ?: return linkedSetOf()
        val unique = linkedSetOf<String>()
        for (index in 0 until keys.length()) {
            keys.optString(index).takeIf { it.isNotEmpty() }?.let(unique::add)
        }
        return unique
    }

    /**
     * Applies [change] to the index, rewriting it when [change] reports a difference.
     *
     * Read-modify-write under a lock: two concurrent writers reading the same index and
     * writing back their own copy would lose one of the keys, and a lost key is an entry
     * [clear] can never remove. Before the merge the change is handed to the writer, where it
     * runs after the warm-up, against the whole stored index.
     */
    private fun changeCacheKeys(change: (MutableSet<String>) -> Boolean) {
        val apply = {
            synchronized(cacheKeysLock) {
                val keys = readCacheKeys()
                if (change(keys)) writeCacheKeys(keys)
            }
        }
        if (writer != null && !merged) writer.submit(apply) else apply()
    }

    private fun writeCacheKeys(keys: Set<String>) {
        write(CACHE_KEYS_KEY, JSONArray(keys.toList()).toString())
    }

    /**
     * Rewrites the index once at construction, dropping the duplicates earlier SDK versions
     * appended on every write. Left alone, that index grew without bound and made [clear]
     * O(writes) instead of O(keys). Once the whole namespace is mirrored, keys whose entry is
     * gone — erased before the warm-up, or an expired marker — are dropped too.
     */
    private fun compactCacheKeys() {
        synchronized(cacheKeysLock) {
            val stored = read(CACHE_KEYS_KEY) ?: return
            val kept = readCacheKeys().filter { !fullyLoaded || memory.containsKey(it) }
            val compacted = JSONArray(kept).toString()
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
