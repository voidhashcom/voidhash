package com.voidhash.sdk.analytics

import com.voidhash.sdk.cache.CacheManager
import com.voidhash.sdk.network.CLOCK_SKEW_TOLERANCE_MS
import org.json.JSONObject
import java.util.UUID

/** Cache key of the analytics session, shared with the other Voidhash SDKs. */
internal const val ANALYTICS_SESSION_CACHE_KEY = "voidhash:analytics:session"

/** 30 minutes — the inactivity window after which a new session starts. */
internal const val ANALYTICS_SESSION_TIMEOUT_MS = 30L * 60 * 1000

/**
 * How far the stored time of the last event may fall behind while events keep arriving. Small
 * against [ANALYTICS_SESSION_TIMEOUT_MS], so a process killed before its next write resumes the
 * same session all the same.
 */
internal const val ANALYTICS_SESSION_PERSIST_INTERVAL_MS = 30_000L

/**
 * Owns the analytics session id every captured event is stamped with.
 *
 * A session is a lowercase UUID that lives as long as events keep arriving
 * within [ANALYTICS_SESSION_TIMEOUT_MS] of each other. The id and the time of
 * the last event are persisted as `{id, lastEventAt}` under
 * [ANALYTICS_SESSION_CACHE_KEY], so a session survives a process restart as
 * long as the app comes back within the window.
 *
 * Every write rewrites the SDK's whole preferences file, so the session is not written on every
 * capture: only when it changes, when the stored event time is [ANALYTICS_SESSION_PERSIST_INTERVAL_MS]
 * behind, and through [persist] when the app goes to the background or the client shuts down.
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

    /** The session as last written, so an unchanged one is not written again. */
    private var stored: Session? = null

    /** Whether a capture moved the session on since it was last written. */
    private var unwritten = false

    /**
     * Returns the session id for an event captured now: rotates when there is
     * no session or the last event is older than the timeout, then records the
     * event time. The session is written when it is new or its stored event time has fallen
     * [ANALYTICS_SESSION_PERSIST_INTERVAL_MS] behind.
     */
    @Synchronized
    fun current(): String {
        val now = clock()
        val next = (liveSession(now) ?: Session(uuidFactory().lowercase(), now)).copy(lastEventAt = now)
        val written = stored
        // A stored time ahead of now was written before the wall clock moved back.
        val writeDue = written == null || written.id != next.id ||
            now - written.lastEventAt >= ANALYTICS_SESSION_PERSIST_INTERVAL_MS || now < written.lastEventAt
        if (writeDue) {
            write(next)
        } else {
            session = next
            unwritten = true
        }
        return next.id
    }

    /** Writes the session out if a capture moved it on since it was last written. */
    @Synchronized
    fun persist() {
        if (unwritten) session?.let(::write)
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
        // What the expired session's captures left unwritten no longer matters.
        unwritten = false
        return fresh.id
    }

    /**
     * The id of the session in effect, or `null` when there is none: no capture started one yet,
     * it was discarded, or its last event is older than the timeout. Unlike [peek] it starts no
     * session, and like it never extends one.
     */
    @Synchronized
    fun activeId(): String? = liveSession(clock())?.id

    /** Starts a new session immediately, regardless of the timeout. */
    @Synchronized
    fun rotate(): String {
        val fresh = Session(uuidFactory().lowercase(), clock())
        write(fresh)
        return fresh.id
    }

    /**
     * Forgets the session and deletes the stored one, for when analytics consent is withdrawn.
     * Reading the session id afterwards stores nothing; the next capture starts a new session.
     */
    @Synchronized
    fun discard() {
        session = null
        stored = null
        loaded = true
        unwritten = false
        // Once warm, a miss is answered from memory and needs no write; before, reading could
        // only reach storage on the caller's thread.
        if (!cacheManager.isWarm || cacheManager.get(ANALYTICS_SESSION_CACHE_KEY) != null) {
            cacheManager.delete(ANALYTICS_SESSION_CACHE_KEY)
        }
    }

    /**
     * The persisted session, unless it timed out. A last event stamped in the future was
     * recorded under a wall clock that has since been set back; its age is unknowable, so the
     * session rotates rather than living on until real time catches up.
     */
    private fun liveSession(now: Long): Session? {
        val existing = loadOnce() ?: return null
        if (now - existing.lastEventAt > ANALYTICS_SESSION_TIMEOUT_MS) return null
        if (existing.lastEventAt - now > CLOCK_SKEW_TOLERANCE_MS) return null
        return existing
    }

    private fun loadOnce(): Session? {
        if (loaded) return session
        loaded = true
        session = try {
            cacheManager.getObject(ANALYTICS_SESSION_CACHE_KEY)?.value?.let { entry ->
                val id = entry.optString("id")
                if (id.isEmpty() || !entry.has("lastEventAt")) null
                else Session(id, entry.getLong("lastEventAt"))
            }
        } catch (error: Throwable) {
            onWarning("Failed to read the analytics session: ${error.message}")
            null
        }
        stored = session
        return session
    }

    /** Keeps the in-memory session even when the cache write fails, so ids stay stable. */
    private fun write(next: Session) {
        session = next
        loaded = true
        try {
            cacheManager.set(
                ANALYTICS_SESSION_CACHE_KEY,
                JSONObject().put("id", next.id).put("lastEventAt", next.lastEventAt),
            )
            stored = next
            unwritten = false
        } catch (error: Throwable) {
            onWarning("Failed to store the analytics session: ${error.message}")
        }
    }
}
