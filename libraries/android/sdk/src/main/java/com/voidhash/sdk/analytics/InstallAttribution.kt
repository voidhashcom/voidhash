package com.voidhash.sdk.analytics

import com.voidhash.sdk.cache.CacheManager
import com.voidhash.sdk.diagnostics.DiagnosticEmitter
import com.voidhash.sdk.diagnostics.VoidhashDiagnosticKind
import org.json.JSONObject

/**
 * Cache key of the install attribution state. Outside the `voidhash:analytics:` keys: withdrawing
 * consent does not make an install fresh again.
 */
internal const val INSTALL_ATTRIBUTION_CACHE_KEY = "voidhash:attribution:install-touch"

/** Launches an install keeps asking on, so a device that can never get an answer stops asking. */
internal const val INSTALL_ATTRIBUTION_MAX_ATTEMPTS = 10

private const val STATUS_PENDING = "pending"
private const val STATUS_DONE = "done"

/** How one attempt to read this install's referrers ended. */
internal sealed interface InstallAttributionOutcome {
    /** A definitive answer with a touch to record. */
    data class Touch(val values: Map<String, String>) : InstallAttributionOutcome

    /** A definitive answer: this install has no touch. */
    data object NoTouch : InstallAttributionOutcome

    /** No answer yet; a later launch asks again. */
    data object TryLater : InstallAttributionOutcome
}

/**
 * The once-per-install read of the store referrers: what is asked and what the answer means.
 * [com.voidhash.sdk.VoidhashClient] decides when it runs (consent, foreground, lifetime) and records
 * the touch.
 *
 * Only an install this SDK saw from its first launch is read. An install that already held an
 * identity when the state below was first written predates this code, and its store referrer
 * describes a click from long ago, so it is marked done without asking. A fresh install is recorded
 * as pending at once, whatever the consent, as nothing else could tell it from an old one by the
 * time consent arrives on a later launch. Android restores the SDK's storage onto a reinstall or a
 * new device; [firstInstallTime] tells that apart from this install's own state, as for
 * `$app_installed`, and makes it fresh.
 *
 * @param hadIdentityBeforeThisLaunch whether storage held a distinct id before this launch could
 *   mint one, `null` when storage could not be read to tell, which settles nothing. Only asked once
 *   the cache warmed.
 * @param metaAppId the Meta app id to ask Meta's apps about, `null` to skip them.
 */
internal class InstallAttribution(
    private val cacheManager: CacheManager,
    private val hadIdentityBeforeThisLaunch: () -> Boolean?,
    private val firstInstallTime: Long?,
    private val metaAppId: String?,
    private val metaProviders: MetaProviderLookup,
    private val playConnection: () -> PlayReferrerConnection,
    private val now: () -> Long,
    private val diagnostics: DiagnosticEmitter,
) {
    /** Settles whether this install is ever read; on every launch, once the cache has warmed. */
    @Synchronized
    fun prepare() {
        val state = readState()
        when {
            state == null -> when (hadIdentityBeforeThisLaunch()) {
                true -> writeState(STATUS_DONE, attempts = 0)
                false -> writeState(STATUS_PENDING, attempts = 0)
                null -> Unit
            }
            restoredFromAnotherInstall(state) -> writeState(STATUS_PENDING, attempts = 0)
        }
    }

    /**
     * Claims this launch's attempt; `false` when the install needs none. The attempt counts from
     * here, so one interrupted by the app being killed counts too.
     */
    @Synchronized
    fun beginAttempt(): Boolean {
        prepare()
        val state = readState()
        if (state == null) {
            reportDeferred("The SDK's storage could not be read to tell a fresh install")
            return false
        }
        if (state.optString("status") != STATUS_PENDING) return false
        val attempts = state.optInt("attempts")
        if (attempts >= INSTALL_ATTRIBUTION_MAX_ATTEMPTS) {
            diagnostics.emit(
                VoidhashDiagnosticKind.TRANSPORT,
                code = "INSTALL_ATTRIBUTION_ABANDONED",
                operation = "attribution.install",
                message = "Stopped asking the store for this install's referrer after $attempts launches without an answer",
            )
            markDone()
            return false
        }
        writeState(STATUS_PENDING, attempts + 1)
        return true
    }

    /**
     * Asks Meta's apps, then Google Play: a touch from Meta is preferred over Play's. Without a touch
     * the answer is definitive only when no Meta app failed: one that could not answer may still
     * hold the touch on a later launch.
     */
    suspend fun read(): InstallAttributionOutcome {
        val meta = metaAppId?.let { readMetaReferrers(metaProviders, it, now()) }
        meta?.touch?.let { return InstallAttributionOutcome.Touch(it) }
        val metaFailed = meta?.failed == true
        return when (val answer = readPlayReferrer(playConnection())) {
            is PlayReferrerAnswer.Found -> {
                val touch = playReferrerTouch(answer.details, now())
                if (touch == null) {
                    noTouchFromPlay(metaFailed)
                } else {
                    if (metaFailed) {
                        diagnostics.emit(
                            VoidhashDiagnosticKind.TRANSPORT,
                            code = "INSTALL_ATTRIBUTION_ABANDONED",
                            operation = "attribution.install",
                            message = "A Meta app could not answer; the touch from Google Play is recorded, and Meta's apps are not asked again",
                        )
                    }
                    InstallAttributionOutcome.Touch(touch)
                }
            }
            is PlayReferrerAnswer.Refused -> {
                if (!metaFailed) {
                    diagnostics.emit(
                        VoidhashDiagnosticKind.TRANSPORT,
                        code = "INSTALL_ATTRIBUTION_ABANDONED",
                        operation = "attribution.install",
                        message = "Google Play will not provide this install's referrer: it answered ${answer.responseCode}",
                    )
                }
                noTouchFromPlay(metaFailed)
            }
            is PlayReferrerAnswer.Unavailable -> {
                reportDeferred(answer.reason)
                InstallAttributionOutcome.TryLater
            }
        }
    }

    private fun noTouchFromPlay(metaFailed: Boolean): InstallAttributionOutcome {
        if (!metaFailed) return InstallAttributionOutcome.NoTouch
        reportDeferred("A Meta app could not answer")
        return InstallAttributionOutcome.TryLater
    }

    /** Reports that the install stays pending, and why. */
    fun reportDeferred(reason: String) {
        diagnostics.emit(
            VoidhashDiagnosticKind.TRANSPORT,
            code = "INSTALL_ATTRIBUTION_DEFERRED",
            operation = "attribution.install",
            retryable = true,
            message = "$reason; a later launch asks again",
        )
    }

    /** The install is settled for good. Call once its touch, if any, is in the queue on disk. */
    @Synchronized
    fun markDone() {
        writeState(STATUS_DONE, attempts = readState()?.optInt("attempts") ?: 0)
    }

    private fun readState(): JSONObject? = cacheManager.getObject(INSTALL_ATTRIBUTION_CACHE_KEY)?.value

    private fun restoredFromAnotherInstall(state: JSONObject): Boolean =
        firstInstallTime != null && state.has("firstInstallTime") && state.optLong("firstInstallTime") != firstInstallTime

    private fun writeState(status: String, attempts: Int) {
        val state = JSONObject().put("status", status).put("attempts", attempts)
        firstInstallTime?.let { state.put("firstInstallTime", it) }
        cacheManager.set(INSTALL_ATTRIBUTION_CACHE_KEY, state)
    }
}
