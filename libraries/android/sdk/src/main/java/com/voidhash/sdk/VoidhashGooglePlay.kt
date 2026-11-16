package com.voidhash.sdk

import android.app.Activity
import com.voidhash.sdk.billing.VoidhashTransaction
import java.net.URLEncoder

/**
 * What only Google Play offers, reached as [VoidhashClient.googlePlay]. Its results carry Play
 * Billing's own types and names, so the Play Billing Library version is part of this API.
 */
class VoidhashGooglePlay internal constructor(private val client: VoidhashClient) {
    /**
     * Shows Google Play's transactional messages above [activity], such as a prompt to fix a
     * subscription's declined payment, and waits until the user is done with them. When the user
     * fixed a subscription, the SDK syncs the store's purchases and refreshes the person before
     * returning. Call it where the app starts, and where a user would notice lost access.
     */
    suspend fun showInAppMessages(activity: Activity): GooglePlayInAppMessageResult =
        client.showGooglePlayInAppMessages(activity)

    /**
     * The purchases the signed-in Google Play account owns, as Play lists them now. With
     * [includeSuspended], subscriptions Play paused or put on hold after a declined renewal are
     * listed too, with [com.voidhash.sdk.billing.GooglePlayTransactionInfo.isSuspended] set: such a
     * subscription grants no access, and the SDK never delivers, acknowledges or consumes it.
     * Reading the purchases changes nothing; access always comes from the person.
     */
    suspend fun queryPurchases(includeSuspended: Boolean = true): List<VoidhashTransaction> =
        client.queryGooglePlayPurchases(includeSuspended)

    /**
     * Whether the Play Store on this device supports [feature], one of
     * `com.android.billingclient.api.BillingClient.FeatureType`.
     */
    suspend fun isFeatureSupported(feature: String): Boolean = client.isGooglePlayFeatureSupported(feature)
}

/** What [VoidhashGooglePlay.showInAppMessages] ended with. */
sealed class GooglePlayInAppMessageResult {
    /** Nothing was shown, or the user dismissed it without changing anything. */
    data object NoActionNeeded : GooglePlayInAppMessageResult()

    /** The user fixed the subscription of the purchase [purchaseToken], such as its payment method. */
    data class SubscriptionStatusUpdated(val purchaseToken: String) : GooglePlayInAppMessageResult()
}

/**
 * Where the store bills the user.
 *
 * @property countryCode ISO 3166-1 alpha-2, such as `US`.
 * @property currencyCode ISO 4217, when the store names it; Google Play does not.
 */
data class VoidhashStorefront(
    val countryCode: String,
    val currencyCode: String?,
)

/**
 * Google Play's subscription management page: for the Play subscription [storeProductId] of the
 * app [packageName], or the list of the user's subscriptions without one.
 */
internal fun manageSubscriptionsUrl(packageName: String, storeProductId: String?): String {
    val packageParameter = "package=${encode(packageName)}"
    return if (storeProductId == null) {
        "https://play.google.com/store/account/subscriptions?$packageParameter"
    } else {
        "https://play.google.com/store/account/subscriptions?sku=${encode(storeProductId)}&$packageParameter"
    }
}

/** Google Play's page for redeeming a promo code, with [code] filled in when given. */
internal fun codeRedemptionUrl(code: String?): String =
    if (code.isNullOrBlank()) "https://play.google.com/redeem" else "https://play.google.com/redeem?code=${encode(code)}"

private fun encode(value: String): String = URLEncoder.encode(value, "UTF-8")
