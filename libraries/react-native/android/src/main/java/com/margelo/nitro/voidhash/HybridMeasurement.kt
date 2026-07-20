package com.margelo.nitro.voidhash

import com.margelo.nitro.NitroModules
import com.margelo.nitro.core.Promise
import com.margelo.nitro.core.ArrayBuffer
import com.margelo.nitro.voidhash.measurement.MeasurementStore
import com.margelo.nitro.voidhash.measurement.MeasurementDelivery
import com.margelo.nitro.voidhash.measurement.GooglePlayInstallReferrerProvider
import com.margelo.nitro.voidhash.measurement.InstallReferrerCoordinator
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean
import java.nio.ByteBuffer
import org.json.JSONObject
import kotlin.coroutines.Continuation
import kotlin.coroutines.EmptyCoroutineContext
import kotlin.coroutines.startCoroutine

class HybridMeasurement : HybridMeasurementSpec() {
    private val listeners = ConcurrentHashMap<String, (MeasurementBridgeEvent) -> Unit>()
    private var readiness = "uninitialized"
    private var consentRevision = 0.0
    private var configurationRevision = 0.0
    private var publishableKey: String? = null
    private var ingestOrigin: String? = null
    private val installReferrerStarted = AtomicBoolean(false)
    private var appliedConfigurationVersion = 0L

    private val store: MeasurementStore by lazy {
        val context = NitroModules.applicationContext
            ?: throw IllegalStateException("NITRO_CONTEXT_UNAVAILABLE")
        MeasurementStore(context)
    }

    private fun snapshot(): MeasurementStateBridge {
        val state = store.snapshot()
        return MeasurementStateBridge(
            installationId = state.installationId,
            firstOpenedAt = state.firstOpenedAt,
            installationSequence = state.sequence.toDouble(),
            readiness = readiness,
            currentSessionId = null,
            currentSessionSequence = null,
            consentRevision = consentRevision,
            configurationRevision = configurationRevision,
            outboxCritical = (state.counts["critical"] ?: 0).toDouble(),
            outboxHigh = (state.counts["high"] ?: 0).toDouble(),
            outboxNormal = (state.counts["normal"] ?: 0).toDouble(),
            outboxLow = (state.counts["low"] ?: 0).toDouble(),
            oldestRecordAgeMs = state.oldestQueuedAtMs?.let { (System.currentTimeMillis() - it).coerceAtLeast(0).toDouble() },
        )
    }

    override fun initialize(publishableKey: String, configuration: MeasurementInitializeConfiguration): Promise<MeasurementStateBridge> = Promise.async {
        require(publishableKey.isNotBlank()) { "INVALID_PUBLISHABLE_KEY" }
        store.snapshot()
        this.publishableKey = publishableKey
        ingestOrigin = configuration.ingestUrl
        configurationRevision += 1
        readiness = "sdkReady"
        if (installReferrerStarted.compareAndSet(false, true)) {
            val context = NitroModules.applicationContext
                ?: throw IllegalStateException("NITRO_CONTEXT_UNAVAILABLE")
            suspend {
                InstallReferrerCoordinator(
                    store,
                    GooglePlayInstallReferrerProvider(context),
                ).collectOnce()
            }.startCoroutine(object : Continuation<Unit> {
                override val context = EmptyCoroutineContext
                override fun resumeWith(result: Result<Unit>) = Unit
            })
        }
        snapshot()
    }

    override fun enqueue(command: MeasurementCommand): Promise<MeasurementCommandResult> = Promise.async {
        val buffer = command.publicPayload.getBuffer(true)
        buffer.rewind()
        val publicPayload = ByteArray(buffer.remaining())
        buffer.get(publicPayload)
        val sequence = store.enqueue(
            recordId = command.commandId,
            recordType = command.recordType,
            occurredAt = command.occurredAt,
            priority = command.priority.name,
            source = command.source.name,
            publicPayload = publicPayload.toString(Charsets.UTF_8),
            protectedPayloadRef = command.protectedEvidenceRef,
        )
        command.consent?.let { consentRevision = it.revision }
        MeasurementCommandResult(true, command.commandId, sequence.toDouble(), null)
    }

    override fun flush(): Promise<MeasurementFlushBridgeResult> = Promise.async {
        val key = publishableKey
        val origin = ingestOrigin
        if (key == null || origin.isNullOrBlank()) {
            val scheduled = store.peekEligible(Int.MAX_VALUE).size
            MeasurementFlushBridgeResult(0.0, scheduled.toDouble(), 0.0, 0.0)
        } else {
            val result = MeasurementDelivery(store, key, origin).flush()
            MeasurementFlushBridgeResult(
                result.accepted.toDouble(),
                result.scheduled.toDouble(),
                result.quarantined.toDouble(),
                result.policyBlocked.toDouble(),
            )
        }
    }

    override fun getInstallationId(): Promise<String> = Promise.async {
        store.snapshot().installationId
    }

    override fun getState(): Promise<MeasurementStateBridge> = Promise.async { snapshot() }

    override fun subscribe(subscriptionId: String, listener: (MeasurementBridgeEvent) -> Unit) {
        listeners[subscriptionId] = listener
    }

    override fun unsubscribe(subscriptionId: String) {
        listeners.remove(subscriptionId)
    }

    override fun peekInbox(limit: Double): Promise<Array<MeasurementInboxEntry>> =
        Promise.async {
            store.peekInbox(limit.toInt()).map {
                MeasurementInboxEntry(it.id, it.kind, it.source, it.appState, it.receivedAt, it.protectedPayloadRef)
            }.toTypedArray()
        }

    override fun acknowledgeInbox(entryId: String): Promise<Boolean> = Promise.async {
        store.acknowledgeInbox(entryId)
    }

    override fun readProtectedEvidence(blobId: String): Promise<ArrayBuffer> = Promise.async {
        val evidence = store.getProtectedEvidence(blobId)
            ?: throw IllegalStateException("PROTECTED_EVIDENCE_NOT_FOUND")
        ArrayBuffer.copy(ByteBuffer.wrap(evidence.value))
    }

    override fun putProtectedEvidence(input: MeasurementProtectedEvidenceInput): Promise<String> = Promise.async {
        val buffer = input.value.getBuffer(true)
        buffer.rewind()
        val value = ByteArray(buffer.remaining())
        buffer.get(value)
        store.putProtectedEvidence(
            blobId = input.blobId,
            purpose = input.purpose.name.lowercase().replace('_', '-'),
            consentRevision = input.consentRevision.toLong(),
            retentionClass = input.retentionClass.name.lowercase().replace('_', '-'),
            value = value,
        )
    }

    override fun deleteProtectedEvidence(blobId: String): Promise<Boolean> = Promise.async {
        store.deleteProtectedEvidence(blobId)
    }

    override fun deleteProtectedData(requestId: String): Promise<Boolean> = Promise.async {
        store.deleteProtectedData(requestId)
    }

    override fun getMeasurementConfigurationState(): Promise<MeasurementConfigurationStateBridge> = Promise.async {
        val state = store.measurementConfigurationState()
        MeasurementConfigurationStateBridge(
            state.version.toDouble(),
            state.payload?.let { ArrayBuffer.copy(ByteBuffer.wrap(it)) },
        )
    }

    override fun persistMeasurementConfigurationState(version: Double, payload: ArrayBuffer): Promise<Boolean> = Promise.async {
        val buffer = payload.getBuffer(true)
        buffer.rewind()
        val bytes = ByteArray(buffer.remaining())
        buffer.get(bytes)
        store.persistMeasurementConfiguration(version.toLong(), bytes)
    }

    override fun applyMeasurementConfiguration(version: Double, payload: ArrayBuffer): Promise<Unit> = Promise.async {
        require(version.toLong() > appliedConfigurationVersion) { "MEASUREMENT_CONFIGURATION_VERSION_REPLAY" }
        val buffer = payload.getBuffer(true)
        buffer.rewind()
        val bytes = ByteArray(buffer.remaining())
        buffer.get(bytes)
        val decoded = JSONObject(bytes.toString(Charsets.UTF_8))
        require(decoded.optInt("schemaVersion") == 1) { "MEASUREMENT_CONFIGURATION_INVALID" }
        appliedConfigurationVersion = version.toLong()
    }

    override fun applyMeasurementStorageLimits(
        maxOutboxRecords: Double,
        maxOutboxBytes: Double,
        maxProtectedBytes: Double,
    ): Promise<Unit> = Promise.async {
        store.applyStorageLimits(
            maxOutboxRecords.toInt(),
            maxOutboxBytes.toLong(),
            maxProtectedBytes.toLong(),
        )
    }

    override fun getPushRegistrationState(): Promise<MeasurementConfigurationStateBridge> = Promise.async {
        val state = store.pushRegistrationState()
        MeasurementConfigurationStateBridge(
            state.version.toDouble(),
            state.payload?.let { ArrayBuffer.copy(ByteBuffer.wrap(it)) },
        )
    }

    override fun persistPushRegistrationState(payload: ArrayBuffer): Promise<Boolean> = Promise.async {
        val buffer = payload.getBuffer(true)
        buffer.rewind()
        val bytes = ByteArray(buffer.remaining())
        buffer.get(bytes)
        store.persistPushRegistration(bytes)
    }

    override fun clearPushRegistrationState(): Promise<Boolean> = Promise.async {
        store.clearPushRegistration()
    }

    override fun getTestDeviceState(): Promise<Boolean> = Promise.async { store.testDeviceState() }

    override fun persistTestDeviceState(enabled: Boolean): Promise<Boolean> = Promise.async {
        store.persistTestDeviceState(enabled)
    }

    override fun checkAndSetDedupe(namespace: String, key: String, expiresAtMs: Double): Promise<Boolean> = Promise.async {
        store.checkAndSetDedupe(namespace, key, expiresAtMs.toLong())
    }

    override fun hasDedupe(namespace: String, key: String): Promise<Boolean> = Promise.async {
        store.hasDedupe(namespace, key)
    }
}
