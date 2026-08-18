package com.margelo.nitro.voidhash.measurement

import android.util.Base64
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import kotlin.math.min
import org.json.JSONArray
import org.json.JSONObject

internal data class MeasurementDeliveryResult(
    val accepted: Int,
    val scheduled: Int,
    val quarantined: Int,
    val policyBlocked: Int,
)

internal data class MeasurementHttpResult(val status: Int, val body: String, val retryAfterMs: Long?)

internal fun interface MeasurementHttpTransport {
    fun send(path: String, body: ByteArray): MeasurementHttpResult
}

private class UrlConnectionMeasurementHttpTransport(private val ingestOrigin: String) : MeasurementHttpTransport {
    override fun send(path: String, body: ByteArray): MeasurementHttpResult {
        val connection = URL("${ingestOrigin.trimEnd('/')}$path").openConnection() as HttpURLConnection
        connection.requestMethod = "POST"
        connection.connectTimeout = 10_000
        connection.readTimeout = 15_000
        connection.doOutput = true
        connection.setRequestProperty("content-type", "application/json")
        connection.setRequestProperty("accept", "application/json")
        connection.setFixedLengthStreamingMode(body.size)
        connection.outputStream.use { it.write(body) }
        val status = connection.responseCode
        val stream = if (status >= 400) connection.errorStream else connection.inputStream
        val responseBody = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
        val retryAfter = connection.getHeaderField("retry-after")?.toLongOrNull()?.times(1_000)
        connection.disconnect()
        return MeasurementHttpResult(status, responseBody, retryAfter)
    }
}

internal class MeasurementDelivery(
    private val store: MeasurementStore,
    private val publishableKey: String,
    ingestOrigin: String,
    private val transport: MeasurementHttpTransport = UrlConnectionMeasurementHttpTransport(ingestOrigin),
) {
    fun flush(): MeasurementDeliveryResult {
        val records = store.peekEligible(100)
        if (records.isEmpty()) return MeasurementDeliveryResult(0, 0, 0, 0)
        val deletionRecords = records.filter { it.recordType == "measurement.deletion_requested.v1" }
        val deletionResult = deletionRecords.fold(MeasurementDeliveryResult(0, 0, 0, 0)) { result, record ->
            combine(result, deliverDeletion(record))
        }
        val protected = prepareProtectedEvidence(records.filterNot { it.recordType == "measurement.deletion_requested.v1" })
        return combine(deletionResult, combine(protected.result, deliver(protected.ready)))
    }

    private fun deliverDeletion(record: StoredOutboxRecord): MeasurementDeliveryResult {
        val response = try {
            sendDeletion(record)
        } catch (_: Exception) {
            schedule(listOf(record), null)
            return MeasurementDeliveryResult(0, 1, 0, 0)
        }
        if (response.status == 429 || response.status >= 500) {
            schedule(listOf(record), response.retryAfterMs)
            return MeasurementDeliveryResult(0, 1, 0, 0)
        }
        if (response.status in 200..299) {
            store.acknowledge(record.recordId)
            return MeasurementDeliveryResult(1, 0, 0, 0)
        }
        store.reject(record.recordId, "deletion_http_${response.status}")
        return MeasurementDeliveryResult(0, 0, 1, 0)
    }

    private fun prepareProtectedEvidence(records: List<StoredOutboxRecord>): ProtectedPreparation {
        val ready = mutableListOf<StoredOutboxRecord>()
        var scheduled = 0
        var quarantined = 0
        val outcomes = mutableMapOf<String, ProtectedOutcome>()
        for (record in records) {
            val reference = record.protectedPayloadRef
            if (reference == null) {
                ready += record
                continue
            }
            val outcome = outcomes.getOrPut(reference) { uploadProtectedEvidence(reference) }
            when (outcome) {
                ProtectedOutcome.ACCEPTED -> ready += record
                ProtectedOutcome.RETRY -> {
                    store.scheduleRetry(record.recordId, System.currentTimeMillis() + 1_000)
                    scheduled += 1
                }
                ProtectedOutcome.REJECTED -> {
                    store.reject(record.recordId, "protected_evidence_rejected")
                    quarantined += 1
                }
            }
        }
        return ProtectedPreparation(
            ready,
            MeasurementDeliveryResult(0, scheduled, quarantined, 0),
        )
    }

    private fun uploadProtectedEvidence(blobId: String): ProtectedOutcome {
        val evidence = store.getProtectedUpload(blobId) ?: return ProtectedOutcome.REJECTED
        if (evidence.uploadState == "acknowledged") return ProtectedOutcome.ACCEPTED
        if (evidence.uploadState != "pending" || evidence.deletionState != "active" || evidence.ciphertext == null) {
            return ProtectedOutcome.REJECTED
        }
        val now = System.currentTimeMillis()
        if (evidence.eligibleAtMs > now) return ProtectedOutcome.RETRY
        val response = try {
            sendProtected(evidence)
        } catch (_: Exception) {
            scheduleProtected(evidence, null)
            return ProtectedOutcome.RETRY
        }
        if (response.status in 200..299) {
            store.acknowledgeProtectedUpload(blobId)
            return ProtectedOutcome.ACCEPTED
        }
        if (response.status == 429 || response.status >= 500) {
            scheduleProtected(evidence, response.retryAfterMs)
            return ProtectedOutcome.RETRY
        }
        store.rejectProtectedUpload(blobId)
        return ProtectedOutcome.REJECTED
    }

    private fun deliver(records: List<StoredOutboxRecord>): MeasurementDeliveryResult {
        if (records.isEmpty()) return MeasurementDeliveryResult(0, 0, 0, 0)
        val response = try {
            send(records)
        } catch (_: Exception) {
            schedule(records, null)
            return MeasurementDeliveryResult(0, records.size, 0, 0)
        }
        if (response.status == 413) {
            if (records.size == 1) {
                store.quarantine(records.first().recordId, "payload_too_large")
                return MeasurementDeliveryResult(0, 0, 1, 0)
            }
            val middle = records.size / 2
            return combine(deliver(records.subList(0, middle)), deliver(records.subList(middle, records.size)))
        }
        if (response.status == 429 || response.status >= 500) {
            schedule(records, response.retryAfterMs)
            return MeasurementDeliveryResult(0, records.size, 0, 0)
        }
        if (response.status !in 200..299) {
            records.forEach { store.reject(it.recordId, "http_${response.status}") }
            return MeasurementDeliveryResult(0, 0, records.size, 0)
        }

        val payload = try {
            JSONObject(response.body)
        } catch (_: Exception) {
            schedule(records, null)
            return MeasurementDeliveryResult(0, records.size, 0, 0)
        }
        val accepted = payload.optJSONArray("accepted") ?: JSONArray()
        var acceptedCount = 0
        for (index in 0 until accepted.length()) {
            if (store.acknowledge(accepted.getString(index))) acceptedCount += 1
        }
        val rejected = payload.optJSONArray("rejected") ?: JSONArray()
        var quarantined = 0
        for (index in 0 until rejected.length()) {
            val item = rejected.getJSONObject(index)
            if (store.reject(item.getString("recordId"), item.getString("reason"))) quarantined += 1
        }
        val acknowledged = buildSet {
            for (index in 0 until accepted.length()) add(accepted.getString(index))
            for (index in 0 until rejected.length()) add(rejected.getJSONObject(index).getString("recordId"))
        }
        val missing = records.filterNot { it.recordId in acknowledged }
        schedule(missing, null)
        return MeasurementDeliveryResult(acceptedCount, missing.size, quarantined, 0)
    }

    private fun send(records: List<StoredOutboxRecord>): MeasurementHttpResult {
        val body = JSONObject().apply {
            put("token", publishableKey)
            put("sent_at", isoNow())
            put("events", JSONArray(records.map(::captureEvent)))
        }.toString().toByteArray(Charsets.UTF_8)
        return transport.send("/i/v1/batch", body)
    }

    private fun sendProtected(evidence: StoredProtectedUpload): MeasurementHttpResult {
        val body = JSONObject().apply {
            put("blobId", evidence.blobId)
            put("ciphertext", Base64.encodeToString(evidence.ciphertext, Base64.NO_WRAP))
            put("consentRevision", evidence.consentRevision)
            put("deletionState", evidence.deletionState)
            put("encryptionKeyVersion", evidence.encryptionKeyVersion)
            put("installationId", store.snapshot().installationId)
            put("purpose", evidence.purpose)
            put("retentionClass", evidence.retentionClass)
            put("token", publishableKey)
        }.toString().toByteArray(Charsets.UTF_8)
        return transport.send("/i/v1/measurement/protected", body)
    }

    private fun sendDeletion(record: StoredOutboxRecord): MeasurementHttpResult {
        val envelope = JSONObject(record.publicPayload)
        val payload = envelope.optJSONObject("publicPayload") ?: JSONObject()
        val identity = envelope.optJSONObject("identity") ?: JSONObject()
        val body = JSONObject().apply {
            put("installationId", envelope.getString("installationId"))
            identity.optString("personId").takeIf { it.isNotBlank() }?.let { put("personId", it) }
            put("requestId", payload.optString("requestId", record.recordId))
            put("requestedAt", envelope.optString("occurredAt", isoNow()))
            put("token", publishableKey)
        }.toString().toByteArray(Charsets.UTF_8)
        return transport.send("/i/v1/measurement/delete", body)
    }

    private fun captureEvent(record: StoredOutboxRecord): JSONObject {
        val envelope = JSONObject(record.publicPayload)
        val identity = envelope.optJSONObject("identity") ?: JSONObject()
        val consent = envelope.optJSONObject("consent") ?: JSONObject()
        val session = envelope.optJSONObject("session")
        return JSONObject().apply {
            put("uuid", record.recordId)
            put("event", record.recordType)
            put("timestamp", envelope.optString("occurredAt", isoNow()))
            put("distinct_id", identity.optString("distinctId", envelope.optString("installationId")))
            session?.optString("id")?.takeIf { it.isNotBlank() }?.let { put("session_id", it) }
            put("properties", envelope.optJSONObject("publicPayload") ?: JSONObject())
            put("context", JSONObject().apply {
                put("schemaVersion", 1)
                put("installation", JSONObject().apply {
                    put("id", envelope.optString("installationId"))
                    put("sequence", envelope.optLong("installationSequence", record.sequence))
                })
                put("identity", identity)
                put("consentRevision", consent.optLong("revision", 0))
                put("app", envelope.optJSONObject("app") ?: JSONObject())
                put("device", envelope.optJSONObject("device") ?: JSONObject())
                put("measurement", JSONObject().apply {
                    put("recordType", record.recordType)
                    put("source", envelope.optString("source"))
                })
            })
        }
    }

    private fun schedule(records: List<StoredOutboxRecord>, retryAfterMs: Long?) {
        val now = System.currentTimeMillis()
        for (record in records) {
            val exponential = min(3_600_000L, 1_000L shl min(record.attemptCount, 12))
            val stableJitter = 800L + (record.recordId.hashCode().toLong().and(0x7fffffff) % 401L)
            val computed = exponential * stableJitter / 1_000L
            store.scheduleRetry(record.recordId, now + maxOf(computed, retryAfterMs ?: 0L))
        }
    }

    private fun scheduleProtected(evidence: StoredProtectedUpload, retryAfterMs: Long?) {
        val exponential = min(3_600_000L, 1_000L shl min(evidence.attemptCount, 12))
        val stableJitter = 800L + (evidence.blobId.hashCode().toLong().and(0x7fffffff) % 401L)
        val computed = exponential * stableJitter / 1_000L
        store.scheduleProtectedUpload(
            evidence.blobId,
            System.currentTimeMillis() + maxOf(computed, retryAfterMs ?: 0L),
        )
    }

    private fun combine(left: MeasurementDeliveryResult, right: MeasurementDeliveryResult) =
        MeasurementDeliveryResult(
            left.accepted + right.accepted,
            left.scheduled + right.scheduled,
            left.quarantined + right.quarantined,
            left.policyBlocked + right.policyBlocked,
        )

    private fun isoNow(): String = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }.format(Date())

    private data class ProtectedPreparation(
        val ready: List<StoredOutboxRecord>,
        val result: MeasurementDeliveryResult,
    )
    private enum class ProtectedOutcome { ACCEPTED, RETRY, REJECTED }
}
