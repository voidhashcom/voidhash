package com.voidhash.sdk.analytics

import com.voidhash.sdk.cache.CacheManager
import org.json.JSONObject
import java.util.UUID

/** Cache key of the analytics session, shared with the other Voidhash SDKs. */
internal const val ANALYTICS_SESSION_CACHE_KEY = "voidhash:analytics:session"

/** 30 minutes — the inactivity window after which a new session starts. */
internal const val ANALYTICS_SESSION_TIMEOUT_MS = 30L * 60 * 1000

/**
 * Owns the analytics session id every captured event is stamped with.
 *
 * A session is a lowercase UUID that lives as long as events keep arriving
 * within [ANALYTICS_SESSION_TIMEOUT_MS] of each other. The id and the time of
 * the last event are persisted as `{id, lastEventAt}` under
 * [ANALYTICS_SESSION_CACHE_KEY] on every capture, so a session survives a
 * process restart as long as the app comes back within the window.
 *
 * All access is serialized, so concurrent captures never mint two sessions.
 */
class AnalyticsSessionManager(
    private val cacheManager: CacheManager,
    private val clock: () -> Long = { System.currentTimeMillis() },
    private val uuidFactory: () -> String = { UUID.randomUUID().toString() },
    private val onWarning: (String) -> Unit = {},
) {
    private data class Session(val id: String, val lastEventAt: Long)

    private var session: Session? = null
    private var loaded = false

    /**
     * Returns the session id for an event captured now: rotates when there is
     * no session or the last event is older than the timeout, then records the
     * event time and persists the session.
     */
    @Synchronized
    fun current(): String {
        val now = clock()
        val live = liveSession(now) ?: Session(uuidFactory().lowercase(), now)
        persist(live.copy(lastEventAt = now))
        return live.id
    }

    /**
     * Returns the session id without extending the session. A missing or
     * expired session is replaced so the caller always sees the id the next
     * capture would carry; the replacement is not persisted until then.
     */
    @Synchronized
    fun peek(): String {
        val now = clock()
        liveSession(now)?.let { return it.id }
        val fresh = Session(uuidFactory().lowercase(), now)
        session = fresh
        return fresh.id
    }

    /** Starts a new session immediately, regardless of the timeout. */
    @Synchronized
    fun rotate(): String {
        val fresh = Session(uuidFactory().lowercase(), clock())
        persist(fresh)
        return fresh.id
    }

    private fun liveSession(now: Long): Session? {
        val existing = loadOnce() ?: return null
        if (now - existing.lastEventAt > ANALYTICS_SESSION_TIMEOUT_MS) return null
        return existing
    }

    private fun loadOnce(): Session? {
        if (loaded) return session
        loaded = true
        session = try {
            cacheManager.getObject(ANALYTICS_SESSION_CACHE_KEY)?.value?.let { stored ->
                val id = stored.optString("id")
                if (id.isEmpty() || !stored.has("lastEventAt")) null
                else Session(id, stored.getLong("lastEventAt"))
            }
        } catch (error: Throwable) {
            onWarning("Failed to read the analytics session: ${error.message}")
            null
        }
        return session
    }

    /** Keeps the in-memory session even when the cache write fails, so ids stay stable. */
    private fun persist(next: Session) {
        session = next
        loaded = true
        try {
            cacheManager.set(
                ANALYTICS_SESSION_CACHE_KEY,
                JSONObject().put("id", next.id).put("lastEventAt", next.lastEventAt),
            )
        } catch (error: Throwable) {
            onWarning("Failed to store the analytics session: ${error.message}")
        }
    }
}
