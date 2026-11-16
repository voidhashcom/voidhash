package com.voidhash.sdk.identity

import com.voidhash.sdk.ANONYMOUS_DISTINCT_ID_PREFIX
import com.voidhash.sdk.isAnonymousDistinctId
import com.voidhash.sdk.cache.CacheManager
import org.json.JSONObject
import java.util.UUID

internal const val DISTINCT_ID_CACHE_KEY = "distinctId"

/** Cache key holding the groups the end user belongs to, by group type. */
internal const val GROUPS_CACHE_KEY = "groups"

/**
 * Cache key holding, by group type, a digest of the properties `setGroups` last sent for the
 * group held of that type.
 */
internal const val GROUP_DIGESTS_CACHE_KEY = "groupDigests"

/** Cache key holding the user last identified and a digest of the profile sent with them. */
internal const val IDENTIFIED_PROFILE_CACHE_KEY = "identifiedProfile"

/** Longest group key the API keeps, in UTF-16 code units, as the API counts them. */
private const val MAX_GROUP_KEY_LENGTH = 256

private val GROUP_TYPE = Regex("[a-z][a-z0-9_]{0,63}")

/** Longest distinct id the API stores, in code points. */
private const val MAX_DISTINCT_ID_LENGTH = 255

/**
 * Why the API refuses [distinctId] as an identity, or `null` when it accepts it; the rule the
 * backend applies to every distinct id. An id is used exactly as given, never trimmed, so it
 * only has to hold one non-whitespace character, at most 255 code points and no NUL.
 */
internal fun invalidDistinctIdReason(distinctId: String): String? = when {
    distinctId.isBlank() -> "must contain at least one non-whitespace character"
    distinctId.codePointCount(0, distinctId.length) > MAX_DISTINCT_ID_LENGTH ->
        "must be at most $MAX_DISTINCT_ID_LENGTH characters long"
    '\u0000' in distinctId -> "must not contain NUL characters"
    else -> null
}

/**
 * Why the API refuses [type] and [key] as a group, or `null` when it accepts them: a type is a
 * lower-case letter followed by up to 63 lower-case letters, digits or underscores, and a key holds
 * 1 to 256 characters.
 */
internal fun invalidGroupReason(type: String, key: String): String? = when {
    !GROUP_TYPE.matches(type) ->
        "the group type must be a lower-case letter followed by up to 63 lower-case letters, " +
            "digits or underscores, like company or team_1"
    key.isEmpty() || key.length > MAX_GROUP_KEY_LENGTH ->
        "the group key must have 1 to $MAX_GROUP_KEY_LENGTH characters"
    else -> null
}

/**
 * Owns the persisted distinct id, and the groups the end user belongs to. A client that has never
 * identified anybody gets an anonymous id (`vh_anon_` + UUID) that survives restarts.
 *
 * The groups live as long as the identity: stored next to it, and forgotten with it by
 * [forgetDistinctId] and [reset]. An identify keeps them.
 *
 * It also remembers what was last sent about the identity, so that repeating a call sends nothing:
 * the profile of the last identify, and the properties of each group `setGroups` described.
 */
class IdentityStore(
    private val cacheManager: CacheManager,
    private val anonymousIdFactory: () -> String = { ANONYMOUS_DISTINCT_ID_PREFIX + UUID.randomUUID() },
) {
    @Volatile
    private var pinned: String? = null

    /** A distinct id adopted through [pin] that storage does not hold yet. */
    val pinnedDistinctId: String? get() = pinned

    /**
     * Adopts [distinctId], the host's configure-time id, as the identity of this process at
     * once, without touching storage. Storage keeps the id it holds until the client persists
     * the pin with [setDistinctId], after it has linked an anonymous id the pin replaces: an id
     * overwritten first would be an anonymous purchaser nobody can merge any more.
     *
     * An id the API refuses (see [invalidDistinctIdReason]) is ignored, since every request made
     * as it would be refused; returns whether [distinctId] was pinned.
     */
    @Synchronized
    fun pin(distinctId: String): Boolean {
        if (invalidDistinctIdReason(distinctId) != null) return false
        pinned = distinctId
        return true
    }

    /**
     * Returns the current distinct id, generating an anonymous one on first use.
     *
     * A pinned or stored id is returned without waiting on anything. Minting a new one waits
     * for the cache warm-up first: until the legacy migration and the snapshot have landed, a
     * miss may only mean the id has not been read from storage yet, and minting on it would
     * give a returning device a second identity.
     */
    @Synchronized
    fun getDistinctId(): String {
        pinned?.let { return it }
        cacheManager.getString(DISTINCT_ID_CACHE_KEY)?.let { return it.value }

        cacheManager.awaitWarmBlocking()
        cacheManager.getString(DISTINCT_ID_CACHE_KEY)?.let { return it.value }

        val anonymousDistinctId = anonymousIdFactory()
        setDistinctId(anonymousDistinctId)
        return anonymousDistinctId
    }

    /**
     * The distinct id storage holds, ignoring a pin and never minting one. Only meaningful once
     * the cache has warmed up.
     */
    fun storedDistinctId(): String? = cacheManager.getString(DISTINCT_ID_CACHE_KEY)?.value

    /** Persists [distinctId] as the current identity, replacing any pin. */
    @Synchronized
    fun setDistinctId(distinctId: String) {
        pinned = null
        cacheManager.set(DISTINCT_ID_CACHE_KEY, distinctId)
    }

    /** True while the current distinct id is an SDK-generated anonymous one. */
    fun isAnonymous(): Boolean = isAnonymousDistinctId(getDistinctId())

    /**
     * Replaces the stored identity with a fresh anonymous id, which belongs to no group.
     * Shared entries such as the schema and remembered placements are kept.
     */
    @Synchronized
    fun forgetDistinctId() {
        setDistinctId(anonymousIdFactory())
        resetGroups()
        forgetIdentifiedProfile()
    }

    /**
     * The digest of the profile last queued with an identify of [externalUserId], or `null` when
     * the last identify was of another user, or [forgetDistinctId] ended it.
     */
    @Synchronized
    fun identifiedProfileDigest(externalUserId: String): String? {
        val stored = cacheManager.getObject(IDENTIFIED_PROFILE_CACHE_KEY)?.value ?: return null
        return (stored.opt("digest") as? String)?.takeIf { stored.opt("id") == externalUserId }
    }

    /** Forgets the profile of the last identify if it was of [externalUserId], so that a repeat of it is sent. */
    @Synchronized
    fun forgetIdentifiedProfile(externalUserId: String) {
        if (identifiedProfileDigest(externalUserId) != null) forgetIdentifiedProfile()
    }

    /** Forgets the profile of the last identify, so that a repeat of it is sent. */
    @Synchronized
    fun forgetIdentifiedProfile() {
        cacheManager.delete(IDENTIFIED_PROFILE_CACHE_KEY)
    }

    /** Remembers [digest] as the profile last queued with an identify of [externalUserId]. */
    @Synchronized
    fun setIdentifiedProfile(externalUserId: String, digest: String) {
        if (identifiedProfileDigest(externalUserId) == digest) return
        cacheManager.set(IDENTIFIED_PROFILE_CACHE_KEY, JSONObject().put("id", externalUserId).put("digest", digest))
    }

    /**
     * The groups the end user belongs to, by group type. A stored entry the API would refuse is
     * left out.
     */
    val groups: Map<String, String>
        @Synchronized get() {
            val stored = cacheManager.getObject(GROUPS_CACHE_KEY)?.value ?: return emptyMap()
            return stored.keys().asSequence()
                .mapNotNull { type -> (stored.opt(type) as? String)?.let { type to it } }
                .filter { (type, key) -> invalidGroupReason(type, key) == null }
                .toMap()
        }

    /**
     * Puts the end user in group [key] of [type], replacing their group of that type, and stores
     * it with the identity. Returns whether their group of that type changed. A group the API
     * refuses (see [invalidGroupReason]) is ignored. The digest [setGroupDigests] holds for
     * [type] is forgotten: what is sent for the group next is not what `setGroups` sent.
     */
    @Synchronized
    fun setGroup(type: String, key: String): Boolean {
        if (invalidGroupReason(type, key) != null) return false
        val digests = groupDigests
        if (type in digests) setGroupDigests(digests - type)
        val current = groups
        if (current[type] == key) return false
        cacheManager.set(GROUPS_CACHE_KEY, JSONObject(current + (type to key)))
        return true
    }

    /**
     * Replaces the groups the end user belongs to with [groups], by group type, in one write.
     * The caller passes only groups the API accepts (see [invalidGroupReason]).
     */
    @Synchronized
    fun replaceGroups(groups: Map<String, String>) {
        if (groups.isEmpty()) return resetGroups()
        if (groups != this.groups) cacheManager.set(GROUPS_CACHE_KEY, JSONObject(groups))
    }

    /** The digests of the group properties `setGroups` last sent, by group type. */
    val groupDigests: Map<String, String>
        @Synchronized get() {
            val stored = cacheManager.getObject(GROUP_DIGESTS_CACHE_KEY)?.value ?: return emptyMap()
            return stored.keys().asSequence()
                .mapNotNull { type -> (stored.opt(type) as? String)?.let { type to it } }
                .toMap()
        }

    /** Replaces [groupDigests]. */
    @Synchronized
    fun setGroupDigests(digests: Map<String, String>) {
        when {
            digests == groupDigests -> Unit
            digests.isEmpty() -> cacheManager.delete(GROUP_DIGESTS_CACHE_KEY)
            else -> cacheManager.set(GROUP_DIGESTS_CACHE_KEY, JSONObject(digests))
        }
    }

    /** Takes the end user out of every group. */
    @Synchronized
    fun resetGroups() {
        cacheManager.delete(GROUPS_CACHE_KEY)
        cacheManager.delete(GROUP_DIGESTS_CACHE_KEY)
    }

    /** Clears the cache, dropping the identity and its groups along with everything else. */
    @Synchronized
    fun reset() {
        pinned = null
        cacheManager.clear()
    }
}
