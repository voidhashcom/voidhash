package com.voidhash.sdk.api

import com.voidhash.sdk.billing.VoidhashEnvironment
import com.voidhash.sdk.billing.VoidhashStore
import org.json.JSONArray
import org.json.JSONObject

/**
 * One entitlement grant carried by a person snapshot.
 *
 * @property perkId the perk's internal id.
 * @property perkSlug the perk's slug as configured in Studio; `null` in snapshots from
 *   servers or caches that predate it.
 */
data class EntitlementGrant(
    val perkId: String,
    val source: String,
    val sourceId: String?,
    val sourcePersonId: String,
    val status: String,
    val expiresAt: String?,
    val perkSlug: String? = null,
) {
    /** True while the grant still entitles the person to the perk. */
    val isActive: Boolean get() = status == "active"
}

/** What state a [VoidhashSubscription] is in, as Voidhash derives it from the store's reports. */
enum class VoidhashSubscriptionStatus(internal val wireName: String) {
    ACTIVE("active"),
    TRIALING("trialing"),

    /** The renewal payment failed and the store keeps access while it retries. */
    IN_GRACE_PERIOD("in_grace_period"),

    /** The renewal payment failed and the store retries it, without access. */
    IN_BILLING_RETRY("in_billing_retry"),

    /** Google Play's account hold after a failed renewal, without access. */
    ON_HOLD("on_hold"),

    /** Paused by the user on Google Play until [VoidhashSubscription.resumesAt]. */
    PAUSED("paused"),
    EXPIRED("expired"),

    /** The store took access back, as for a refund that revoked it. */
    REVOKED("revoked"),

    /** A status this SDK version does not know yet. */
    UNKNOWN(""),
}

/** Which part of a subscription the person is in. */
enum class VoidhashPeriodType(internal val wireName: String) {
    TRIAL("trial"),
    INTRO("intro"),
    REGULAR("regular"),
    UNKNOWN(""),
}

/** Whether the person agreed to a coming price increase. */
enum class VoidhashPriceConsent(internal val wireName: String) {
    PENDING("pending"),
    ACCEPTED("accepted"),
    UNKNOWN(""),
}

/**
 * A price change the store announced for a subscription.
 *
 * @property amountMicros the new price times 1,000,000.
 * @property effectiveAt when it applies, as an ISO 8601 timestamp; `null` when the store did not say.
 * @property consent `null` when the store does not ask for consent.
 */
data class VoidhashPendingPrice(
    val amountMicros: Long,
    val currency: String,
    val effectiveAt: String?,
    val consent: VoidhashPriceConsent?,
)

/**
 * A subscription the person has that has not ended: it may be in a grace period, billing retry,
 * on hold or paused. What a subscription management screen lists — access always comes from the
 * person's entitlements, never from this.
 *
 * Timestamps are ISO 8601 strings, as Voidhash sends them.
 *
 * @property subscriptionId the subscription's Voidhash id; empty when a server leaves it out, as on iOS.
 * @property productId the subscription's Voidhash product, as [com.voidhash.sdk.billing.VoidhashProduct.productId].
 * @property willRenew whether it renews at [expiresAt].
 * @property canceledAt when auto-renewal was turned off or the subscription was canceled.
 * @property renewsToProductSlug the product it changes to at renewal, as a deferred downgrade does.
 * @property offerId the store offer the current period applies.
 */
data class VoidhashSubscription(
    val subscriptionId: String,
    val productId: String?,
    val productSlug: String?,
    val store: VoidhashStore,
    val environment: VoidhashEnvironment,
    val status: VoidhashSubscriptionStatus,
    val periodType: VoidhashPeriodType,
    val startsAt: String?,
    val expiresAt: String?,
    val willRenew: Boolean,
    val canceledAt: String?,
    val renewsToProductSlug: String?,
    val gracePeriodExpiresAt: String?,
    val billingIssueDetectedAt: String?,
    val resumesAt: String?,
    val pendingPrice: VoidhashPendingPrice?,
    val offerId: String?,
    val isFamilyShared: Boolean,
    val refundedAt: String?,
    val revokedAt: String?,
)

/** One subscription the person owns or shares, ended or not. */
data class VoidhashSubscriptionHistoryEntry(
    val subscriptionId: String,
    val productId: String?,
    val productSlug: String?,
    val store: VoidhashStore,
    val status: VoidhashSubscriptionStatus,
    val isTrial: Boolean,
    val startsAt: String,
    val expiresAt: String?,
    val canceledAt: String?,
    val refundedAt: String?,
    val sourcePersonId: String,
)

/** What a purchase was for. */
enum class VoidhashPurchaseType(internal val wireName: String) {
    ONE_TIME("one_time"),
    CONSUMABLE("consumable"),
    SUBSCRIPTION("subscription"),
    UNKNOWN(""),
}

/**
 * One store transaction the person owns or shares.
 *
 * @property providerKey the store's id for the transaction.
 */
data class VoidhashPurchaseHistoryEntry(
    val purchaseId: String,
    val productId: String?,
    val productSlug: String?,
    val providerKey: String,
    val type: VoidhashPurchaseType,
    val createdAt: String,
    val refundedAt: String?,
    val revokedAt: String?,
    val sourcePersonId: String,
)

/**
 * The person's subscriptions.
 *
 * @property current the one that matters most now among [all]: active, then trialing, in grace
 *   period, in billing retry, on hold, paused; `null` without one.
 * @property all every subscription that has not ended. Access comes from entitlements, never from this.
 * @property history every subscription the person owns or shares.
 */
data class VoidhashSubscriptions(
    val current: VoidhashSubscription?,
    val all: List<VoidhashSubscription>,
    val history: List<VoidhashSubscriptionHistoryEntry>,
)

/** The person's purchases. */
data class VoidhashPurchases(
    val history: List<VoidhashPurchaseHistoryEntry>,
)

/**
 * Snapshot of the current person as returned by `/api/v1/sdk/person`.
 *
 * @property subscriptions the person's subscriptions: the current one, every one that has not
 *   ended, and their history. Access comes from [entitlementGrants], never from these.
 * @property purchases the person's purchase history.
 */
data class VoidhashPerson(
    val distinctId: String,
    val personId: String,
    val email: String?,
    val name: String?,
    val entitlementGrants: List<EntitlementGrant>,
    val subscriptions: VoidhashSubscriptions,
    val purchases: VoidhashPurchases,
    val raw: JSONObject,
) {
    /** Internal ids of the perks the person is currently entitled to. */
    val activePerkIds: List<String>
        get() = entitlementGrants.filter { it.isActive }.map { it.perkId }

    /** Studio slugs of the perks the person is currently entitled to. */
    val activePerkSlugs: List<String>
        get() = entitlementGrants.filter { it.isActive }.mapNotNull { it.perkSlug }

    /**
     * Whether the person holds an active grant for the perk with Studio slug [slug]. A grant
     * cached before slugs were reported is matched by its perk id instead.
     */
    fun hasActivePerk(slug: String): Boolean =
        entitlementGrants.any { it.isActive && (it.perkSlug == slug || it.perkId == slug) }

    companion object {
        internal fun fromJson(json: JSONObject): VoidhashPerson {
            val grants = json.optJSONObject("entitlements")?.optJSONArray("grants")
            val subscriptions = json.optJSONObject("subscriptions")
            val purchases = json.optJSONObject("purchases")

            return VoidhashPerson(
                distinctId = json.optString("distinctId"),
                personId = json.optString("personId"),
                email = json.optStringOrNull("email"),
                name = json.optStringOrNull("name"),
                entitlementGrants = grants.objects().map { grant ->
                    EntitlementGrant(
                        perkId = grant.optString("perkId"),
                        source = grant.optString("source"),
                        sourceId = grant.optStringOrNull("sourceId"),
                        sourcePersonId = grant.optString("sourcePersonId"),
                        status = grant.optString("status"),
                        expiresAt = grant.optStringOrNull("expiresAt"),
                        perkSlug = grant.optStringOrNull("perkSlug"),
                    )
                },
                subscriptions = VoidhashSubscriptions(
                    current = subscriptions?.optJSONObjectOrNull("current")?.let(::subscriptionOf),
                    all = subscriptions?.optJSONArray("all").objects().map(::subscriptionOf),
                    history = subscriptions?.optJSONArray("history").objects().map { entry ->
                        VoidhashSubscriptionHistoryEntry(
                            subscriptionId = entry.optString("subscriptionId"),
                            productId = entry.optStringOrNull("productId"),
                            productSlug = entry.optStringOrNull("productSlug"),
                            store = storeOf(entry.optStringOrNull("store")),
                            status = enumOf(entry.optStringOrNull("status"), VoidhashSubscriptionStatus.UNKNOWN) { it.wireName },
                            isTrial = entry.optBoolean("isTrial"),
                            startsAt = entry.optString("startsAt"),
                            expiresAt = entry.optStringOrNull("expiresAt"),
                            canceledAt = entry.optStringOrNull("canceledAt"),
                            refundedAt = entry.optStringOrNull("refundedAt"),
                            sourcePersonId = entry.optString("sourcePersonId"),
                        )
                    },
                ),
                purchases = VoidhashPurchases(
                    history = purchases?.optJSONArray("history").objects().map { entry ->
                        VoidhashPurchaseHistoryEntry(
                            purchaseId = entry.optString("purchaseId"),
                            productId = entry.optStringOrNull("productId"),
                            productSlug = entry.optStringOrNull("productSlug"),
                            providerKey = entry.optString("providerKey"),
                            type = enumOf(entry.optStringOrNull("type"), VoidhashPurchaseType.UNKNOWN) { it.wireName },
                            createdAt = entry.optString("createdAt"),
                            refundedAt = entry.optStringOrNull("refundedAt"),
                            revokedAt = entry.optStringOrNull("revokedAt"),
                            sourcePersonId = entry.optString("sourcePersonId"),
                        )
                    },
                ),
                raw = json,
            )
        }

        /** A subscription of `current` or `all`; a field a server leaves out reads as unknown or absent. */
        private fun subscriptionOf(json: JSONObject) = VoidhashSubscription(
            subscriptionId = json.optStringOrNull("subscriptionId").orEmpty(),
            productId = json.optStringOrNull("productId"),
            productSlug = json.optStringOrNull("productSlug"),
            store = storeOf(json.optStringOrNull("store")),
            environment = environmentOf(json.optStringOrNull("environment")),
            status = enumOf(json.optStringOrNull("status"), VoidhashSubscriptionStatus.UNKNOWN) { it.wireName },
            periodType = enumOf(json.optStringOrNull("periodType"), VoidhashPeriodType.UNKNOWN) { it.wireName },
            startsAt = json.optStringOrNull("startsAt"),
            expiresAt = json.optStringOrNull("expiresAt"),
            willRenew = json.optBoolean("willRenew"),
            canceledAt = json.optStringOrNull("canceledAt"),
            renewsToProductSlug = json.optStringOrNull("renewsToProductSlug"),
            gracePeriodExpiresAt = json.optStringOrNull("gracePeriodExpiresAt"),
            billingIssueDetectedAt = json.optStringOrNull("billingIssueDetectedAt"),
            resumesAt = json.optStringOrNull("resumesAt"),
            pendingPrice = json.optJSONObjectOrNull("pendingPrice")?.let { price ->
                VoidhashPendingPrice(
                    amountMicros = price.optLong("amountMicros"),
                    currency = price.optString("currency"),
                    effectiveAt = price.optStringOrNull("effectiveAt"),
                    consent = price.optStringOrNull("consent")?.let { consent ->
                        enumOf(consent, VoidhashPriceConsent.UNKNOWN) { it.wireName }
                    },
                )
            },
            offerId = json.optStringOrNull("offerId"),
            isFamilyShared = json.optBoolean("isFamilyShared"),
            refundedAt = json.optStringOrNull("refundedAt"),
            revokedAt = json.optStringOrNull("revokedAt"),
        )

        /** The SDK's name for a store Voidhash sends as `app_store`, `google_play`, `stripe` or `other`. */
        private fun storeOf(wire: String?): VoidhashStore = when (wire) {
            "app_store" -> VoidhashStore.APP_STORE
            "google_play" -> VoidhashStore.GOOGLE_PLAY
            "stripe" -> VoidhashStore.STRIPE
            "development" -> VoidhashStore.DEVELOPMENT
            "other" -> VoidhashStore.OTHER
            else -> VoidhashStore.UNKNOWN
        }

        /**
         * The SDK's name for an environment Voidhash sends as `production`, `sandbox` or `test`:
         * `test`, Voidhash's environment of simulated and test-mode purchases, is
         * [VoidhashEnvironment.DEVELOPMENT].
         */
        private fun environmentOf(wire: String?): VoidhashEnvironment = when (wire) {
            "production" -> VoidhashEnvironment.PRODUCTION
            "sandbox" -> VoidhashEnvironment.SANDBOX
            "test", "development" -> VoidhashEnvironment.DEVELOPMENT
            "xcode" -> VoidhashEnvironment.XCODE
            else -> VoidhashEnvironment.UNKNOWN
        }

        private inline fun <reified T : Enum<T>> enumOf(wire: String?, unknown: T, wireName: (T) -> String): T =
            enumValues<T>().firstOrNull { it != unknown && wireName(it) == wire } ?: unknown
    }
}

/** The objects of a JSON array, skipping entries that are not objects; none for a missing array. */
private fun JSONArray?.objects(): List<JSONObject> =
    if (this == null) emptyList() else (0 until length()).mapNotNull { optJSONObject(it) }

/**
 * One evaluated feature flag.
 *
 * @property payload the selected variant's payload, as the API returned it: a `JSONObject`,
 *   a `JSONArray`, a `String`, a `Number`, a `Boolean`, or `null` when the variant has none.
 *   Payloads are untyped, so validate one before relying on it.
 */
data class FeatureFlag(
    val key: String,
    val enabled: Boolean,
    val variantKey: String?,
    val payload: Any? = null,
)

/**
 * The compiled flow package of a paywall release, drawn by a native [com.voidhash.sdk.paywall.PaywallRenderer].
 *
 * @property url where the package bytes are downloaded from.
 * @property sha256 lowercase hex SHA-256 of the package bytes; a download that does not match
 *   is discarded.
 * @property abiVersion the package format version; a renderer draws only the versions it supports.
 * @property productIds the products the package references, sent to it with its configuration.
 * @property kind what the flow is for (`paywall` or `onboarding`).
 * @property shouldEndFlowOnPurchase whether a successful purchase or restore ends the flow; paywalls end,
 *   onboarding flows continue. Backends that predate flow kinds omit it, which means it does.
 */
data class FlowPackageReference(
    val url: String,
    val sha256: String,
    val abiVersion: Int,
    val productIds: List<String>,
    val kind: String = "paywall",
    val shouldEndFlowOnPurchase: Boolean = true,
    /**
     * The flow runtime module the release needs, for a renderer that runs the flow runtime as a
     * downloaded module; `null` from older backends and when none is offered.
     */
    val runtime: RuntimeModuleReference? = null,
) {
    companion object {
        internal fun fromJson(json: JSONObject): FlowPackageReference? {
            val url = json.optStringOrNull("url")?.takeIf(String::isNotEmpty) ?: return null
            val sha256 = json.optStringOrNull("sha256")?.lowercase()
                ?.takeIf { it.length == 64 && it.all { char -> char in '0'..'9' || char in 'a'..'f' } }
                ?: return null
            val abiVersion = json.opt("abiVersion") as? Number ?: return null
            val productIds = json.optJSONArray("productIds") ?: JSONArray()
            return FlowPackageReference(
                url = url,
                sha256 = sha256,
                abiVersion = abiVersion.toInt(),
                productIds = (0 until productIds.length()).mapNotNull { productIds.opt(it) as? String },
                kind = json.optStringOrNull("kind") ?: "paywall",
                shouldEndFlowOnPurchase = json.opt("shouldEndFlowOnPurchase") as? Boolean ?: true,
                runtime = json.optJSONObject("runtime")?.let(RuntimeModuleReference::fromJson),
            )
        }
    }
}

/**
 * A flow runtime module: what a renderer in module mode downloads, verifies by [sha256] and
 * caches to show a flow.
 *
 * @property version the runtime version, `major.minor.patch`.
 * @property sha256 lowercase hex SHA-256 of the module bytes.
 * @property url where the module is downloaded from.
 */
data class RuntimeModuleReference(val version: String, val sha256: String, val url: String) {
    companion object {
        internal fun fromJson(json: JSONObject): RuntimeModuleReference? {
            val version = json.optStringOrNull("version")?.takeIf(String::isNotEmpty) ?: return null
            val sha256 = json.optStringOrNull("sha256")?.lowercase()
                ?.takeIf { it.length == 64 && it.all { char -> char in '0'..'9' || char in 'a'..'f' } }
                ?: return null
            val url = json.optStringOrNull("url")?.takeIf(String::isNotEmpty) ?: return null
            return RuntimeModuleReference(version, sha256, url)
        }
    }
}

/**
 * The paywall release resolved for a location.
 *
 * @property paywallId the paywall the release belongs to; a flow's saved state is kept per
 *   paywall. `null` when the server did not name it.
 * @property flowPackage the release's flow package; `null` when the release has none.
 */
data class ResolvedPaywall(
    val locationSlug: String,
    val paywallId: String?,
    val releaseId: String,
    val version: Int?,
    val publishedAt: String?,
    val flowPackage: FlowPackageReference?,
    /** The showing that serves it, which a purchase from it names; `null` if the server sent none. */
    val showingId: String? = null,
) {
    companion object {
        internal fun fromJson(json: JSONObject): ResolvedPaywall? {
            val showing = json.optJSONObject("showing") ?: return null
            val release = showing.optJSONObjectOrNull("paywallRelease") ?: return null

            return ResolvedPaywall(
                locationSlug = json.optJSONObject("location")?.optString("slug").orEmpty(),
                paywallId = showing.optStringOrNull("paywallId")?.takeIf(String::isNotEmpty)
                    ?: showing.optJSONObjectOrNull("paywall")?.optStringOrNull("id")?.takeIf(String::isNotEmpty),
                releaseId = release.optString("releaseId"),
                version = (release.opt("version") as? Number)?.toInt(),
                publishedAt = release.optStringOrNull("publishedAt"),
                flowPackage = release.optJSONObjectOrNull("flowPackage")?.let(FlowPackageReference::fromJson),
                showingId = showing.optStringOrNull("id")?.takeIf(String::isNotEmpty),
            )
        }
    }
}

/** What the backend said about a synced store transaction. */
enum class TransactionSyncVerdict {
    /** Recorded. The receipt can be dropped. */
    ACCEPTED,

    /** The backend answered `accepted: false`. The receipt is kept and retried with backoff. */
    REJECTED,

    /** The answer did not say. The receipt is kept and retried; syncing is idempotent. */
    INDETERMINATE,
}

/**
 * [SyncTransactionRequest.intent] of a background submission: scans, renewals, purchases made
 * outside the app. It records the purchase for the person who already owns it.
 */
const val SYNC_TRANSACTION_INTENT_SYNC = "sync"

/**
 * [SyncTransactionRequest.intent] of a submission made by `restorePurchases()`, which resubmits
 * receipts already accepted for another user.
 */
const val SYNC_TRANSACTION_INTENT_RESTORE = "restore"

/**
 * [SyncTransactionRequest.intent] of a purchase the end user just made: one this SDK bought, or
 * one the host reported. It gives the purchase to the reporting person even when another person
 * owns it; the server treats it as a `sync` unless Google Play made the purchase in the last 24
 * hours. Sent at most once per purchase token from a device (see `AcceptedReceipt.purchaseClaimed`).
 */
const val SYNC_TRANSACTION_INTENT_PURCHASE = "purchase"

/**
 * The paywall a purchase was started from, sent with it so its revenue is credited to the
 * placement, paywall, release and experiment variant that sold it. The backend validates
 * [showingId] and derives the rest; the other fields are informational.
 */
data class PurchasePaywallContext(
    val showingId: String,
    val placement: String? = null,
    val paywallId: String? = null,
    val paywallReleaseId: String? = null,
) {
    internal fun toJson(): JSONObject = JSONObject()
        .put("showingId", showingId)
        .apply {
            placement?.let { put("placement", it) }
            paywallId?.let { put("paywallId", it) }
            paywallReleaseId?.let { put("paywallReleaseId", it) }
        }

    internal companion object {
        fun fromJson(json: JSONObject?): PurchasePaywallContext? {
            val showingId = json?.optStringOrNull("showingId")?.takeIf(String::isNotEmpty) ?: return null
            return PurchasePaywallContext(
                showingId = showingId,
                placement = json.optStringOrNull("placement"),
                paywallId = json.optStringOrNull("paywallId"),
                paywallReleaseId = json.optStringOrNull("paywallReleaseId"),
            )
        }
    }
}

/**
 * Payload of `POST /api/v1/sdk/sync-transaction` for Android transactions.
 *
 * @property intent [SYNC_TRANSACTION_INTENT_PURCHASE] for a purchase just made,
 *   [SYNC_TRANSACTION_INTENT_RESTORE] for an explicit restore, and [SYNC_TRANSACTION_INTENT_SYNC]
 *   otherwise. A `sync` records a receipt already bound to another person for its existing owner
 *   instead of moving it.
 * @property isStartedBySdk whether this SDK bought the purchase itself in owner mode, so the
 *   server may acknowledge it too in case the app stops first. Sent only when true, and kept
 *   with a receipt waiting in the outbox, which is sent the same way later.
 * @property paywallContext the paywall this SDK's purchase was started from; never sent with a
 *   restore. Kept with a receipt waiting in the outbox, like [isStartedBySdk].
 */
data class SyncTransactionRequest(
    val appAccountToken: String?,
    val providerProductId: String,
    val productSlug: String,
    val purchaseDate: Double,
    val purchaseToken: String,
    val quantity: Int,
    val receipt: String?,
    val transactionId: String,
    val intent: String = SYNC_TRANSACTION_INTENT_SYNC,
    val isStartedBySdk: Boolean = false,
    val paywallContext: PurchasePaywallContext? = null,
) {
    internal fun toJson(): JSONObject = JSONObject()
        .put("platform", "android")
        .put("purchaseToken", purchaseToken)
        .put("intent", intent)
        .apply { if (isStartedBySdk) put("isStartedBySdk", true) }
        .apply { paywallContext?.let { put("paywallContext", it.toJson()) } }

    internal fun toStorageJson(): JSONObject = toJson().apply {
        if (providerProductId.isNotEmpty()) {
            put("providerProductId", providerProductId)
            put("productSlug", productSlug)
            put("purchaseDate", purchaseDate)
            put("quantity", quantity)
            put("transactionId", transactionId)
        }
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
