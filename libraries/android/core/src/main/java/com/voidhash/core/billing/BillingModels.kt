package com.voidhash.core.billing

import com.android.billingclient.api.ProductDetails

/** Google Play product type, mirroring `BillingClient.ProductType`. */
enum class BillingProductType {
    INAPP,
    SUBS,
}

/**
 * One pricing phase of a subscription offer, as Play reports it.
 *
 * @property recurrenceMode Play's `ProductDetails.RecurrenceMode`: 1 infinite, 2 finite, 3 non-recurring.
 */
data class BillingPricingPhase(
    val formattedPrice: String,
    val priceAmountMicros: Long,
    val priceCurrencyCode: String,
    val billingPeriod: String,
    val billingCycleCount: Int,
    val recurrenceMode: Int,
)

/** The commitment of an installment subscription plan. */
data class BillingInstallmentPlan(
    val commitmentPaymentsCount: Int,
    val subsequentCommitmentPaymentsCount: Int,
)

/**
 * A subscription base plan (when [offerId] is `null`) or an offer on it, with the token that buys it.
 *
 * @property pricingPhases the phases in order; the last one is the base plan's regular price.
 */
data class BillingSubscriptionOfferDetails(
    val basePlanId: String,
    val offerId: String?,
    val offerToken: String,
    val offerTags: List<String>,
    val pricingPhases: List<BillingPricingPhase>,
    val installmentPlan: BillingInstallmentPlan? = null,
)

/**
 * A purchase option of a one-time product (when [offerId] is `null`) or a discounted offer on one,
 * as Play Billing 8 lists them in `oneTimePurchaseOfferDetailsList`.
 *
 * @property fullPriceMicros the price before the discount, for an offer.
 * @property discountPercentage the discount Play displays, for an offer that has one.
 */
data class BillingOneTimePurchaseOfferDetails(
    val purchaseOptionId: String?,
    val offerId: String?,
    val offerToken: String,
    val offerTags: List<String>,
    val formattedPrice: String,
    val priceAmountMicros: Long,
    val priceCurrencyCode: String,
    val fullPriceMicros: Long? = null,
    val discountPercentage: Int? = null,
    val limitedQuantity: LimitedQuantity? = null,
    val validTimeWindow: ValidTimeWindow? = null,
    val preorder: Preorder? = null,
    val rental: Rental? = null,
) {
    /** How many times the user may buy this offer, and how many are left. */
    data class LimitedQuantity(val maximumQuantity: Int, val remainingQuantity: Int)

    /** When the offer can be bought, in epoch milliseconds; either end may be open. */
    data class ValidTimeWindow(val startTimeMillis: Long?, val endTimeMillis: Long?)

    /** A pre-order: when the product is released and when the pre-sale ends, in epoch milliseconds. */
    data class Preorder(val releaseTimeMillis: Long, val presaleEndTimeMillis: Long)

    /** A rental: how long it lasts, and how long the user has to start it, as ISO 8601 periods. */
    data class Rental(val rentalPeriod: String, val rentalExpirationPeriod: String?)
}

/**
 * Store metadata of one product, as Play reports it.
 *
 * @property name the product's name without the app's name; [title] adds it.
 * @property subscriptionOfferDetails every base plan and offer Play returned to this user, empty
 *   for a one-time product.
 * @property oneTimePurchaseOfferDetails every purchase option and offer of a one-time product.
 * @property productDetails the object Play returned, which launching a purchase needs; `null`
 *   for products that did not come from Play, such as the development store's.
 */
data class BillingProductDetail(
    val id: String,
    val type: BillingProductType,
    val title: String,
    val name: String,
    val description: String,
    val subscriptionOfferDetails: List<BillingSubscriptionOfferDetails> = emptyList(),
    val oneTimePurchaseOfferDetails: List<BillingOneTimePurchaseOfferDetails> = emptyList(),
    val productDetails: ProductDetails? = null,
)

/**
 * A product Play did not return, with Play's `UnfetchedProduct.StatusCode`.
 *
 * @property statusCode 2 invalid product id format, 3 not found, 4 no offer the user is eligible
 *   for, 0 unknown.
 */
data class BillingUnfetchedProduct(
    val productId: String,
    val statusCode: Int,
) {
    /** Why Play did not return the product, in words. */
    val reason: String
        get() = when (statusCode) {
            INVALID_PRODUCT_ID_FORMAT -> "the product id is not a valid Google Play product id"
            PRODUCT_NOT_FOUND -> "Google Play has no such product for this app, or it is not active"
            NO_ELIGIBLE_OFFER -> "Google Play has no purchase option or offer this user is eligible for"
            else -> "Google Play did not return the product"
        }

    companion object {
        /** `UnfetchedProduct.StatusCode.INVALID_PRODUCT_ID_FORMAT`. */
        const val INVALID_PRODUCT_ID_FORMAT = 2

        /** `UnfetchedProduct.StatusCode.PRODUCT_NOT_FOUND`. */
        const val PRODUCT_NOT_FOUND = 3

        /** `UnfetchedProduct.StatusCode.NO_ELIGIBLE_OFFER`. */
        const val NO_ELIGIBLE_OFFER = 4
    }
}

/** What a product query returned: the products Play has, and the ones it did not return. */
data class BillingProductQuery(
    val products: List<BillingProductDetail>,
    val unfetched: List<BillingUnfetchedProduct>,
)

/**
 * A purchase as reported by Google Play Billing.
 *
 * @property quantity how many the user bought; Play lets the user choose it for a multi-quantity
 *   one-time product.
 * @property isSuspended a subscription Play lists as suspended: paused, or on hold because its
 *   renewal payment was declined. It grants no access and is never acknowledged or consumed.
 */
data class BillingPurchase(
    val id: String,
    val ids: Array<String>,
    val orderId: String?,
    val purchaseTime: Double,
    val originalJson: String,
    val purchaseToken: String,
    val signature: String,
    val isAutoRenewing: Boolean?,
    val isAcknowledged: Boolean,
    val purchaseState: Double,
    val packageName: String,
    val developerPayload: String,
    val obfuscatedAccountId: String?,
    val obfuscatedProfileId: String?,
    val quantity: Int = 1,
    val isSuspended: Boolean = false,
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is BillingPurchase) return false
        return id == other.id &&
            ids.contentEquals(other.ids) &&
            orderId == other.orderId &&
            purchaseTime == other.purchaseTime &&
            originalJson == other.originalJson &&
            purchaseToken == other.purchaseToken &&
            signature == other.signature &&
            isAutoRenewing == other.isAutoRenewing &&
            isAcknowledged == other.isAcknowledged &&
            purchaseState == other.purchaseState &&
            packageName == other.packageName &&
            developerPayload == other.developerPayload &&
            obfuscatedAccountId == other.obfuscatedAccountId &&
            obfuscatedProfileId == other.obfuscatedProfileId &&
            quantity == other.quantity &&
            isSuspended == other.isSuspended
    }

    override fun hashCode(): Int {
        var result = id.hashCode()
        result = 31 * result + ids.contentHashCode()
        result = 31 * result + purchaseToken.hashCode()
        return result
    }
}

/** Result of an acknowledge / consume call. */
data class BillingAcknowledgeResult(
    val responseCode: Double,
    val debugMessage: String?,
    val code: String,
    val message: String,
)

/**
 * How Google Play moves a subscriber from the subscription a purchase replaces to the one it buys.
 * Mapped to Billing 9's `SubscriptionProductReplacementParams.ReplacementMode`, whose numbers differ
 * from the deprecated `SubscriptionUpdateParams.ReplacementMode`.
 */
enum class BillingReplacementMode {
    WITH_TIME_PRORATION,
    CHARGE_PRORATED_PRICE,
    CHARGE_FULL_PRICE,
    WITHOUT_PRORATION,

    /**
     * The change takes effect at the next renewal. Until then Play reports the new purchase token
     * with the old product.
     */
    DEFERRED,
}

/**
 * The subscription a buy replaces.
 *
 * @property oldPurchaseToken the purchase Play holds now for the replaced subscription.
 * @property oldProductId the Play product id of the replaced subscription; the same as the bought
 *   one for a change of base plan.
 */
data class BillingSubscriptionReplacement(
    val oldPurchaseToken: String,
    val oldProductId: String,
    val mode: BillingReplacementMode,
)

/**
 * Parameters for launching a billing flow for one product.
 *
 * @property offerToken the subscription base plan or offer, or the one-time purchase option or
 *   offer, to buy. Required for a subscription; a one-time product without one buys Play's default
 *   purchase option.
 * @property recordUnfinished set by a caller that finishes the purchase itself once its backend has
 *   recorded it (owner mode). The engine then records every purchase of the bought products the
 *   flow returns as unfinished until it is acknowledged or consumed, so the background check can
 *   acknowledge it before Google Play's three-day refund even when the backend never hears of it
 *   (see [PlayFinishJob]). The check only ever acknowledges, a consumable too: consuming would take
 *   the purchase off Play's list before the backend recorded it, and the caller consumes an
 *   acknowledged consumable once it has. Off for a caller that leaves finishing to someone else,
 *   such as observer mode.
 */
data class BillingBuyItemParams(
    val type: BillingProductType,
    val productId: String,
    val offerToken: String? = null,
    val replacement: BillingSubscriptionReplacement? = null,
    val obfuscatedAccountId: String? = null,
    val obfuscatedProfileId: String? = null,
    val isOfferPersonalized: Boolean = false,
    val recordUnfinished: Boolean = false,
) {
    /**
     * The products a purchase this buy made may report: the bought one, and for a deferred
     * replacement the replaced one too, which Play reports until the change takes effect.
     */
    val reportedProductIds: Set<String>
        get() = if (replacement?.mode == BillingReplacementMode.DEFERRED) {
            setOf(productId, replacement.oldProductId)
        } else {
            setOf(productId)
        }

    /**
     * The purchase in Play's update [purchases] that this buy made: the first purchase of the bought
     * product, other than the purchase a replacement replaces. For a deferred replacement, whose new
     * purchase Play reports with the old product until the change takes effect, the first such
     * purchase whose products are all within the old and the new product. `null` when the update
     * does not answer this buy; Play's update may carry other purchases too.
     */
    fun answeringPurchase(purchases: Array<BillingPurchase>): BillingPurchase? {
        val replacedToken = replacement?.oldPurchaseToken
        val candidates = purchases.filter { it.purchaseToken != replacedToken }
        if (replacement?.mode != BillingReplacementMode.DEFERRED) {
            return candidates.firstOrNull { purchase -> productId in purchase.ids }
        }
        val allowed = reportedProductIds
        return candidates.firstOrNull { purchase -> purchase.ids.isNotEmpty() && purchase.ids.all { it in allowed } }
    }

    /** Whether Play's update [purchases] answers this buy; see [answeringPurchase]. */
    fun isAnsweredBy(purchases: Array<BillingPurchase>): Boolean = answeringPurchase(purchases) != null
}

/** What Play's in-app messages ended with. */
sealed class BillingInAppMessageResult {
    /** Nothing was shown, or the user dismissed it without a change. */
    data object NoActionNeeded : BillingInAppMessageResult()

    /** The user fixed the subscription of [purchaseToken], such as by updating its payment method. */
    data class SubscriptionStatusUpdated(val purchaseToken: String) : BillingInAppMessageResult()
}
