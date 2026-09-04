package com.voidhash.sdk.api

import org.json.JSONArray
import org.json.JSONObject

/** One entitlement grant carried by a person snapshot. */
data class EntitlementGrant(
    val perkId: String,
    val source: String,
    val sourceId: String?,
    val sourcePersonId: String,
    val status: String,
    val expiresAt: String?,
) {
    /** True while the grant still entitles the person to the perk. */
    val isActive: Boolean get() = status == "active"
}

/** The person's current subscription, if any. */
data class CurrentSubscription(
    val subscriptionId: String?,
    val productId: String?,
    val status: String,
    val expiresAt: String?,
)

/** Snapshot of the current person as returned by `/api/v1/sdk/person`. */
data class VoidhashPerson(
    val distinctId: String,
    val personId: String,
    val email: String?,
    val name: String?,
    val entitlementGrants: List<EntitlementGrant>,
    val currentSubscription: CurrentSubscription?,
    val raw: JSONObject,
) {
    /** Perk ids the person is currently entitled to. */
    val activePerkIds: List<String>
        get() = entitlementGrants.filter { it.isActive }.map { it.perkId }

    companion object {
        internal fun fromJson(json: JSONObject): VoidhashPerson {
            val grants = json.optJSONObject("entitlements")?.optJSONArray("grants") ?: JSONArray()
            val current = json.optJSONObject("subscriptions")?.optJSONObjectOrNull("current")

            return VoidhashPerson(
                distinctId = json.optString("distinctId"),
                personId = json.optString("personId"),
                email = json.optStringOrNull("email"),
                name = json.optStringOrNull("name"),
                entitlementGrants = (0 until grants.length()).map { index ->
                    val grant = grants.getJSONObject(index)
                    EntitlementGrant(
                        perkId = grant.optString("perkId"),
                        source = grant.optString("source"),
                        sourceId = grant.optStringOrNull("sourceId"),
                        sourcePersonId = grant.optString("sourcePersonId"),
                        status = grant.optString("status"),
                        expiresAt = grant.optStringOrNull("expiresAt"),
                    )
                },
                currentSubscription = current?.let {
                    CurrentSubscription(
                        subscriptionId = it.optStringOrNull("subscriptionId"),
                        productId = it.optStringOrNull("productId"),
                        status = it.optString("status"),
                        expiresAt = it.optStringOrNull("expiresAt"),
                    )
                },
                raw = json,
            )
        }
    }
}

/** One evaluated feature flag. */
data class FeatureFlag(
    val key: String,
    val enabled: Boolean,
    val variantKey: String?,
)

/**
 * The paywall release resolved for a location.
 *
 * @property hasRuntime false for visual-editor releases, which do not accept
 * runtime configuration messages.
 */
data class ResolvedPaywall(
    val locationSlug: String,
    val htmlUrl: String,
    val releaseId: String,
    val productSlugs: List<String>,
    val variables: Map<String, Any?>,
    val hasRuntime: Boolean = true,
) {
    companion object {
        internal fun fromJson(json: JSONObject): ResolvedPaywall? {
            val release = json.optJSONObject("showing")?.optJSONObjectOrNull("paywallRelease")
                ?: return null
            val runtime = release.optJSONObjectOrNull("runtime")
            val productSlugs = runtime?.optJSONArray("productSlugs") ?: JSONArray()
            val variables = runtime?.optJSONObjectOrNull("variables")

            return ResolvedPaywall(
                locationSlug = json.optJSONObject("location")?.optString("slug").orEmpty(),
                htmlUrl = release.optString("htmlUrl"),
                releaseId = release.optString("releaseId"),
                productSlugs = (0 until productSlugs.length()).map { productSlugs.getString(it) },
                variables = variables?.let { source ->
                    source.keys().asSequence().associateWith { key ->
                        source.get(key).takeUnless { it === JSONObject.NULL }
                    }
                } ?: emptyMap(),
                hasRuntime = runtime != null,
            )
        }
    }
}

/** What the backend said about a synced store transaction. */
enum class TransactionSyncVerdict {
    /** Recorded. The receipt can be dropped. */
    ACCEPTED,

    /** Refused for a reason retrying will not change. The receipt is dropped with a diagnostic. */
    REJECTED,

    /** The answer did not say. The receipt is kept and retried; syncing is idempotent. */
    INDETERMINATE,
}

/** Payload of `POST /api/v1/sdk/sync-transaction` for Android transactions. */
data class SyncTransactionRequest(
    val appAccountToken: String?,
    val providerProductId: String,
    val productSlug: String,
    val purchaseDate: Double,
    val purchaseToken: String,
    val quantity: Int,
    val receipt: String?,
    val transactionId: String,
) {
    internal fun toJson(): JSONObject = JSONObject().apply {
        put("appAccountToken", appAccountToken ?: JSONObject.NULL)
        put("platform", "android")
        put("providerProductId", providerProductId)
        put("productSlug", productSlug)
        put("purchaseDate", purchaseDate)
        put("purchaseToken", purchaseToken)
        put("quantity", quantity)
        put("receipt", receipt ?: JSONObject.NULL)
        put("transactionId", transactionId)
    }
}

/** Payload of `POST /api/v1/sdk/development/purchase` for a simulated purchase. */
data class DevelopmentPurchaseRequest(
    val devTransactionId: String,
    val productSlug: String,
    val purchaseDate: Double,
    val quantity: Int,
) {
    internal fun toJson(): JSONObject = JSONObject().apply {
        put("devTransactionId", devTransactionId)
        put("productSlug", productSlug)
        put("purchaseDate", purchaseDate)
        put("quantity", quantity)
    }
}

internal fun JSONObject.optStringOrNull(key: String): String? {
    if (!has(key) || isNull(key)) return null
    return optString(key)
}

internal fun JSONObject.optJSONObjectOrNull(key: String): JSONObject? {
    if (!has(key) || isNull(key)) return null
    return optJSONObject(key)
}
