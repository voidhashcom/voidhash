package com.voidhash.sdk.identity

import com.voidhash.sdk.ANONYMOUS_DISTINCT_ID_PREFIX
import com.voidhash.sdk.cache.CacheManager
import java.util.UUID

private const val DISTINCT_ID_CACHE_KEY = "distinctId"

/**
 * Owns the persisted distinct id. A client that has never identified anybody
 * gets an anonymous id (`vh:anon:` + UUID) that survives restarts.
 */
class IdentityStore(
    private val cacheManager: CacheManager,
    private val anonymousIdFactory: () -> String = { ANONYMOUS_DISTINCT_ID_PREFIX + UUID.randomUUID() },
) {
    /**
     * Returns the current distinct id, generating an anonymous one on first use.
     *
     * A stored id is returned without waiting on anything. Minting a new one waits for the
     * cache warm-up first: until the legacy migration and the snapshot have landed, a miss
     * may only mean the id has not been read from storage yet, and minting on it would give
     * a returning device a second identity.
     */
    fun getDistinctId(): String {
        cacheManager.getString(DISTINCT_ID_CACHE_KEY)?.let { return it.value }

        cacheManager.awaitWarmBlocking()
        cacheManager.getString(DISTINCT_ID_CACHE_KEY)?.let { return it.value }

        val anonymousDistinctId = anonymousIdFactory()
        setDistinctId(anonymousDistinctId)
        return anonymousDistinctId
    }

    /** Persists [distinctId] as the current identity. */
    fun setDistinctId(distinctId: String) {
        cacheManager.set(DISTINCT_ID_CACHE_KEY, distinctId)
    }

    /** True while the current distinct id is an SDK-generated anonymous one. */
    fun isAnonymous(): Boolean = getDistinctId().startsWith(ANONYMOUS_DISTINCT_ID_PREFIX)

    /**
     * Drops only the stored identity; the next [getDistinctId] mints a new anonymous id.
     * Shared entries such as the schema and remembered placements are kept.
     */
    fun forgetDistinctId() {
        cacheManager.delete(DISTINCT_ID_CACHE_KEY)
    }

    /** Clears the cache, dropping the identity along with everything else. */
    fun reset() {
        cacheManager.clear()
    }
}
