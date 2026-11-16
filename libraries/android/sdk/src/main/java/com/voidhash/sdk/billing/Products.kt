package com.voidhash.sdk.billing

import com.android.billingclient.api.ProductDetails
import java.math.BigDecimal

/**
 * A price as the store reports it.
 *
 * @property amount the exact amount in [currencyCode] units (9.99, never 999).
 * @property amountMicros [amount] times 1,000,000, exactly.
 * @property currencyCode ISO 4217 code.
 * @property formatted the store's localized text for the price, never formatted again by the SDK.
 *   Prices the SDK computes, such as [VoidhashSubscriptionInfo.pricePerMonth], are formatted for
 *   [currencyCode] in the device's locale.
 */
data class VoidhashPrice(
    val amount: BigDecimal,
    val amountMicros: Long,
    val currencyCode: String,
    val formatted: String,
)

/** The unit of a [VoidhashPeriod]. */
enum class VoidhashPeriodUnit {
    DAY,
    WEEK,
    MONTH,
    YEAR,
}

/**
 * A length of time, such as a subscription's billing period.
 *
 * Normalised: a number of days that is a whole number of weeks is weeks, so `P7D` and `P1W` are
 * equal. Build one with [of] or [parse].
 *
 * @property count how many [unit]s, at least 1.
 * @property iso8601 the ISO 8601 duration, such as `P1W`, `P3M` or `P1Y`.
 */
class VoidhashPeriod private constructor(val unit: VoidhashPeriodUnit, val count: Int) {
    val iso8601: String
        get() = "P$count" + when (unit) {
            VoidhashPeriodUnit.DAY -> "D"
            VoidhashPeriodUnit.WEEK -> "W"
            VoidhashPeriodUnit.MONTH -> "M"
            VoidhashPeriodUnit.YEAR -> "Y"
        }

    override fun equals(other: Any?): Boolean = other is VoidhashPeriod && other.unit == unit && other.count == count

    override fun hashCode(): Int = 31 * unit.hashCode() + count

    override fun toString(): String = iso8601

    companion object {
        private val ISO_8601 = Regex("""P(\d+)([DWMY])""")
        private val ISO_8601_COMPONENT = Regex("""(\d+)([DWMY])""")

        /** [count] [unit]s, normalised; `null` when [count] is not positive. */
        fun of(unit: VoidhashPeriodUnit, count: Int): VoidhashPeriod? {
            if (count < 1) return null
            return if (unit == VoidhashPeriodUnit.DAY && count % 7 == 0) {
                VoidhashPeriod(VoidhashPeriodUnit.WEEK, count / 7)
            } else {
                VoidhashPeriod(unit, count)
            }
        }

        /**
         * Parses the ISO 8601 durations Google Play sends: `PnD`, `PnW`, `PnM` or `PnY`. `null` for
         * anything else; see [parseLeniently].
         */
        fun parse(iso8601: String): VoidhashPeriod? {
            val match = ISO_8601.matchEntire(iso8601.trim().uppercase()) ?: return null
            return of(unitOf(match.groupValues[2]), match.groupValues[1].toIntOrNull() ?: return null)
        }

        /**
         * The best reading of a duration [parse] does not accept, such as a combined `P1Y6M`: its
         * first component. `null` when nothing in it reads as a duration.
         */
        internal fun parseLeniently(iso8601: String): VoidhashPeriod? {
            val match = ISO_8601_COMPONENT.find(iso8601.trim().uppercase()) ?: return null
            return of(unitOf(match.groupValues[2]), match.groupValues[1].toIntOrNull() ?: return null)
        }

        private fun unitOf(designator: String): VoidhashPeriodUnit = when (designator) {
            "D" -> VoidhashPeriodUnit.DAY
            "W" -> VoidhashPeriodUnit.WEEK
            "M" -> VoidhashPeriodUnit.MONTH
            else -> VoidhashPeriodUnit.YEAR
        }
    }
}

/** How a [VoidhashPricingPhase] is paid. */
enum class VoidhashPaymentMode {
    /** Nothing is charged for the phase. */
    FREE_TRIAL,

    /** The phase's price is charged every cycle. */
    PAY_AS_YOU_GO,

    /** The phase's price is charged once, up front, for all of it. */
    PAY_UP_FRONT,
}

/**
 * One phase of an offer ahead of a subscription's regular price.
 *
 * @property price what one cycle costs; zero for a free trial.
 * @property period the length of one cycle.
 * @property cycles how many cycles the phase lasts, at least 1.
 */
data class VoidhashPricingPhase(
    val paymentMode: VoidhashPaymentMode,
    val price: VoidhashPrice,
    val period: VoidhashPeriod,
    val cycles: Int,
)

/** What a [VoidhashOffer] is. */
enum class VoidhashOfferKind {
    /** A free trial or introductory price for new subscribers. */
    INTRODUCTORY,

    /** Any other subscription offer. */
    PROMOTIONAL,

    /** An offer for lapsed subscribers. Google Play has no such kind; the App Store does. */
    WIN_BACK,

    /** A discounted purchase option of a one-time product. */
    ONE_TIME,

    /** An App Store offer code; only ever a transaction's offer. */
    CODE,
}

/**
 * An offer a product can be bought with.
 *
 * @property id the offer's id in Studio when Studio configures it, otherwise the store's offer id.
 * @property phases a subscription offer's phases before the regular price, in order; empty for a
 *   one-time offer.
 * @property price what a one-time offer costs; `null` for a subscription offer.
 */
data class VoidhashOffer(
    val id: String,
    val kind: VoidhashOfferKind,
    val phases: List<VoidhashPricingPhase>,
    val price: VoidhashPrice?,
)

/** What a [VoidhashProduct] is, from its type in Studio. */
enum class VoidhashProductType {
    SUBSCRIPTION,
    CONSUMABLE,
    NON_CONSUMABLE,

    /** A StoreKit non-renewing subscription; never on Android. */
    NON_RENEWING_SUBSCRIPTION,
}

/**
 * The store a product, transaction or subscription belongs to. [UNKNOWN] stands for a store this
 * SDK version does not know yet.
 */
enum class VoidhashStore {
    APP_STORE,
    GOOGLE_PLAY,
    STRIPE,

    /** The simulated store of development mode. */
    DEVELOPMENT,
    OTHER,
    UNKNOWN,
}

/**
 * A subscription's billing terms for this user.
 *
 * @property period the length of one regular billing period.
 * @property groupId the subscription group: on Google Play the Play subscription product, whose base
 *   plans a subscriber can switch between.
 * @property introOffer the free trial or introductory price this user can get now; `null` when
 *   there is none. See the README for how it is chosen on Google Play.
 * @property pricePerDay the regular price spread over a day, rounded half up to the currency's minor
 *   units; [pricePerWeek], [pricePerMonth] and [pricePerYear] likewise, with a week a 52nd and a
 *   month a 12th of a year, and a day a 365th.
 */
data class VoidhashSubscriptionInfo(
    val period: VoidhashPeriod,
    val groupId: String,
    val introOffer: VoidhashOffer?,
    val pricePerDay: VoidhashPrice,
    val pricePerWeek: VoidhashPrice,
    val pricePerMonth: VoidhashPrice,
    val pricePerYear: VoidhashPrice,
)

/**
 * A product the user can buy, combining Studio's definition with what the store reports.
 *
 * @property productId the product's Voidhash id, as a person's subscriptions name it.
 * @property slug the product's slug in Studio.
 * @property storeProductId the product's id in its store: the Play product id. Several products
 *   share it when they are base plans of one Play subscription.
 * @property name the product's name in Studio.
 * @property displayName the store's localized name for the product.
 * @property description the store's localized description.
 * @property price the regular price: for a subscription, the recurring price of its base plan.
 * @property subscription the billing terms; non-null exactly when [type] is
 *   [VoidhashProductType.SUBSCRIPTION].
 * @property offers the offers this user can buy the product with, other than the introductory one.
 * @property googlePlay everything Google Play reported about the product; `null` for the development
 *   store.
 * @property isDevelopmentLifetime whether the development store sells the product once because its
 *   development configuration's period is `lifetime`, which flows show as the product's period.
 */
data class VoidhashProduct(
    val productId: String,
    val slug: String,
    val store: VoidhashStore,
    val storeProductId: String,
    val type: VoidhashProductType,
    val name: String,
    val displayName: String,
    val description: String,
    val price: VoidhashPrice,
    val subscription: VoidhashSubscriptionInfo?,
    val offers: List<VoidhashOffer>,
    val googlePlay: GooglePlayProductInfo?,
    internal val isDevelopmentLifetime: Boolean = false,
)

/**
 * What Google Play reported about a product, for purchase UI that needs more than
 * [VoidhashProduct] says. Play Billing's own types are part of this API.
 *
 * @property productDetails the object Play Billing returned. `null` only for a product the app built
 *   itself; every product `getProducts` returns has it.
 * @property productType Play's product type, `subs` or `inapp`.
 * @property basePlanId the subscription base plan the product is in Studio; `null` for a one-time product.
 * @property subscriptionOffers every base plan and offer Play returned for this user, of every base
 *   plan of the Play product.
 * @property oneTimeOffers every purchase option and offer of a one-time product.
 */
data class GooglePlayProductInfo(
    val productDetails: ProductDetails?,
    val productId: String,
    val productType: String,
    val basePlanId: String?,
    val subscriptionOffers: List<GooglePlaySubscriptionOffer>,
    val oneTimeOffers: List<GooglePlayOneTimeOffer>,
)

/** How long a [GooglePlayPricingPhase] recurs, as Play's `RecurrenceMode` says. */
enum class GooglePlayRecurrenceMode {
    INFINITE,
    FINITE,
    NON_RECURRING,

    /** A mode this SDK version does not know yet. */
    UNKNOWN,
}

/** A pricing phase of a Google Play subscription offer, with Play's own field names. */
data class GooglePlayPricingPhase(
    val formattedPrice: String,
    val priceAmountMicros: Long,
    val priceCurrencyCode: String,
    val billingPeriod: String,
    val billingCycleCount: Int,
    val recurrenceMode: GooglePlayRecurrenceMode,
)

/** The commitment of a Google Play installment plan. */
data class GooglePlayInstallmentPlan(
    val commitmentPaymentsCount: Int,
    val subsequentCommitmentPaymentsCount: Int,
)

/**
 * A Google Play subscription base plan ([offerId] `null`) or offer on one.
 *
 * @property offerToken buys exactly this base plan or offer; see `VoidhashPurchaseOptions.googlePlay`.
 */
data class GooglePlaySubscriptionOffer(
    val basePlanId: String,
    val offerId: String?,
    val offerToken: String,
    val offerTags: List<String>,
    val pricingPhases: List<GooglePlayPricingPhase>,
    val installmentPlan: GooglePlayInstallmentPlan?,
)

/**
 * A Google Play one-time purchase option ([offerId] `null`) or discounted offer on one.
 *
 * @property fullPrice the price before the discount, for an offer that has one.
 * @property discountPercentage the discount Play displays.
 */
data class GooglePlayOneTimeOffer(
    val purchaseOptionId: String?,
    val offerId: String?,
    val offerToken: String,
    val offerTags: List<String>,
    val price: VoidhashPrice,
    val fullPrice: VoidhashPrice?,
    val discountPercentage: Int?,
    val limitedQuantity: LimitedQuantity?,
    val validTimeWindow: ValidTimeWindow?,
    val preorder: Preorder?,
    val rental: Rental?,
) {
    /** How many times the user may buy the offer, and how many are left. */
    data class LimitedQuantity(val maximumQuantity: Int, val remainingQuantity: Int)

    /** When the offer can be bought, in epoch milliseconds; either end may be open. */
    data class ValidTimeWindow(val startTimeMillis: Long?, val endTimeMillis: Long?)

    /** A pre-order's release and the end of its pre-sale, in epoch milliseconds. */
    data class Preorder(val releaseTimeMillis: Long, val presaleEndTimeMillis: Long)

    /** A rental's length, and how long the user has to start it, as ISO 8601 periods. */
    data class Rental(val rentalPeriod: String, val rentalExpirationPeriod: String?)
}
