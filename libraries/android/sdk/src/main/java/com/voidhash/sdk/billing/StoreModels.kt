package com.voidhash.sdk.billing

import com.voidhash.core.billing.BillingProductDetail
import com.voidhash.core.billing.BillingPurchase
import com.voidhash.sdk.schema.RuntimeProductDefinition

/** A purchasable product, combining store metadata with the project schema. */
data class VoidhashProduct(
    val id: String,
    val slug: String,
    val name: String,
    val description: String,
    val displayName: String,
    val displayPrice: String,
    val price: Double,
    val currency: String,
    val type: String,
    val billingPeriod: String?,
    val googlePlayOfferToken: String?,
) {
    /** True when the product is a Play Billing subscription. */
    val isSubscription: Boolean get() = type == "subs" || type == "subscription"
}

/** A store transaction normalized across providers. */
data class VoidhashTransaction(
    val id: String,
    val transactionId: String,
    val productId: String,
    val purchaseDate: Double,
    val quantity: Int,
    val isAcknowledged: Boolean,
    val purchaseState: String,
    val purchaseToken: String?,
    val appAccountToken: String?,
    val receipt: String?,
    val isAutoRenewing: Boolean?,
    /** Which provider produced the transaction; `development` marks a simulated one. */
    val store: String = "google-play",
) {
    /** Cross-runtime dedup key: `platform:transactionId:purchaseDate`. */
    val processingKey: String get() = "android:$transactionId:${purchaseDate.toLongIfWhole()}"

    /** True when the transaction came from the development (mock) store. */
    val isDevelopment: Boolean get() = store == "development"
}

/** Builds the synthetic transaction the development (mock) store returns. */
fun mapDevelopmentPurchaseToTransaction(
    productId: String,
    devTransactionId: String,
    purchaseDate: Double,
    quantity: Int,
): VoidhashTransaction = VoidhashTransaction(
    id = devTransactionId,
    transactionId = devTransactionId,
    productId = productId,
    purchaseDate = purchaseDate,
    quantity = quantity,
    // Dev purchases have nothing to acknowledge — the backend records them directly.
    isAcknowledged = true,
    purchaseState = "purchased",
    purchaseToken = null,
    appAccountToken = null,
    receipt = null,
    isAutoRenewing = null,
    store = "development",
)

private fun Double.toLongIfWhole(): Any = if (this % 1.0 == 0.0) toLong() else this

/**
 * Maps store product metadata onto [VoidhashProduct], selecting the offer whose
 * `basePlanId` matches the schema configuration (or the first offer when the
 * schema doesn't pin one).
 */
fun mapBillingProductToProduct(
    definition: RuntimeProductDefinition?,
    detail: BillingProductDetail,
): VoidhashProduct {
    val basePlanId = definition?.providers?.googlePlay?.basePlanId
    val selectedOffer = detail.subscriptionOfferDetails?.firstOrNull { offer ->
        basePlanId == null || offer.basePlanId == basePlanId
    }
    val pricingPhase = selectedOffer?.pricingPhases?.pricingPhaseList?.firstOrNull()

    return VoidhashProduct(
        id = detail.id,
        slug = definition?.slug ?: "",
        name = definition?.name?.ifEmpty { detail.title } ?: detail.title,
        description = detail.description,
        displayName = detail.displayName,
        displayPrice = detail.displayPrice,
        price = detail.displayPrice.replace(Regex("[^0-9.]"), "").toDoubleOrNull() ?: Double.NaN,
        currency = detail.currency,
        type = detail.type,
        billingPeriod = pricingPhase?.billingPeriod,
        googlePlayOfferToken = selectedOffer?.offerToken,
    )
}

/** Maps a Play Billing purchase onto the normalized transaction shape. */
fun mapBillingPurchaseToTransaction(purchase: BillingPurchase): VoidhashTransaction =
    VoidhashTransaction(
        id = purchase.id,
        transactionId = purchase.orderId?.takeIf { it.isNotEmpty() } ?: purchase.purchaseToken,
        productId = purchase.id,
        purchaseDate = purchase.purchaseTime,
        quantity = 1,
        isAcknowledged = purchase.isAcknowledged,
        purchaseState = when (purchase.purchaseState) {
            1.0 -> "purchased"
            2.0 -> "pending"
            else -> "unspecified"
        },
        purchaseToken = purchase.purchaseToken,
        appAccountToken = purchase.obfuscatedAccountId,
        receipt = purchase.originalJson,
        isAutoRenewing = purchase.isAutoRenewing,
    )
