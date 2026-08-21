package com.margelo.nitro.voidhash

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.margelo.nitro.NitroModules
import com.margelo.nitro.core.Promise
import com.voidhash.core.billing.BillingAcknowledgeResult
import com.voidhash.core.billing.BillingBuyItemParams
import com.voidhash.core.billing.BillingEngine
import com.voidhash.core.billing.BillingOneTimePurchaseOfferDetails
import com.voidhash.core.billing.BillingPricingPhase
import com.voidhash.core.billing.BillingPricingPhases
import com.voidhash.core.billing.BillingProductDetail
import com.voidhash.core.billing.BillingProductType
import com.voidhash.core.billing.BillingPurchase
import com.voidhash.core.billing.BillingSubscriptionOfferDetails

@Keep
@DoNotStrip
class HybridGoogleBilling : HybridGoogleBillingSpec() {
    private val engine = BillingEngine(
        contextProvider = { NitroModules.applicationContext },
        activityProvider = { NitroModules.applicationContext?.currentActivity },
        isPlayServicesAvailable = { context ->
            GoogleApiAvailability
                .getInstance()
                .isGooglePlayServicesAvailable(context) == ConnectionResult.SUCCESS
        },
    )

    override fun initConnection(onPurchase: ((HybridGoogleBillingPurchaseSpec) -> Unit)?): Promise<Boolean> {
        return Promise.async {
            val observer: ((BillingPurchase) -> Unit)? = onPurchase?.let { callback ->
                { purchase: BillingPurchase -> callback(purchase.toHybrid()) }
            }
            return@async engine.initConnection(observer)
        }
    }

    override fun endConnection(): Promise<Boolean> {
        return Promise.async {
            return@async engine.endConnection()
        }
    }

    override fun getItemsByType(type: GoogleBillingProductType, skus: Array<String>): Promise<Array<HybridGoogleBillingProductDetailSpec>> {
        return Promise.async {
            return@async engine
                .getItemsByType(type.toCore(), skus)
                .map { productDetail -> productDetail.toHybrid() }
                .toTypedArray()
        }
    }

    override fun buyItemByType(params: GoogleBillingBuyItemByTypeParams): Promise<Array<HybridGoogleBillingPurchaseSpec>> {
        return Promise.async {
            return@async engine
                .buyItemByType(
                    BillingBuyItemParams(
                        type = params.type.toCore(),
                        skuArr = params.skuArr,
                        purchaseToken = params.purchaseToken,
                        replacementMode = params.replacementMode?.toInt(),
                        obfuscatedAccountId = params.obfuscatedAccountId,
                        obfuscatedProfileId = params.obfuscatedProfileId,
                        offerTokenArr = params.offerTokenArr,
                        isOfferPersonalized = params.isOfferPersonalized,
                    ),
                )
                .map { purchase -> purchase.toHybrid() }
                .toTypedArray()
        }
    }

    override fun acknowledgePurchase(token: String): Promise<HybridGoogleBillingAcknowledgeResultSpec> {
        return Promise.async {
            return@async engine.acknowledgePurchase(token).toHybrid()
        }
    }

    override fun consumeProduct(token: String): Promise<HybridGoogleBillingAcknowledgeResultSpec> {
        return Promise.async {
            return@async engine.consumeProduct(token).toHybrid()
        }
    }

    override fun getAvailableItemsByType(type: GoogleBillingProductType): Promise<Array<HybridGoogleBillingPurchaseSpec>> {
        return Promise.async {
            return@async engine
                .getAvailableItemsByType(type.toCore())
                .map { purchase -> purchase.toHybrid() }
                .toTypedArray()
        }
    }
}

private fun GoogleBillingProductType.toCore(): BillingProductType {
    return when (this) {
        GoogleBillingProductType.INAPP -> BillingProductType.INAPP
        GoogleBillingProductType.SUBS -> BillingProductType.SUBS
    }
}

private fun BillingPurchase.toHybrid(): HybridGoogleBillingPurchaseSpec {
    return HybridGoogleBillingPurchase(
        id = id,
        ids = ids,
        orderId = orderId,
        purchaseTime = purchaseTime,
        originalJson = originalJson,
        purchaseToken = purchaseToken,
        signature = signature,
        isAutoRenewing = isAutoRenewing,
        isAcknowledged = isAcknowledged,
        purchaseState = purchaseState,
        packageName = packageName,
        developerPayload = developerPayload,
        obfuscatedAccountId = obfuscatedAccountId,
        obfuscatedProfileId = obfuscatedProfileId,
    )
}

private fun BillingAcknowledgeResult.toHybrid(): HybridGoogleBillingAcknowledgeResultSpec {
    return HybridGoogleBillingAcknowledgeResult(
        responseCode = responseCode,
        debugMessage = debugMessage,
        code = code,
        message = message,
    )
}

private fun BillingProductDetail.toHybrid(): HybridGoogleBillingProductDetailSpec {
    return HybridGoogleBillingProductDetail(
        id = id,
        title = title,
        description = description,
        type = type,
        displayName = displayName,
        platform = platform,
        currency = currency,
        displayPrice = displayPrice,
        subscriptionOfferDetails = subscriptionOfferDetails
            ?.map { offerDetails -> offerDetails.toHybrid() }
            ?.toTypedArray<HybridGoogleBillingSubscriptionOfferDetailsSpec>()
            ?.let { Variant_NullType_Array_HybridGoogleBillingSubscriptionOfferDetailsSpec_.Second(it) },
        oneTimePurchaseOfferDetails = oneTimePurchaseOfferDetails
            ?.toHybrid()
            ?.let { Variant_NullType_HybridGoogleBillingOneTimePurchaseOfferDetailsSpec.Second(it) },
    )
}

private fun BillingOneTimePurchaseOfferDetails.toHybrid(): HybridGoogleBillingOneTimePurchaseOfferDetailsSpec {
    return HybridGoogleBillingOneTimePurchaseOfferDetails(
        priceCurrencyCode = priceCurrencyCode,
        formattedPrice = formattedPrice,
        priceAmountMicros = priceAmountMicros,
    )
}

private fun BillingSubscriptionOfferDetails.toHybrid(): HybridGoogleBillingSubscriptionOfferDetailsSpec {
    return HybridGoogleBillingSubscriptionOfferDetails(
        basePlanId = basePlanId,
        offerId = offerId,
        offerToken = offerToken,
        offerTags = offerTags,
        pricingPhases = pricingPhases.toHybrid(),
    )
}

private fun BillingPricingPhases.toHybrid(): HybridGoogleBillingPricingPhasesSpec {
    return HybridGoogleBillingPricingPhases(
        pricingPhaseList = pricingPhaseList
            .map { pricingPhase -> pricingPhase.toHybrid() }
            .toTypedArray(),
    )
}

private fun BillingPricingPhase.toHybrid(): HybridGoogleBillingPricingPhaseSpec {
    return HybridGoogleBillingPricingPhase(
        formattedPrice = formattedPrice,
        priceCurrencyCode = priceCurrencyCode,
        billingPeriod = billingPeriod,
        billingCycleCount = billingCycleCount,
        priceAmountMicros = priceAmountMicros,
        recurrenceMode = recurrenceMode,
    )
}
