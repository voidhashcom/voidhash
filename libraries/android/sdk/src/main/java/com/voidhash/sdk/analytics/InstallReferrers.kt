package com.voidhash.sdk.analytics

import android.content.Context
import android.net.Uri
import android.os.RemoteException
import com.android.installreferrer.api.InstallReferrerClient
import com.android.installreferrer.api.InstallReferrerClient.InstallReferrerResponse
import com.android.installreferrer.api.InstallReferrerStateListener
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull

/** How long Google Play gets to answer before the read is left for a later launch. */
private const val PLAY_REFERRER_TIMEOUT_MS = 10_000L

private val META_REFERRER_AUTHORITIES = listOf(
    "com.facebook.katana.provider.InstallReferrerProvider",
    "com.instagram.contentprovider.InstallReferrerProvider",
    "com.facebook.lite.provider.InstallReferrerProvider",
)

private const val COLUMN_INSTALL_REFERRER = "install_referrer"
private const val COLUMN_IS_CLICK_THROUGH = "is_ct"
private const val COLUMN_ACTUAL_TIMESTAMP = "actual_timestamp"

/** Google Play's install referrer service, as far as this SDK uses it. The seam tests drive. */
internal interface PlayReferrerConnection {
    /**
     * Binds to the service. [listener] hears the setup's [InstallReferrerResponse] on its own
     * thread, and may hear [Listener.onDisconnected] at any time after.
     */
    fun start(listener: Listener)

    /** Reads what the service holds; only after a setup that answered [InstallReferrerResponse.OK]. */
    fun details(): PlayReferrerDetails

    fun end()

    interface Listener {
        fun onSetupFinished(responseCode: Int)
        fun onDisconnected()
    }
}

internal class DevicePlayReferrerConnection(private val client: InstallReferrerClient) : PlayReferrerConnection {
    constructor(context: Context) : this(InstallReferrerClient.newBuilder(context).build())

    override fun start(listener: PlayReferrerConnection.Listener) {
        client.startConnection(
            object : InstallReferrerStateListener {
                override fun onInstallReferrerSetupFinished(responseCode: Int) = listener.onSetupFinished(responseCode)

                override fun onInstallReferrerServiceDisconnected() = listener.onDisconnected()
            },
        )
    }

    override fun details(): PlayReferrerDetails {
        val details = client.installReferrer
        return PlayReferrerDetails(
            installReferrer = details.installReferrer,
            clickTimestampSeconds = details.referrerClickTimestampSeconds,
            clickTimestampServerSeconds = details.referrerClickTimestampServerSeconds,
        )
    }

    override fun end() = client.endConnection()
}

/** How a read of the Play install referrer ended. */
internal sealed interface PlayReferrerAnswer {
    data class Found(val details: PlayReferrerDetails) : PlayReferrerAnswer

    /** Play will never answer on this install: no Play Store, or the app may not ask. */
    data class Refused(val responseCode: Int) : PlayReferrerAnswer

    /** Play could not answer now; a later launch can ask again. */
    data class Unavailable(val reason: String) : PlayReferrerAnswer
}

/**
 * Reads the Play install referrer once, off the thread that called. The connection is always ended,
 * also when the read is cancelled, and a service that never answers is left for a later launch.
 */
internal suspend fun readPlayReferrer(connection: PlayReferrerConnection): PlayReferrerAnswer {
    val setup = CompletableDeferred<Int>()
    try {
        try {
            connection.start(
                object : PlayReferrerConnection.Listener {
                    override fun onSetupFinished(responseCode: Int) {
                        setup.complete(responseCode)
                    }

                    override fun onDisconnected() {
                        setup.complete(InstallReferrerResponse.SERVICE_DISCONNECTED)
                    }
                },
            )
        } catch (error: RuntimeException) {
            return PlayReferrerAnswer.Unavailable("Google Play could not be reached: ${error.javaClass.simpleName}")
        }
        return when (val code = withTimeoutOrNull(PLAY_REFERRER_TIMEOUT_MS) { setup.await() }) {
            null -> PlayReferrerAnswer.Unavailable("Google Play did not answer in time")
            InstallReferrerResponse.OK -> try {
                PlayReferrerAnswer.Found(connection.details())
            } catch (_: RemoteException) {
                PlayReferrerAnswer.Unavailable("Google Play went away during the read")
            } catch (error: RuntimeException) {
                // Its client answers a read after the service disconnected with one of these.
                PlayReferrerAnswer.Unavailable("Google Play could not be read: ${error.javaClass.simpleName}")
            }
            InstallReferrerResponse.FEATURE_NOT_SUPPORTED,
            InstallReferrerResponse.DEVELOPER_ERROR,
            InstallReferrerResponse.PERMISSION_ERROR,
            -> PlayReferrerAnswer.Refused(code)
            else -> PlayReferrerAnswer.Unavailable("Google Play answered $code")
        }
    } finally {
        runCatching { connection.end() }
    }
}

/** The content providers Meta's apps expose. The seam tests drive. */
internal interface MetaProviderLookup {
    fun hasProvider(authority: String): Boolean

    /**
     * The first row of [uri], `null` when the provider answered and has none.
     *
     * @throws RuntimeException when the provider could not answer.
     */
    fun firstRow(uri: String): MetaReferrerRow?
}

internal class DeviceMetaProviderLookup(private val context: Context) : MetaProviderLookup {
    override fun hasProvider(authority: String): Boolean =
        context.packageManager.resolveContentProvider(authority, 0) != null

    override fun firstRow(uri: String): MetaReferrerRow? {
        val projection = arrayOf(COLUMN_INSTALL_REFERRER, COLUMN_IS_CLICK_THROUGH, COLUMN_ACTUAL_TIMESTAMP)
        // Android answers with no cursor when the provider died or could not be reached: unlike
        // an empty one, that says nothing about the install.
        val rows = context.contentResolver.query(Uri.parse(uri), projection, null, null, null)
            ?: throw IllegalStateException("The provider answered with no cursor")
        return rows.use { cursor ->
            if (!cursor.moveToFirst()) return null
            // A column Meta renamed reads as absent rather than failing the row.
            fun text(column: String) = cursor.getColumnIndex(column).takeIf { it >= 0 }?.let(cursor::getString)
            MetaReferrerRow(
                installReferrer = text(COLUMN_INSTALL_REFERRER),
                isClickThrough = text(COLUMN_IS_CLICK_THROUGH),
                actualTimestampSeconds = text(COLUMN_ACTUAL_TIMESTAMP),
            )
        }
    }
}

/**
 * What Meta's apps answered about this install.
 *
 * @property touch the first touch one of them reported, `null` for none.
 * @property failed whether an app that is installed could not answer, so `null` is not the last word.
 */
internal data class MetaReferrerAnswer(val touch: Map<String, String>?, val failed: Boolean)

/**
 * Asks Meta's apps, in order, for the touch behind this install, and stops at the first one's. An
 * app that is not installed, has no row for [metaAppId] or fails is skipped. Runs on a background
 * thread, as the query can wait for another app's process to start, and asks no further once
 * cancelled: a read withdrawn meanwhile must not start one more.
 */
internal suspend fun readMetaReferrers(
    lookup: MetaProviderLookup,
    metaAppId: String,
    nowMs: Long,
): MetaReferrerAnswer = withContext(Dispatchers.IO) {
    var failed = false
    for (authority in META_REFERRER_AUTHORITIES) {
        ensureActive()
        try {
            if (!lookup.hasProvider(authority)) continue
            lookup.firstRow("content://$authority/$metaAppId")?.let { metaReferrerTouch(it, nowMs) }?.let {
                return@withContext MetaReferrerAnswer(it, failed)
            }
        } catch (_: RuntimeException) {
            // A provider's own failure, or a security refusal, says nothing about the next one.
            failed = true
        }
    }
    MetaReferrerAnswer(null, failed)
}
