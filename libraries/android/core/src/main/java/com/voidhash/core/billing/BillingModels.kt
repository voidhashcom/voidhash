package com.voidhash.core.billing

/** Google Play product type, mirroring `BillingClient.ProductType`. */
enum class BillingProductType {
    INAPP,
    SUBS,
}

/** One pricing phase of a subscription offer. */
data class BillingPricingPhase(
    val formattedPrice: String,
    val priceCurrencyCode: String,
    val billingPeriod: String,
    val billingCycleCount: Double,
    val priceAmountMicros: String,
    val recurrenceMode: Double,
)

/** Ordered pricing phases of a subscription offer. */
data class BillingPricingPhases(
    val pricingPhaseList: Array<BillingPricingPhase>,
) {
    override fun equals(other: Any?): Boolean =
        this === other ||
            (other is BillingPricingPhases && pricingPhaseList.contentEquals(other.pricingPhaseList))

    override fun hashCode(): Int = pricingPhaseList.contentHashCode()
}

/** A subscription base plan / offer, including the offer token used to launch a purchase. */
data class BillingSubscriptionOfferDetails(
    val basePlanId: String,
    val offerId: String?,
    val offerToken: String,
    val offerTags: Array<String>,
    val pricingPhases: BillingPricingPhases,
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is BillingSubscriptionOfferDetails) return false
        return basePlanId == other.basePlanId &&
            offerId == other.offerId &&
            offerToken == other.offerToken &&
            offerTags.contentEquals(other.offerTags) &&
            pricingPhases == other.pricingPhases
    }

    override fun hashCode(): Int {
        var result = basePlanId.hashCode()
        result = 31 * result + (offerId?.hashCode() ?: 0)
        result = 31 * result + offerToken.hashCode()
        result = 31 * result + offerTags.contentHashCode()
        result = 31 * result + pricingPhases.hashCode()
        return result
    }
}

/** One-time (non-subscription) offer pricing. */
data class BillingOneTimePurchaseOfferDetails(
    val priceCurrencyCode: String,
    val formattedPrice: String,
    val priceAmountMicros: String,
)

/** Store metadata for a single product. */
data class BillingProductDetail(
    val id: String,
    val title: String,
    val description: String,
    val type: String,
    val displayName: String,
    val platform: String,
    val currency: String,
    val displayPrice: String,
    val subscriptionOfferDetails: Array<BillingSubscriptionOfferDetails>?,
    val oneTimePurchaseOfferDetails: BillingOneTimePurchaseOfferDetails?,
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is BillingProductDetail) return false
        return id == other.id &&
            title == other.title &&
            description == other.description &&
            type == other.type &&
            displayName == other.displayName &&
            platform == other.platform &&
            currency == other.currency &&
            displayPrice == other.displayPrice &&
            (subscriptionOfferDetails?.contentEquals(other.subscriptionOfferDetails) ?: (other.subscriptionOfferDetails == null)) &&
            oneTimePurchaseOfferDetails == other.oneTimePurchaseOfferDetails
    }

    override fun hashCode(): Int {
        var result = id.hashCode()
        result = 31 * result + title.hashCode()
        result = 31 * result + description.hashCode()
        result = 31 * result + type.hashCode()
        result = 31 * result + displayName.hashCode()
        result = 31 * result + platform.hashCode()
        result = 31 * result + currency.hashCode()
        result = 31 * result + displayPrice.hashCode()
        result = 31 * result + (subscriptionOfferDetails?.contentHashCode() ?: 0)
        result = 31 * result + (oneTimePurchaseOfferDetails?.hashCode() ?: 0)
        return result
    }
}

/** A purchase as reported by Google Play Billing. */
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
            obfuscatedProfileId == other.obfuscatedProfileId
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

/** Parameters for launching a billing flow. */
data class BillingBuyItemParams(
    val type: BillingProductType,
    val skuArr: Array<String>,
    val purchaseToken: String? = null,
    val replacementMode: Int? = null,
    val obfuscatedAccountId: String? = null,
    val obfuscatedProfileId: String? = null,
    val offerTokenArr: Array<String>? = null,
    val isOfferPersonalized: Boolean? = null,
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is BillingBuyItemParams) return false
        return type == other.type &&
            skuArr.contentEquals(other.skuArr) &&
            purchaseToken == other.purchaseToken &&
            replacementMode == other.replacementMode &&
            obfuscatedAccountId == other.obfuscatedAccountId &&
            obfuscatedProfileId == other.obfuscatedProfileId &&
            (offerTokenArr?.contentEquals(other.offerTokenArr) ?: (other.offerTokenArr == null)) &&
            isOfferPersonalized == other.isOfferPersonalized
    }

    override fun hashCode(): Int {
        var result = type.hashCode()
        result = 31 * result + skuArr.contentHashCode()
        result = 31 * result + (purchaseToken?.hashCode() ?: 0)
        result = 31 * result + (replacementMode ?: 0)
        return result
    }
}
