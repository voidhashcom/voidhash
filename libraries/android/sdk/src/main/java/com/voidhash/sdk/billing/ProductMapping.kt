package com.voidhash.sdk.billing

import com.android.billingclient.api.BillingClient
import com.voidhash.core.billing.BillingOneTimePurchaseOfferDetails
import com.voidhash.core.billing.BillingPricingPhase
import com.voidhash.core.billing.BillingProductDetail
import com.voidhash.core.billing.BillingProductType
import com.voidhash.core.billing.BillingSubscriptionOfferDetails
import com.voidhash.sdk.schema.RuntimeDevelopmentConfiguration
import com.voidhash.sdk.schema.RuntimeProductDefinition
import java.math.BigDecimal
import java.math.RoundingMode
import java.text.NumberFormat
import java.util.Currency
import java.util.Locale

/** The offer tag that makes a Google Play offer the product's introductory offer. */
internal const val INTRO_OFFER_TAG = "voidhash-intro"

/** The offer tag that keeps a Google Play offer out of a product's offers. */
internal const val IGNORED_OFFER_TAG = "voidhash-ignore"

/** Play Billing's `ProductDetails.RecurrenceMode` values. */
private const val INFINITE_RECURRING = 1
private const val FINITE_RECURRING = 2
private const val NON_RECURRING = 3

/** The type of a Studio product, or `null` for a type this SDK version cannot sell. */
internal fun productTypeOf(definition: RuntimeProductDefinition): VoidhashProductType? = when (definition.type) {
    "subscription" -> VoidhashProductType.SUBSCRIPTION
    "one-time" -> VoidhashProductType.NON_CONSUMABLE
    "one-time-consumable" -> VoidhashProductType.CONSUMABLE
    else -> null
}

/** What mapping a store product came to. */
internal sealed class ProductMapping {
    data class Mapped(val product: VoidhashProduct) : ProductMapping()

    /** The store returned the product, but not what selling it needs, as [reason] says. */
    data class Unavailable(val reason: String) : ProductMapping()
}

/**
 * Maps a Google Play product onto the product Studio [definition] makes of it.
 *
 * A subscription is the base plan the definition pins, or Play's first one when it pins none: its
 * price and period are the base plan's last pricing phase, its regular price whatever its
 * recurrence (a prepaid plan's is non-recurring). Its introductory offer and offers follow
 * [selectIntroOffer] and [promotionalOffersOf]. A one-time product is priced by its first purchase
 * option, and its discounted offers on that option are its offers.
 *
 * [onInvalidPeriod] hears of a billing period Play sent that is not a plain ISO 8601 duration; the
 * product is still mapped with the best reading of it.
 */
internal fun mapGooglePlayProduct(
    definition: RuntimeProductDefinition,
    type: VoidhashProductType,
    detail: BillingProductDetail,
    onInvalidPeriod: (String) -> Unit = {},
): ProductMapping {
    val studioOffers = definition.providers.googlePlay?.offers.orEmpty()
    val studioIdByPlayOfferId = studioOffers.associate { it.offerId to it.id }
    val googlePlay = GooglePlayProductInfo(
        productDetails = detail.productDetails,
        productId = detail.id,
        productType = if (detail.type == BillingProductType.SUBS) BillingClient.ProductType.SUBS else BillingClient.ProductType.INAPP,
        basePlanId = null,
        subscriptionOffers = detail.subscriptionOfferDetails.map(::googlePlaySubscriptionOffer),
        oneTimeOffers = detail.oneTimePurchaseOfferDetails.map(::googlePlayOneTimeOffer),
    )

    if (type != VoidhashProductType.SUBSCRIPTION) {
        val options = detail.oneTimePurchaseOfferDetails
        val base = options.firstOrNull { it.offerId == null } ?: options.firstOrNull()
            ?: return ProductMapping.Unavailable("Google Play returned no purchase option for this user")
        val offers = options
            .filter { option ->
                option.offerId != null && option !== base && IGNORED_OFFER_TAG !in option.offerTags &&
                    isOnPurchaseOption(option.purchaseOptionId, base.purchaseOptionId)
            }
            .map { option ->
                VoidhashOffer(
                    id = studioIdByPlayOfferId[option.offerId] ?: option.offerId.orEmpty(),
                    kind = VoidhashOfferKind.ONE_TIME,
                    phases = emptyList(),
                    price = playPrice(option.priceAmountMicros, option.priceCurrencyCode, option.formattedPrice),
                )
            }
        return ProductMapping.Mapped(
            VoidhashProduct(
                productId = definition.id,
                slug = definition.slug,
                store = VoidhashStore.GOOGLE_PLAY,
                storeProductId = detail.id,
                type = type,
                name = definition.name.ifEmpty { detail.name },
                displayName = detail.name,
                description = detail.description,
                price = playPrice(base.priceAmountMicros, base.priceCurrencyCode, base.formattedPrice),
                subscription = null,
                offers = offers,
                googlePlay = googlePlay,
            ),
        )
    }

    val pinnedBasePlanId = definition.providers.googlePlay?.basePlanId
    val basePlanId = pinnedBasePlanId ?: detail.subscriptionOfferDetails.firstOrNull()?.basePlanId
        ?: return ProductMapping.Unavailable("Google Play returned no base plan for this user")
    val basePlan = detail.subscriptionOfferDetails.firstOrNull { it.basePlanId == basePlanId && it.offerId == null }
        ?: return ProductMapping.Unavailable("Google Play did not return the base plan \"$basePlanId\"; it may not be active")
    val regular = basePlan.pricingPhases.lastOrNull()
        ?: return ProductMapping.Unavailable("Google Play returned no price for the base plan \"$basePlanId\"")
    val planOffers = detail.subscriptionOfferDetails.filter { it.basePlanId == basePlanId && it.offerId != null }

    val period = periodOf(regular.billingPeriod, onInvalidPeriod)
    val price = playPrice(regular.priceAmountMicros, regular.priceCurrencyCode, regular.formattedPrice)
    val intro = selectIntroOffer(planOffers, studioIdByPlayOfferId.keys)
    fun offerOf(offer: BillingSubscriptionOfferDetails, kind: VoidhashOfferKind) = VoidhashOffer(
        id = studioIdByPlayOfferId[offer.offerId] ?: offer.offerId.orEmpty(),
        kind = kind,
        phases = offerPhasesOf(offer.pricingPhases, onInvalidPeriod),
        price = null,
    )

    return ProductMapping.Mapped(
        VoidhashProduct(
            productId = definition.id,
            slug = definition.slug,
            store = VoidhashStore.GOOGLE_PLAY,
            storeProductId = detail.id,
            type = type,
            name = definition.name.ifEmpty { detail.name },
            displayName = detail.name,
            description = detail.description,
            price = price,
            subscription = subscriptionInfo(
                period = period,
                groupId = detail.id,
                introOffer = intro?.let { offerOf(it, VoidhashOfferKind.INTRODUCTORY) },
                price = price,
            ),
            offers = promotionalOffersOf(planOffers, intro, studioOffers.map { it.offerId })
                .map { offerOf(it, VoidhashOfferKind.PROMOTIONAL) },
            googlePlay = googlePlay.copy(basePlanId = basePlanId),
        ),
    )
}

/**
 * Whether a one-time offer of the purchase option [purchaseOptionId] is an offer on the purchase
 * option [basePurchaseOptionId], the one a product is priced and offered by: a product's offers are
 * the ones on it, and an offer is bought by its token on it. Either may be unnamed, by a product
 * the app built itself; the offer is then taken to be on it.
 */
internal fun isOnPurchaseOption(purchaseOptionId: String?, basePurchaseOptionId: String?): Boolean =
    basePurchaseOptionId == null || purchaseOptionId == null || purchaseOptionId == basePurchaseOptionId

/**
 * Whether [product] is a prepaid Google Play plan: the regular phase of its base plan, the last,
 * does not recur. Google Play limits how a subscription is replaced with or by one.
 */
internal val VoidhashProduct.isPrepaidPlan: Boolean
    get() {
        val googlePlay = googlePlay ?: return false
        val basePlan = googlePlay.subscriptionOffers.firstOrNull { it.basePlanId == googlePlay.basePlanId && it.offerId == null }
        return basePlan?.pricingPhases?.lastOrNull()?.recurrenceMode == GooglePlayRecurrenceMode.NON_RECURRING
    }

/**
 * The introductory offer among the offers [planOffers] of a base plan, as Play returned them for
 * this user.
 *
 * Play returns a new-customer offer only to users eligible for it, but a developer-determined offer
 * to every user, without saying which is which. So the offer tagged [INTRO_OFFER_TAG] is the
 * introductory one; without one, the offer with the longest leading free trial that Studio does not
 * name ([studioOfferIds]) and that is not tagged [IGNORED_OFFER_TAG]. An offer with a paid discount is
 * never chosen on its own: it may be meant for lapsed or upgrading subscribers only.
 */
internal fun selectIntroOffer(
    planOffers: List<BillingSubscriptionOfferDetails>,
    studioOfferIds: Set<String>,
): BillingSubscriptionOfferDetails? {
    planOffers.firstOrNull { INTRO_OFFER_TAG in it.offerTags }?.let { return it }
    return planOffers
        .filter { it.offerId !in studioOfferIds && IGNORED_OFFER_TAG !in it.offerTags }
        .map { it to leadingFreeTrialDays(it.pricingPhases) }
        .filter { (_, days) -> days > 0.0 }
        // The first of the longest, in Play's order.
        .fold(null as Pair<BillingSubscriptionOfferDetails, Double>?) { best, candidate ->
            if (best == null || candidate.second > best.second) candidate else best
        }
        ?.first
}

/**
 * The offers of a base plan a product lists besides its introductory one: the ones Studio names, in
 * Studio's order, then the others Play returned that are not tagged [IGNORED_OFFER_TAG], in Play's order.
 */
internal fun promotionalOffersOf(
    planOffers: List<BillingSubscriptionOfferDetails>,
    intro: BillingSubscriptionOfferDetails?,
    studioOfferIds: List<String>,
): List<BillingSubscriptionOfferDetails> {
    val candidates = planOffers.filter { it !== intro }
    val named = studioOfferIds.mapNotNull { offerId -> candidates.firstOrNull { it.offerId == offerId } }
    val others = candidates.filter { it.offerId !in studioOfferIds && IGNORED_OFFER_TAG !in it.offerTags }
    return named + others
}

/** How many days the free trial an offer starts with lasts; 0 when it starts with a paid phase. */
private fun leadingFreeTrialDays(phases: List<BillingPricingPhase>): Double =
    phases.dropLast(1)
        .takeWhile { it.priceAmountMicros == 0L }
        .sumOf { phase ->
            val period = VoidhashPeriod.parse(phase.billingPeriod) ?: VoidhashPeriod.parseLeniently(phase.billingPeriod)
                ?: return@sumOf 0.0
            cyclesOf(phase) * period.count * when (period.unit) {
                VoidhashPeriodUnit.DAY -> 1.0
                VoidhashPeriodUnit.WEEK -> 7.0
                VoidhashPeriodUnit.MONTH -> 365.0 / 12
                VoidhashPeriodUnit.YEAR -> 365.0
            }
        }

/**
 * The phases of an offer before its base plan's regular price, which is the last one: free when it
 * costs nothing, paid once up front when it does not recur, and paid each cycle otherwise.
 */
internal fun offerPhasesOf(phases: List<BillingPricingPhase>, onInvalidPeriod: (String) -> Unit = {}): List<VoidhashPricingPhase> =
    phases.dropLast(1).map { phase ->
        VoidhashPricingPhase(
            paymentMode = when {
                phase.priceAmountMicros == 0L -> VoidhashPaymentMode.FREE_TRIAL
                phase.recurrenceMode == NON_RECURRING -> VoidhashPaymentMode.PAY_UP_FRONT
                else -> VoidhashPaymentMode.PAY_AS_YOU_GO
            },
            price = playPrice(phase.priceAmountMicros, phase.priceCurrencyCode, phase.formattedPrice),
            period = periodOf(phase.billingPeriod, onInvalidPeriod),
            cycles = cyclesOf(phase),
        )
    }

/** How many cycles a phase lasts: its cycle count when it recurs a finite number of times, else one. */
private fun cyclesOf(phase: BillingPricingPhase): Int =
    if (phase.recurrenceMode == FINITE_RECURRING) phase.billingCycleCount.coerceAtLeast(1) else 1

/**
 * [billingPeriod] read as a period. One that is not a plain `PnD`, `PnW`, `PnM` or `PnY` is
 * reported to [onInvalid] and read as well as it can be; one that does not read at all as a month.
 */
private fun periodOf(billingPeriod: String, onInvalid: (String) -> Unit): VoidhashPeriod {
    VoidhashPeriod.parse(billingPeriod)?.let { return it }
    onInvalid(billingPeriod)
    return VoidhashPeriod.parseLeniently(billingPeriod) ?: VoidhashPeriod.of(VoidhashPeriodUnit.MONTH, 1)!!
}

/**
 * Maps a Studio [definition] onto the simulated product the development store sells: priced from its
 * development configuration in its own currency, with no offers. A `lifetime` period sells the
 * product once: a Studio subscription becomes non-consumable then.
 */
internal fun mapDevelopmentProduct(
    definition: RuntimeProductDefinition,
    type: VoidhashProductType,
    configuration: RuntimeDevelopmentConfiguration,
    onInvalidPeriod: (String) -> Unit = {},
): VoidhashProduct {
    val price = computedPrice(BigDecimal.valueOf(configuration.price), configuration.currencyCode)
    val unit = when (configuration.period) {
        "lifetime" -> null
        "day" -> VoidhashPeriodUnit.DAY
        "week" -> VoidhashPeriodUnit.WEEK
        "month" -> VoidhashPeriodUnit.MONTH
        "year" -> VoidhashPeriodUnit.YEAR
        else -> {
            onInvalidPeriod(configuration.period)
            VoidhashPeriodUnit.MONTH
        }
    }
    val period = unit?.let { VoidhashPeriod.of(it, configuration.periodCount.coerceAtLeast(1)) }
    val sold = if (period == null && type == VoidhashProductType.SUBSCRIPTION) VoidhashProductType.NON_CONSUMABLE else type
    return VoidhashProduct(
        productId = definition.id,
        slug = definition.slug,
        store = VoidhashStore.DEVELOPMENT,
        storeProductId = configuration.productId,
        type = sold,
        name = definition.name,
        displayName = definition.name,
        description = "Development purchase",
        price = price,
        subscription = if (sold == VoidhashProductType.SUBSCRIPTION && period != null) {
            subscriptionInfo(period, configuration.productId, introOffer = null, price = price)
        } else {
            null
        },
        offers = emptyList(),
        googlePlay = null,
        isDevelopmentLifetime = configuration.period == "lifetime",
    )
}

private fun subscriptionInfo(period: VoidhashPeriod, groupId: String, introOffer: VoidhashOffer?, price: VoidhashPrice) =
    VoidhashSubscriptionInfo(
        period = period,
        groupId = groupId,
        introOffer = introOffer,
        pricePerDay = pricePer(price, period, VoidhashPeriodUnit.DAY),
        pricePerWeek = pricePer(price, period, VoidhashPeriodUnit.WEEK),
        pricePerMonth = pricePer(price, period, VoidhashPeriodUnit.MONTH),
        pricePerYear = pricePer(price, period, VoidhashPeriodUnit.YEAR),
    )

/** How many of [unit] make a year, for [pricePer]: a day is a 365th, a week a 52nd, a month a 12th. */
private fun perYear(unit: VoidhashPeriodUnit): Long = when (unit) {
    VoidhashPeriodUnit.DAY -> 365
    VoidhashPeriodUnit.WEEK -> 52
    VoidhashPeriodUnit.MONTH -> 12
    VoidhashPeriodUnit.YEAR -> 1
}

/**
 * [price], paid every [period], spread over one [unit]: price × (unit length / period length) in
 * years, rounded half up to the currency's minor units.
 */
internal fun pricePer(price: VoidhashPrice, period: VoidhashPeriod, unit: VoidhashPeriodUnit): VoidhashPrice {
    val amount = price.amount
        .multiply(BigDecimal.valueOf(perYear(period.unit)))
        .divide(BigDecimal.valueOf(period.count * perYear(unit)), minorUnitsOf(price.currencyCode), RoundingMode.HALF_UP)
    return computedPrice(amount, price.currencyCode)
}

/** A price Play reported in micros, with Play's own text for it. */
internal fun playPrice(micros: Long, currencyCode: String, formatted: String): VoidhashPrice {
    val exact = BigDecimal.valueOf(micros, 6)
    val amount = try {
        exact.setScale(minorUnitsOf(currencyCode), RoundingMode.UNNECESSARY)
    } catch (_: ArithmeticException) {
        exact.stripTrailingZeros()
    }
    return VoidhashPrice(amount, micros, currencyCode, formatted)
}

/** A price the SDK worked out, rounded half up to the currency's minor units and formatted for the device's locale. */
internal fun computedPrice(amount: BigDecimal, currencyCode: String): VoidhashPrice {
    val rounded = amount.setScale(minorUnitsOf(currencyCode), RoundingMode.HALF_UP)
    return VoidhashPrice(rounded, rounded.movePointRight(6).toLong(), currencyCode, formatAmount(rounded, currencyCode))
}

/**
 * [amount] formatted as a price in [currencyCode] for the device's locale, to the places
 * [minorUnitsOf] gives: `java.util.Currency` only supplies the symbol.
 */
private fun formatAmount(amount: BigDecimal, currencyCode: String): String {
    val minorUnits = minorUnitsOf(currencyCode)
    val format = NumberFormat.getCurrencyInstance(Locale.getDefault())
    currencyOf(currencyCode)?.let { format.currency = it }
    format.minimumFractionDigits = minorUnits
    format.maximumFractionDigits = minorUnits
    return format.format(amount)
}

private fun currencyOf(code: String): Currency? = try {
    Currency.getInstance(code)
} catch (_: IllegalArgumentException) {
    null
}

/**
 * How many decimal places amounts in [currencyCode] take, as ISO 4217 sets them: 2 for USD, HUF, RSD
 * and IDR, 0 for JPY, 3 for KWD and IQD; 2 for a code the table does not list.
 *
 * A table rather than `java.util.Currency.defaultFractionDigits`, which reads ISO 4217 on a JVM but
 * CLDR's data on a device, where a number of currencies take fewer places (0 for RSD, IQD and LBP,
 * among others). The iOS SDK holds the same table, so both compute the same per-unit prices.
 */
internal fun minorUnitsOf(currencyCode: String): Int = ISO_4217_MINOR_UNITS[currencyCode.uppercase(Locale.ROOT)] ?: 2

/** The ISO 4217 currencies whose minor unit is not 2; the same entries as the iOS SDK's. */
private val ISO_4217_MINOR_UNITS = mapOf(
    "BIF" to 0, "CLP" to 0, "DJF" to 0, "GNF" to 0, "ISK" to 0, "JPY" to 0, "KMF" to 0, "KRW" to 0,
    "PYG" to 0, "RWF" to 0, "UGX" to 0, "UYI" to 0, "VND" to 0, "VUV" to 0, "XAF" to 0, "XOF" to 0,
    "XPF" to 0,
    "BHD" to 3, "IQD" to 3, "JOD" to 3, "KWD" to 3, "LYD" to 3, "OMR" to 3, "TND" to 3,
    "CLF" to 4, "UYW" to 4,
)

private fun googlePlaySubscriptionOffer(offer: BillingSubscriptionOfferDetails) = GooglePlaySubscriptionOffer(
    basePlanId = offer.basePlanId,
    offerId = offer.offerId,
    offerToken = offer.offerToken,
    offerTags = offer.offerTags,
    pricingPhases = offer.pricingPhases.map { phase ->
        GooglePlayPricingPhase(
            formattedPrice = phase.formattedPrice,
            priceAmountMicros = phase.priceAmountMicros,
            priceCurrencyCode = phase.priceCurrencyCode,
            billingPeriod = phase.billingPeriod,
            billingCycleCount = phase.billingCycleCount,
            recurrenceMode = when (phase.recurrenceMode) {
                INFINITE_RECURRING -> GooglePlayRecurrenceMode.INFINITE
                FINITE_RECURRING -> GooglePlayRecurrenceMode.FINITE
                NON_RECURRING -> GooglePlayRecurrenceMode.NON_RECURRING
                else -> GooglePlayRecurrenceMode.UNKNOWN
            },
        )
    },
    installmentPlan = offer.installmentPlan?.let {
        GooglePlayInstallmentPlan(it.commitmentPaymentsCount, it.subsequentCommitmentPaymentsCount)
    },
)

private fun googlePlayOneTimeOffer(offer: BillingOneTimePurchaseOfferDetails) = GooglePlayOneTimeOffer(
    purchaseOptionId = offer.purchaseOptionId,
    offerId = offer.offerId,
    offerToken = offer.offerToken,
    offerTags = offer.offerTags,
    price = playPrice(offer.priceAmountMicros, offer.priceCurrencyCode, offer.formattedPrice),
    // Play gives no text for the full price.
    fullPrice = offer.fullPriceMicros?.let { micros ->
        val full = playPrice(micros, offer.priceCurrencyCode, "")
        full.copy(formatted = formatAmount(full.amount, offer.priceCurrencyCode))
    },
    discountPercentage = offer.discountPercentage,
    limitedQuantity = offer.limitedQuantity?.let { GooglePlayOneTimeOffer.LimitedQuantity(it.maximumQuantity, it.remainingQuantity) },
    validTimeWindow = offer.validTimeWindow?.let { GooglePlayOneTimeOffer.ValidTimeWindow(it.startTimeMillis, it.endTimeMillis) },
    preorder = offer.preorder?.let { GooglePlayOneTimeOffer.Preorder(it.releaseTimeMillis, it.presaleEndTimeMillis) },
    rental = offer.rental?.let { GooglePlayOneTimeOffer.Rental(it.rentalPeriod, it.rentalExpirationPeriod) },
)
