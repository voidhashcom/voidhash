package com.voidhash.sdk.billing

import com.voidhash.core.billing.BillingAcknowledgeResult
import com.voidhash.core.billing.BillingBuyItemParams
import com.voidhash.core.billing.BillingOneTimePurchaseOfferDetails
import com.voidhash.core.billing.BillingPricingPhase
import com.voidhash.core.billing.BillingPricingPhases
import com.voidhash.core.billing.BillingProductDetail
import com.voidhash.core.billing.BillingProductType
import com.voidhash.core.billing.BillingPurchase
import com.voidhash.core.billing.BillingSubscriptionOfferDetails

/** In-memory [BillingEnginePort] recording the calls the orchestrator makes. */
class FakeBillingEngine : BillingEnginePort {
    var productsByType: Map<BillingProductType, List<BillingProductDetail>> = emptyMap()
    var ownedByType: Map<BillingProductType, List<BillingPurchase>> = emptyMap()
    var buyResult: () -> Array<BillingPurchase> = { emptyArray() }
    var acknowledgeResult = billingResult(0.0)
    var consumeResult = billingResult(0.0)

    val buyParams = mutableListOf<BillingBuyItemParams>()
    val acknowledgedTokens = mutableListOf<String>()
    val consumedTokens = mutableListOf<String>()
    var observer: ((BillingPurchase) -> Unit)? = null

    override suspend fun initConnection(onPurchase: ((BillingPurchase) -> Unit)?): Boolean {
        observer = onPurchase
        return true
    }

    override suspend fun endConnection(): Boolean = true

    override suspend fun getItemsByType(
        type: BillingProductType,
        skus: Array<String>,
    ): Array<BillingProductDetail> =
        (productsByType[type].orEmpty()).filter { it.id in skus }.toTypedArray()

    override suspend fun buyItemByType(params: BillingBuyItemParams): Array<BillingPurchase> {
        buyParams.add(params)
        return buyResult()
    }

    override suspend fun acknowledgePurchase(token: String): BillingAcknowledgeResult {
        acknowledgedTokens.add(token)
        return acknowledgeResult
    }

    override suspend fun consumeProduct(token: String): BillingAcknowledgeResult {
        consumedTokens.add(token)
        return consumeResult
    }

    override suspend fun getAvailableItemsByType(type: BillingProductType): Array<BillingPurchase> =
        ownedByType[type].orEmpty().toTypedArray()
}

internal fun billingResult(responseCode: Double, message: String = "Success") =
    BillingAcknowledgeResult(responseCode, null, "OK", message)

internal fun testPurchase(
    productId: String = "pro_monthly",
    orderId: String? = "GPA.1",
    purchaseToken: String = "token-1",
    purchaseTime: Double = 1_700_000_000_000.0,
    isAcknowledged: Boolean = false,
    purchaseState: Double = 1.0,
    obfuscatedAccountId: String? = "3501e751-7582-58f9-9c1d-533c7466049f",
) = BillingPurchase(
    id = productId,
    ids = arrayOf(productId),
    orderId = orderId,
    purchaseTime = purchaseTime,
    originalJson = """{"productId":"$productId"}""",
    purchaseToken = purchaseToken,
    signature = "signature",
    isAutoRenewing = true,
    isAcknowledged = isAcknowledged,
    purchaseState = purchaseState,
    packageName = "com.example.app",
    developerPayload = "",
    obfuscatedAccountId = obfuscatedAccountId,
    obfuscatedProfileId = null,
)

internal fun testSubscriptionDetail(
    id: String = "pro_monthly",
    displayPrice: String = "59,99 €",
    offers: List<Triple<String, String, String>> = listOf(
        Triple("monthly", "offer-monthly", "P1M"),
        Triple("annual", "offer-annual", "P1Y"),
    ),
) = BillingProductDetail(
    id = id,
    title = "Pro",
    description = "Pro access",
    type = "subs",
    displayName = "Pro",
    platform = "android",
    currency = "EUR",
    displayPrice = displayPrice,
    subscriptionOfferDetails = offers.map { (basePlanId, offerToken, billingPeriod) ->
        BillingSubscriptionOfferDetails(
            basePlanId = basePlanId,
            offerId = null,
            offerToken = offerToken,
            offerTags = emptyArray(),
            pricingPhases = BillingPricingPhases(
                arrayOf(
                    BillingPricingPhase(
                        formattedPrice = displayPrice,
                        priceCurrencyCode = "EUR",
                        billingPeriod = billingPeriod,
                        billingCycleCount = 0.0,
                        priceAmountMicros = "59990000",
                        recurrenceMode = 1.0,
                    ),
                ),
            ),
        )
    }.toTypedArray(),
    oneTimePurchaseOfferDetails = null,
)

internal fun testOneTimeDetail(id: String = "lifetime", displayPrice: String = "$99.00") =
    BillingProductDetail(
        id = id,
        title = "Lifetime",
        description = "Lifetime access",
        type = "inapp",
        displayName = "Lifetime",
        platform = "android",
        currency = "USD",
        displayPrice = displayPrice,
        subscriptionOfferDetails = null,
        oneTimePurchaseOfferDetails = BillingOneTimePurchaseOfferDetails("USD", displayPrice, "99000000"),
    )
