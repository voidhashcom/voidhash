package com.margelo.nitro.voidhash.measurement

import android.content.Context
import com.android.installreferrer.api.InstallReferrerClient
import com.android.installreferrer.api.InstallReferrerStateListener
import java.util.Timer
import java.util.TimerTask
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.text.SimpleDateFormat
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine
import org.json.JSONObject

internal enum class StoreKind {
    GOOGLE_PLAY,
    SAMSUNG_GALAXY_STORE,
    HUAWEI_APP_GALLERY,
    XIAOMI_GET_APPS,
    META,
    PREINSTALL,
    OUT_OF_STORE,
}

internal enum class InstallReferrerOutcome(val wireValue: String) {
    AVAILABLE("available"),
    COLLECTED("collected"),
    NOT_INSTALLED("notInstalled"),
    UNSUPPORTED("unsupported"),
    TIMEOUT("timeout"),
    PERMISSION_DENIED("permissionDenied"),
    INVALID_SIGNATURE("invalidSignature"),
}

internal data class InstallReferrerEvidence(
    val store: StoreKind,
    val outcome: InstallReferrerOutcome,
    val rawReferrer: String? = null,
    val clickTimestampSeconds: Long? = null,
    val installTimestampSeconds: Long? = null,
    val clickServerTimestampSeconds: Long? = null,
    val installServerTimestampSeconds: Long? = null,
    val instantExperience: Boolean? = null,
    val installVersion: String? = null,
    val responseCode: Int? = null,
    val libraryVersion: String = "2.2",
    val verificationState: String = "unverified",
)

internal interface InstallReferrerProvider {
    val store: StoreKind
    suspend fun collect(): InstallReferrerEvidence
}

internal class ConfiguredInstallReferrerProvider(
    override val store: StoreKind,
    private val referrer: String?,
    private val verificationState: String = "configured",
) : InstallReferrerProvider {
    override suspend fun collect(): InstallReferrerEvidence =
        if (referrer.isNullOrBlank()) {
            InstallReferrerEvidence(store, InstallReferrerOutcome.NOT_INSTALLED)
        } else {
            InstallReferrerEvidence(
                store = store,
                outcome = InstallReferrerOutcome.COLLECTED,
                rawReferrer = referrer,
                verificationState = verificationState,
            )
        }
}

internal class OptionalDependencyInstallReferrerProvider(
    override val store: StoreKind,
    private val dependencyClassName: String,
    private val collector: suspend () -> InstallReferrerEvidence,
) : InstallReferrerProvider {
    override suspend fun collect(): InstallReferrerEvidence {
        try {
            Class.forName(dependencyClassName, false, javaClass.classLoader)
        } catch (_: SecurityException) {
            return InstallReferrerEvidence(store, InstallReferrerOutcome.PERMISSION_DENIED)
        } catch (_: ClassNotFoundException) {
            return InstallReferrerEvidence(store, InstallReferrerOutcome.NOT_INSTALLED)
        } catch (_: LinkageError) {
            return InstallReferrerEvidence(store, InstallReferrerOutcome.NOT_INSTALLED)
        } catch (_: Throwable) {
            return InstallReferrerEvidence(store, InstallReferrerOutcome.UNSUPPORTED)
        }
        return try {
            collector()
        } catch (_: SecurityException) {
            InstallReferrerEvidence(store, InstallReferrerOutcome.PERMISSION_DENIED)
        } catch (_: Throwable) {
            InstallReferrerEvidence(store, InstallReferrerOutcome.UNSUPPORTED)
        }
    }
}

internal fun classifyPlayInstallReferrerResponse(responseCode: Int): InstallReferrerOutcome =
    when (responseCode) {
        InstallReferrerClient.InstallReferrerResponse.OK -> InstallReferrerOutcome.COLLECTED
        InstallReferrerClient.InstallReferrerResponse.FEATURE_NOT_SUPPORTED -> InstallReferrerOutcome.UNSUPPORTED
        InstallReferrerClient.InstallReferrerResponse.PERMISSION_ERROR -> InstallReferrerOutcome.PERMISSION_DENIED
        InstallReferrerClient.InstallReferrerResponse.SERVICE_UNAVAILABLE -> InstallReferrerOutcome.NOT_INSTALLED
        InstallReferrerClient.InstallReferrerResponse.SERVICE_DISCONNECTED -> InstallReferrerOutcome.AVAILABLE
        else -> InstallReferrerOutcome.UNSUPPORTED
    }

internal class GooglePlayInstallReferrerProvider(
    context: Context,
    private val timeoutMs: Long = 5_000,
    private val maximumTransientRetries: Int = 2,
) : InstallReferrerProvider {
    override val store = StoreKind.GOOGLE_PLAY
    private val appContext = context.applicationContext

    override suspend fun collect(): InstallReferrerEvidence = suspendCoroutine { continuation ->
        val completed = AtomicBoolean(false)
        val timer = Timer("voidhash-install-referrer-timeout", true)
        var retries = 0
        var activeClient: InstallReferrerClient? = null

        fun finish(evidence: InstallReferrerEvidence) {
            if (!completed.compareAndSet(false, true)) return
            timer.cancel()
            activeClient?.endConnection()
            continuation.resume(evidence)
        }

        fun connect() {
            val client = InstallReferrerClient.newBuilder(appContext).build()
            activeClient = client
            try {
                client.startConnection(object : InstallReferrerStateListener {
                    override fun onInstallReferrerSetupFinished(responseCode: Int) {
                        if (responseCode == InstallReferrerClient.InstallReferrerResponse.OK) {
                            try {
                                val details = client.installReferrer
                                finish(
                                    InstallReferrerEvidence(
                                        store = store,
                                        outcome = InstallReferrerOutcome.COLLECTED,
                                        rawReferrer = details.installReferrer,
                                        clickTimestampSeconds = details.referrerClickTimestampSeconds,
                                        installTimestampSeconds = details.installBeginTimestampSeconds,
                                        clickServerTimestampSeconds = details.referrerClickTimestampServerSeconds,
                                        installServerTimestampSeconds = details.installBeginTimestampServerSeconds,
                                        instantExperience = details.googlePlayInstantParam,
                                        installVersion = details.installVersion,
                                        responseCode = responseCode,
                                    ),
                                )
                            } catch (_: SecurityException) {
                                finish(InstallReferrerEvidence(store, InstallReferrerOutcome.PERMISSION_DENIED, responseCode = responseCode))
                            } catch (_: Throwable) {
                                finish(InstallReferrerEvidence(store, InstallReferrerOutcome.UNSUPPORTED, responseCode = responseCode))
                            }
                            return
                        }
                        val outcome = classifyPlayInstallReferrerResponse(responseCode)
                        if (outcome == InstallReferrerOutcome.AVAILABLE && retries < maximumTransientRetries) {
                            retries += 1
                            client.endConnection()
                            connect()
                        } else {
                            finish(InstallReferrerEvidence(store, outcome, responseCode = responseCode))
                        }
                    }

                    override fun onInstallReferrerServiceDisconnected() {
                        if (retries < maximumTransientRetries) {
                            retries += 1
                            connect()
                        } else {
                            finish(InstallReferrerEvidence(store, InstallReferrerOutcome.AVAILABLE))
                        }
                    }
                })
            } catch (_: SecurityException) {
                finish(InstallReferrerEvidence(store, InstallReferrerOutcome.PERMISSION_DENIED))
            } catch (_: Throwable) {
                finish(InstallReferrerEvidence(store, InstallReferrerOutcome.NOT_INSTALLED))
            }
        }

        timer.schedule(object : TimerTask() {
            override fun run() = finish(InstallReferrerEvidence(store, InstallReferrerOutcome.TIMEOUT))
        }, timeoutMs)
        connect()
    }
}

internal class InstallReferrerCoordinator(
    private val store: MeasurementStore,
    private val provider: InstallReferrerProvider,
) {
    suspend fun collectOnce() {
        val installation = store.snapshot()
        val key = "${provider.store.name.lowercase()}:${installation.installationId}"
        if (store.hasDedupe("install-referrer", key)) return
        val evidence = provider.collect()
        val blobId = evidence.rawReferrer?.let {
            store.putProtectedEvidence(
                blobId = "referrer_${installation.installationId}_${provider.store.name.lowercase()}",
                purpose = "install-referrer",
                consentRevision = 0,
                retentionClass = "installation",
                value = it.toByteArray(Charsets.UTF_8),
            )
        }
        val payload = JSONObject().apply {
            put("schemaVersion", 1)
            put("store", provider.store.name.lowercase())
            put("outcome", evidence.outcome.wireValue)
            put("clickTimestampSeconds", evidence.clickTimestampSeconds)
            put("installTimestampSeconds", evidence.installTimestampSeconds)
            put("clickServerTimestampSeconds", evidence.clickServerTimestampSeconds)
            put("installServerTimestampSeconds", evidence.installServerTimestampSeconds)
            put("instantExperience", evidence.instantExperience)
            put("installVersion", evidence.installVersion)
            put("responseCode", evidence.responseCode)
            put("libraryVersion", evidence.libraryVersion)
            put("verificationState", evidence.verificationState)
        }.toString()
        store.enqueue(
            recordId = "install_referrer_${installation.installationId}_${provider.store.name.lowercase()}",
            recordType = "android.install_referrer.v1",
            occurredAt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
                timeZone = TimeZone.getTimeZone("UTC")
            }.format(Date()),
            priority = "critical",
            source = "native",
            publicPayload = payload,
            protectedPayloadRef = blobId,
        )
        store.checkAndSetDedupe("install-referrer", key, Long.MAX_VALUE)
    }
}
