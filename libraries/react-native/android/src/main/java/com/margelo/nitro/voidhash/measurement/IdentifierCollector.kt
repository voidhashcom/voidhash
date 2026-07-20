package com.margelo.nitro.voidhash.measurement

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID
import org.json.JSONObject

internal enum class IdentifierKind(val wireValue: String) {
    ADVERTISING_ID("gaid"),
    APP_SET_ID("appSetId"),
    OAID("oaid"),
    AMAZON_AAID("aaid"),
    META_ATTRIBUTION_ID("metaAttributionId"),
}

internal data class IdentifierCollectionPolicy(
    val advertisingIdentifiers: Boolean,
    val vendorIdentifiers: Boolean,
    val collectionOptOut: Boolean,
)

internal data class IdentifierProviderResult(
    val value: String?,
    val limited: Boolean = false,
    val capability: InstallReferrerOutcome = InstallReferrerOutcome.COLLECTED,
)

internal fun interface IdentifierProvider {
    fun read(): IdentifierProviderResult
}

internal class AndroidIdentifierCollector(
    private val store: MeasurementStore,
    private val providers: Map<IdentifierKind, IdentifierProvider>,
) {
    fun collect(kind: IdentifierKind, policy: IdentifierCollectionPolicy): InstallReferrerOutcome {
        val allowed = !policy.collectionOptOut && when (kind) {
            IdentifierKind.APP_SET_ID -> policy.vendorIdentifiers
            else -> policy.advertisingIdentifiers
        }
        if (!allowed) {
            record(kind, "permissionDenied", null, false)
            return InstallReferrerOutcome.PERMISSION_DENIED
        }
        val provider = providers[kind]
        if (provider == null) {
            record(kind, "notInstalled", null, false)
            return InstallReferrerOutcome.NOT_INSTALLED
        }
        val result = try {
            provider.read()
        } catch (_: SecurityException) {
            IdentifierProviderResult(null, capability = InstallReferrerOutcome.PERMISSION_DENIED)
        } catch (_: Throwable) {
            IdentifierProviderResult(null, capability = InstallReferrerOutcome.UNSUPPORTED)
        }
        val reference = result.value?.takeIf { it.isNotBlank() && !result.limited }?.let { value ->
            store.putProtectedEvidence(
                purpose = "advertising-identifier",
                consentRevision = 0,
                retentionClass = "installation",
                value = value.toByteArray(Charsets.UTF_8),
            )
        }
        record(kind, result.capability.wireValue, reference, result.limited)
        return result.capability
    }

    private fun record(kind: IdentifierKind, outcome: String, reference: String?, limited: Boolean) {
        val installation = store.snapshot()
        val occurredAt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }.format(Date())
        val payload = JSONObject().apply {
            put("kind", kind.wireValue)
            put("outcome", outcome)
            put("limited", limited)
            put("policyBasis", if (outcome == "permissionDenied") "denied" else "configured")
        }.toString()
        store.enqueue(
            recordId = "identifier_${installation.installationId}_${kind.wireValue}_${UUID.randomUUID()}",
            recordType = "identifier.observed.v1",
            occurredAt = occurredAt,
            priority = "high",
            source = "native",
            publicPayload = payload,
            protectedPayloadRef = reference,
        )
    }
}
