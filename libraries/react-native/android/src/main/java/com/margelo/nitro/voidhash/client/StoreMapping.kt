package com.margelo.nitro.voidhash.client

import com.margelo.nitro.voidhash.NativeEnvironment
import com.margelo.nitro.voidhash.NativeOffer
import com.margelo.nitro.voidhash.NativeOfferKind
import com.margelo.nitro.voidhash.NativePaymentMode
import com.margelo.nitro.voidhash.NativePeriod
import com.margelo.nitro.voidhash.NativePeriodUnit
import com.margelo.nitro.voidhash.NativePrice
import com.margelo.nitro.voidhash.NativePricingPhase
import com.margelo.nitro.voidhash.NativeProduct
import com.margelo.nitro.voidhash.NativeProductType
import com.margelo.nitro.voidhash.NativeStore
import com.margelo.nitro.voidhash.NativeSubscriptionInfo
import com.margelo.nitro.voidhash.NativeTransaction
import com.margelo.nitro.voidhash.NativeTransactionOffer
import com.margelo.nitro.voidhash.NativeTransactionOfferKind
import com.voidhash.sdk.billing.GooglePlayOneTimeOffer
import com.voidhash.sdk.billing.GooglePlayProductInfo
import com.voidhash.sdk.billing.GooglePlayPurchaseState
import com.voidhash.sdk.billing.GooglePlayRecurrenceMode
import com.voidhash.sdk.billing.GooglePlaySubscriptionOffer
import com.voidhash.sdk.billing.GooglePlayTransactionInfo
import com.voidhash.sdk.billing.VoidhashEnvironment
import com.voidhash.sdk.billing.VoidhashOffer
import com.voidhash.sdk.billing.VoidhashOfferKind
import com.voidhash.sdk.billing.VoidhashPaymentMode
import com.voidhash.sdk.billing.VoidhashPeriod
import com.voidhash.sdk.billing.VoidhashPeriodUnit
import com.voidhash.sdk.billing.VoidhashPrice
import com.voidhash.sdk.billing.VoidhashProduct
import com.voidhash.sdk.billing.VoidhashProductType
import com.voidhash.sdk.billing.VoidhashStore
import com.voidhash.sdk.billing.VoidhashSubscriptionInfo
import com.voidhash.sdk.billing.VoidhashTransaction
import org.json.JSONArray
import org.json.JSONObject

/*
 * The SDK's products and transactions as the Nitro contract carries them (`VoidhashNativeClient.nitro.ts`):
 * the fields every store has as structs, field for field, and the Google Play part as the JSON the
 * facade's `GooglePlayProductInfo` and `GooglePlayTransactionInfo` decoders read
 * (`src/core/entities/google-play.ts`), with Play's own field names. An absent value is left out of
 * the JSON; a value the contract has no name for is `unknown`.
 */

internal fun VoidhashProduct.toNative() = NativeProduct(
    productId = productId,
    slug = slug,
    store = store.toNative(),
    storeProductId = storeProductId,
    type = when (type) {
        VoidhashProductType.SUBSCRIPTION -> NativeProductType.SUBSCRIPTION
        VoidhashProductType.CONSUMABLE -> NativeProductType.CONSUMABLE
        VoidhashProductType.NON_CONSUMABLE -> NativeProductType.NONCONSUMABLE
        VoidhashProductType.NON_RENEWING_SUBSCRIPTION -> NativeProductType.NONRENEWINGSUBSCRIPTION
    },
    name = name,
    displayName = displayName,
    description = description,
    price = price.toNative(),
    subscription = subscription?.toNative(),
    offers = offers.map { it.toNative() }.toTypedArray(),
    appStoreJson = null,
    googlePlayJson = googlePlay?.toJson()?.toString(),
)

internal fun VoidhashTransaction.toNative() = NativeTransaction(
    id = id,
    originalId = originalId,
    productSlug = productSlug,
    storeProductId = storeProductId,
    store = store.toNative(),
    purchasedAt = purchasedAt.toDouble(),
    expiresAt = expiresAt?.toDouble(),
    quantity = quantity.toDouble(),
    isRenewal = isRenewal,
    offer = offer?.let { offer ->
        NativeTransactionOffer(
            id = offer.id,
            kind = when (offer.kind) {
                null -> null
                VoidhashOfferKind.INTRODUCTORY -> NativeTransactionOfferKind.INTRODUCTORY
                VoidhashOfferKind.PROMOTIONAL -> NativeTransactionOfferKind.PROMOTIONAL
                VoidhashOfferKind.WIN_BACK -> NativeTransactionOfferKind.WINBACK
                VoidhashOfferKind.ONE_TIME -> NativeTransactionOfferKind.ONETIME
                VoidhashOfferKind.CODE -> NativeTransactionOfferKind.CODE
            },
            paymentMode = offer.paymentMode?.toNative(),
        )
    },
    environment = when (environment) {
        VoidhashEnvironment.PRODUCTION -> NativeEnvironment.PRODUCTION
        VoidhashEnvironment.SANDBOX -> NativeEnvironment.SANDBOX
        VoidhashEnvironment.XCODE -> NativeEnvironment.XCODE
        VoidhashEnvironment.DEVELOPMENT -> NativeEnvironment.DEVELOPMENT
        VoidhashEnvironment.UNKNOWN -> NativeEnvironment.UNKNOWN
    },
    appStoreJson = null,
    googlePlayJson = googlePlay?.toJson()?.toString(),
)

/** The contract's offer kind for a product's offer; [VoidhashOfferKind.CODE] is only ever a transaction's. */
internal fun VoidhashOfferKind.toNative() = when (this) {
    VoidhashOfferKind.INTRODUCTORY -> NativeOfferKind.INTRODUCTORY
    VoidhashOfferKind.PROMOTIONAL -> NativeOfferKind.PROMOTIONAL
    VoidhashOfferKind.WIN_BACK -> NativeOfferKind.WINBACK
    VoidhashOfferKind.ONE_TIME -> NativeOfferKind.ONETIME
    VoidhashOfferKind.CODE -> NativeOfferKind.UNKNOWN
}

private fun VoidhashStore.toNative() = when (this) {
    VoidhashStore.APP_STORE -> NativeStore.APPSTORE
    VoidhashStore.GOOGLE_PLAY -> NativeStore.GOOGLEPLAY
    VoidhashStore.DEVELOPMENT -> NativeStore.DEVELOPMENT
    VoidhashStore.STRIPE, VoidhashStore.OTHER, VoidhashStore.UNKNOWN -> NativeStore.UNKNOWN
}

private fun VoidhashPrice.toNative() = NativePrice(amount.toDouble(), amountMicros.toDouble(), currencyCode, formatted)

private fun VoidhashPeriod.toNative() = NativePeriod(
    unit = when (unit) {
        VoidhashPeriodUnit.DAY -> NativePeriodUnit.DAY
        VoidhashPeriodUnit.WEEK -> NativePeriodUnit.WEEK
        VoidhashPeriodUnit.MONTH -> NativePeriodUnit.MONTH
        VoidhashPeriodUnit.YEAR -> NativePeriodUnit.YEAR
    },
    count = count.toDouble(),
    iso8601 = iso8601,
)

private fun VoidhashPaymentMode.toNative() = when (this) {
    VoidhashPaymentMode.FREE_TRIAL -> NativePaymentMode.FREETRIAL
    VoidhashPaymentMode.PAY_AS_YOU_GO -> NativePaymentMode.PAYASYOUGO
    VoidhashPaymentMode.PAY_UP_FRONT -> NativePaymentMode.PAYUPFRONT
}

private fun VoidhashOffer.toNative() = NativeOffer(
    id = id,
    kind = kind.toNative(),
    phases = phases.map { phase ->
        NativePricingPhase(phase.paymentMode.toNative(), phase.price.toNative(), phase.period.toNative(), phase.cycles.toDouble())
    }.toTypedArray(),
    price = price?.toNative(),
)

private fun VoidhashSubscriptionInfo.toNative() = NativeSubscriptionInfo(
    period = period.toNative(),
    groupId = groupId,
    introOffer = introOffer?.toNative(),
    pricePerDay = pricePerDay.toNative(),
    pricePerWeek = pricePerWeek.toNative(),
    pricePerMonth = pricePerMonth.toNative(),
    pricePerYear = pricePerYear.toNative(),
)

/** The facade's `GooglePlayProductInfo`; Play's `ProductDetails` itself stays native. */
internal fun GooglePlayProductInfo.toJson(): JSONObject = JSONObject()
    .put("productId", productId)
    .put("productType", productType)
    .putOpt("basePlanId", basePlanId)
    .put("subscriptionOffers", JSONArray(subscriptionOffers.map { it.toJson() }))
    .put("oneTimeOffers", JSONArray(oneTimeOffers.map { it.toJson() }))

private fun GooglePlaySubscriptionOffer.toJson(): JSONObject = JSONObject()
    .put("basePlanId", basePlanId)
    .putOpt("offerId", offerId)
    .put("offerToken", offerToken)
    .put("offerTags", JSONArray(offerTags))
    .put(
        "pricingPhases",
        JSONArray(
            pricingPhases.map { phase ->
                JSONObject()
                    .put("formattedPrice", phase.formattedPrice)
                    .put("priceAmountMicros", phase.priceAmountMicros)
                    .put("priceCurrencyCode", phase.priceCurrencyCode)
                    .put("billingPeriod", phase.billingPeriod)
                    .put("billingCycleCount", phase.billingCycleCount)
                    .put(
                        "recurrenceMode",
                        when (phase.recurrenceMode) {
                            GooglePlayRecurrenceMode.INFINITE -> "infinite"
                            GooglePlayRecurrenceMode.FINITE -> "finite"
                            GooglePlayRecurrenceMode.NON_RECURRING -> "nonRecurring"
                            GooglePlayRecurrenceMode.UNKNOWN -> "unknown"
                        },
                    )
            },
        ),
    )
    .putOpt(
        "installmentPlan",
        installmentPlan?.let { plan ->
            JSONObject()
                .put("commitmentPaymentsCount", plan.commitmentPaymentsCount)
                .put("subsequentCommitmentPaymentsCount", plan.subsequentCommitmentPaymentsCount)
        },
    )

private fun GooglePlayOneTimeOffer.toJson(): JSONObject = JSONObject()
    .putOpt("purchaseOptionId", purchaseOptionId)
    .putOpt("offerId", offerId)
    .put("offerToken", offerToken)
    .put("offerTags", JSONArray(offerTags))
    .put("price", price.toJson())
    .putOpt("fullPrice", fullPrice?.toJson())
    .putOpt("discountPercentage", discountPercentage)
    .putOpt(
        "limitedQuantity",
        limitedQuantity?.let {
            JSONObject().put("maximumQuantity", it.maximumQuantity).put("remainingQuantity", it.remainingQuantity)
        },
    )
    // Either end of the window may be open; an open end is left out.
    .putOpt(
        "validTimeWindow",
        validTimeWindow?.let {
            JSONObject().putOpt("startTimeMillis", it.startTimeMillis).putOpt("endTimeMillis", it.endTimeMillis)
        },
    )
    .putOpt(
        "preorder",
        preorder?.let {
            JSONObject().put("releaseTimeMillis", it.releaseTimeMillis).put("presaleEndTimeMillis", it.presaleEndTimeMillis)
        },
    )
    .putOpt(
        "rental",
        rental?.let { JSONObject().put("rentalPeriod", it.rentalPeriod).putOpt("rentalExpirationPeriod", it.rentalExpirationPeriod) },
    )

private fun VoidhashPrice.toJson(): JSONObject = JSONObject()
    .put("amount", amount.toDouble())
    .put("amountMicros", amountMicros)
    .put("currencyCode", currencyCode)
    .put("formatted", formatted)

/** The facade's `GooglePlayTransactionInfo`. */
internal fun GooglePlayTransactionInfo.toJson(): JSONObject = JSONObject()
    .putOpt("orderId", orderId)
    .put("purchaseToken", purchaseToken)
    .put("productIds", JSONArray(productIds))
    .put(
        "purchaseState",
        when (purchaseState) {
            GooglePlayPurchaseState.PURCHASED -> "purchased"
            GooglePlayPurchaseState.PENDING -> "pending"
            GooglePlayPurchaseState.UNKNOWN -> "unknown"
        },
    )
    .put("isAcknowledged", isAcknowledged)
    .putOpt("isAutoRenewing", isAutoRenewing)
    .putOpt("obfuscatedAccountId", obfuscatedAccountId)
    .putOpt("obfuscatedProfileId", obfuscatedProfileId)
    .put("isSuspended", isSuspended)
