package com.voidhash.sdk.flows

import com.voidhash.sdk.billing.INTRO_OFFER_TAG
import com.voidhash.sdk.billing.VoidhashPaymentMode
import com.voidhash.sdk.billing.VoidhashPeriod
import com.voidhash.sdk.billing.VoidhashPeriodUnit
import com.voidhash.sdk.billing.VoidhashProduct
import com.voidhash.sdk.billing.VoidhashStore
import com.voidhash.sdk.billing.computedPrice
import org.json.JSONArray
import org.json.JSONObject

/** The word for one [unit], as flows name periods. */
private fun unitWord(unit: VoidhashPeriodUnit): String = when (unit) {
    VoidhashPeriodUnit.DAY -> "day"
    VoidhashPeriodUnit.WEEK -> "week"
    VoidhashPeriodUnit.MONTH -> "month"
    VoidhashPeriodUnit.YEAR -> "year"
}

/** `<count> <unit>`, plural when there are several: `1 week`, `3 days`. */
private fun countedPeriodText(unit: VoidhashPeriodUnit, count: Int): String =
    "$count ${unitWord(unit)}" + if (count == 1) "" else "s"

/** A flow's text for a billing period of [count] [unit]s: the unit's word for one, such as `month`, and `3 months` otherwise. */
internal fun flowPeriodText(unit: VoidhashPeriodUnit, count: Int): String =
    if (count == 1) unitWord(unit) else countedPeriodText(unit, count)

/**
 * The billing period a flow shows for [product]: [flowPeriodText] of a subscription's period,
 * `lifetime` for a development-store product whose development configuration's period is
 * `lifetime`, and `null` for any other one-time product.
 */
internal fun flowPeriodOf(product: VoidhashProduct): String? {
    val subscription = product.subscription
    return when {
        subscription != null -> flowPeriodText(subscription.period.unit, subscription.period.count)
        product.isDevelopmentLifetime -> "lifetime"
        else -> null
    }
}

/**
 * The free trial a flow shows for [product]: how long the first phase of its introductory offer
 * lasts when that phase is free, such as `1 week` or `3 days`; `null` without one.
 */
internal fun flowTrialPeriodOf(product: VoidhashProduct): String? {
    val trial = product.subscription?.introOffer?.phases?.firstOrNull()
        ?.takeIf { it.paymentMode == VoidhashPaymentMode.FREE_TRIAL } ?: return null
    val length = VoidhashPeriod.of(trial.period.unit, trial.period.count * trial.cycles) ?: return null
    return countedPeriodText(length.unit, length.count)
}

/**
 * An introductory offer as a flow receives it, from the offer's first pricing phase.
 *
 * @property kind `none`, `free-trial`, `pay-as-you-go` or `pay-up-front`.
 * @property price what one cycle costs, 0 for a free trial; [priceString] the store's text for it.
 * @property periodUnit the length of one cycle: `day`, `week`, `month` or `year`, [periodCount] of them.
 * @property periods how many cycles the phase lasts.
 */
data class FlowRuntimeIntroOffer(
    val kind: String,
    val price: Double? = null,
    val priceString: String? = null,
    val periodUnit: String? = null,
    val periodCount: Int? = null,
    val periods: Int? = null,
) {
    internal fun toJson(): JSONObject = JSONObject().apply {
        put("kind", kind)
        price?.let { put("price", it) }
        priceString?.let { put("priceString", it) }
        periodUnit?.let { put("periodUnit", it) }
        periodCount?.let { put("periodCount", it) }
        periods?.let { put("periods", it) }
    }

    internal companion object {
        val NONE = FlowRuntimeIntroOffer(kind = "none")
    }
}

/** A yearly difference in price between two subscriptions, formatted as the SDK formats prices it computes. */
data class FlowRuntimeSaving(val amount: Double, val amountString: String)

/**
 * [product]'s introductory offer as a flow reads it, and whether the user can have it now (`null`
 * where not known).
 *
 * A one-time or development-store product has none. For a Play subscription, Play withholds an offer
 * whose eligibility the user does not meet, but returns a developer-determined offer to everyone,
 * without saying which is which; and a product's offers it withheld leave no trace. So the offer the
 * SDK takes as introductory ([selectIntroOffer]) is described, and is known to be one the user can
 * have only when it carries [INTRO_OFFER_TAG], which marks the offer set up in Play for new customers;
 * for an untagged one, which Play returns to every account, whether the user can have it is unknown.
 * Without such an offer the user can have none: what the product offers is unknown, as Play withholds
 * a used new-customer offer, and eligibility is `false`, as it becomes once that offer was taken.
 */
internal fun flowIntroOfferOf(product: VoidhashProduct): Pair<FlowRuntimeIntroOffer?, Boolean?> {
    val subscription = product.subscription
    if (subscription == null || product.store == VoidhashStore.DEVELOPMENT) return FlowRuntimeIntroOffer.NONE to false
    val offer = subscription.introOffer ?: return null to false
    val eligible = if (hasTaggedIntroOffer(product)) true else null
    val phase = offer.phases.firstOrNull() ?: return null to eligible
    val kind = when (phase.paymentMode) {
        VoidhashPaymentMode.FREE_TRIAL -> "free-trial"
        VoidhashPaymentMode.PAY_AS_YOU_GO -> "pay-as-you-go"
        VoidhashPaymentMode.PAY_UP_FRONT -> "pay-up-front"
    }
    return FlowRuntimeIntroOffer(
        kind = kind,
        price = phase.price.amount.toDouble(),
        priceString = phase.price.formatted,
        periodUnit = unitWord(phase.period.unit),
        periodCount = phase.period.count,
        periods = phase.cycles,
    ) to eligible
}

/**
 * Whether Play returned an offer tagged [INTRO_OFFER_TAG] on [product]'s base plan: the one
 * [selectIntroOffer] then takes as its introductory offer.
 */
private fun hasTaggedIntroOffer(product: VoidhashProduct): Boolean {
    val googlePlay = product.googlePlay ?: return false
    return googlePlay.subscriptionOffers.any {
        it.basePlanId == googlePlay.basePlanId && it.offerId != null && INTRO_OFFER_TAG in it.offerTags
    }
}

/**
 * What [product] saves a year against each other subscription of [products] priced in the same
 * currency, by its slug; `null` when none is. Exact: both per-year prices are already rounded to the
 * currency's minor units.
 */
internal fun flowSavingsOf(product: VoidhashProduct, products: List<VoidhashProduct>): Map<String, FlowRuntimeSaving>? {
    val perYear = product.subscription?.pricePerYear?.takeIf { it.currencyCode.isNotEmpty() } ?: return null
    val savings = products
        .filter { it.slug != product.slug }
        .mapNotNull { other ->
            val otherPerYear = other.subscription?.pricePerYear?.takeIf { it.currencyCode == perYear.currencyCode }
                ?: return@mapNotNull null
            val saving = computedPrice(otherPerYear.amount.subtract(perYear.amount), perYear.currencyCode)
            other.slug to FlowRuntimeSaving(saving.amount.toDouble(), saving.formatted)
        }
        .toMap()
    return savings.ifEmpty { null }
}

/**
 * A purchasable product as a flow receives it.
 *
 * @property id the product's slug, which flows name products by.
 * @property period the billing period as text: `month`, `3 months`, `lifetime`; `null` for a
 *   one-time product.
 * @property trialPeriod the length of the free trial the user can get, as text: `1 week`,
 *   `3 days`; `null` without one.
 * @property periodUnit a renewing subscription's billing period, `day`, `week`, `month` or `year`,
 *   [periodCount] of them; `null` for anything else.
 * @property pricePerWeek the regular price per week, as the product's `subscription` computes it, with
 *   its text in [pricePerWeekString]; likewise per month and per year. Subscriptions only.
 * @property introOffer the introductory offer: kind `none` for a one-time or development-store
 *   product; `null` when not known, as for a Play subscription without one (see [flowIntroOfferOf]).
 * @property introEligible whether the user can have the introductory offer now: `true` for an
 *   offer tagged `voidhash-intro`, `null` for an untagged one, `false` when there is none to have.
 * @property savings what the user saves a year with this product against each other configured
 *   subscription in the same currency, by that product's id; negative when this one costs more.
 */
data class FlowRuntimeConfigProduct(
    val id: String,
    val slug: String,
    val displayName: String,
    val description: String?,
    val price: Double?,
    val priceString: String,
    val currencyCode: String?,
    val period: String?,
    val trialPeriod: String? = null,
    val periodUnit: String? = null,
    val periodCount: Int? = null,
    val pricePerWeek: Double? = null,
    val pricePerWeekString: String? = null,
    val pricePerMonth: Double? = null,
    val pricePerMonthString: String? = null,
    val pricePerYear: Double? = null,
    val pricePerYearString: String? = null,
    val introOffer: FlowRuntimeIntroOffer? = null,
    val introEligible: Boolean? = null,
    val savings: Map<String, FlowRuntimeSaving>? = null,
) {
    internal fun toJson(): JSONObject = JSONObject().apply {
        put("id", id)
        put("slug", slug)
        put("displayName", displayName)
        description?.let { put("description", it) }
        price?.let { put("price", it) }
        put("priceString", priceString)
        currencyCode?.let { put("currencyCode", it) }
        period?.let { put("period", it) }
        trialPeriod?.let { put("trialPeriod", it) }
        periodUnit?.let { put("periodUnit", it) }
        periodCount?.let { put("periodCount", it) }
        pricePerWeek?.let { put("pricePerWeek", it) }
        pricePerWeekString?.let { put("pricePerWeekString", it) }
        pricePerMonth?.let { put("pricePerMonth", it) }
        pricePerMonthString?.let { put("pricePerMonthString", it) }
        pricePerYear?.let { put("pricePerYear", it) }
        pricePerYearString?.let { put("pricePerYearString", it) }
        introOffer?.let { put("introOffer", it.toJson()) }
        introEligible?.let { put("introEligible", it) }
        savings?.let { savings ->
            put(
                "savings",
                JSONObject().apply {
                    savings.forEach { (id, saving) ->
                        put(id, JSONObject().put("amount", saving.amount).put("amountString", saving.amountString))
                    }
                },
            )
        }
    }
}

/**
 * The `configure` payload a flow receives once it is on screen.
 *
 * @property capabilities wire names of the capabilities the app granted.
 * @property state variables saved from an earlier presentation of the same flow; `null` when
 *   none are saved.
 * @property input the inputs the app passes the flow, by name.
 * @property place where the end user was when an earlier runtime of this same presentation went
 *   away, as its last `state` message reported it; `null` for a presentation's first runtime.
 *   Sensitive (see [SensitivePlace]): [toString] leaves it out.
 * @property restoresPlace asks the runtime to report where the end user is in every `state`.
 * @property permissions the status of each permission the app lets flows ask for, by name.
 */
data class FlowRuntimeConfig(
    val products: List<FlowRuntimeConfigProduct>,
    val locale: String?,
    val platform: String?,
    val defaultSelectedProductId: String?,
    val capabilities: List<String>,
    val state: JSONObject?,
    val input: JSONObject = JSONObject(),
    val place: JSONObject? = null,
    val restoresPlace: Boolean = false,
    val permissions: Map<String, String> = emptyMap(),
) {
    internal fun toJson(): JSONObject = JSONObject().apply {
        put("products", JSONArray(products.map { it.toJson() }))
        // Flows carry their own defaults; the SDK supplies no values of its own.
        put("variables", JSONObject())
        locale?.let { put("locale", it) }
        platform?.let { put("platform", it) }
        defaultSelectedProductId?.let { put("defaultSelectedProductId", it) }
        put("capabilities", JSONArray(capabilities))
        if (state != null || place != null) {
            put(
                "state",
                JSONObject().apply {
                    state?.let { put("variables", it) }
                    place?.let { put("place", it) }
                },
            )
        }
        put("input", input)
        if (restoresPlace) put("restoresPlace", true)
        if (permissions.isNotEmpty()) put("permissions", JSONObject(permissions))
    }

    override fun toString(): String =
        "FlowRuntimeConfig(products=$products, locale=$locale, platform=$platform, " +
            "defaultSelectedProductId=$defaultSelectedProductId, capabilities=$capabilities, " +
            "state=$state, input=$input, place=${place?.let { "redacted" }}, restoresPlace=$restoresPlace, " +
            "permissions=$permissions)"
}

/**
 * Builds the configuration of a flow whose package references [productIds], from the products
 * resolved in the store. Each id names a product by slug, or failing that by store product id, as
 * packages built before slug references do; ids that did not resolve are skipped (reported through
 * [onSkippedProduct]); an empty product list is valid.
 */
fun buildFlowRuntimeConfig(
    productIds: List<String>,
    products: List<VoidhashProduct>,
    locale: String?,
    capabilities: List<String> = emptyList(),
    state: JSONObject? = null,
    input: JSONObject = JSONObject(),
    place: JSONObject? = null,
    restoresPlace: Boolean = false,
    permissions: Map<String, String> = emptyMap(),
    onSkippedProduct: (String) -> Unit = {},
): FlowRuntimeConfig {
    val resolved = productIds.mapNotNull { reference ->
        findFlowProduct(products, reference).also { if (it == null) onSkippedProduct(reference) }
    }
    val configured = resolved.map {
        val subscription = it.subscription
        val (introOffer, introEligible) = flowIntroOfferOf(it)
        FlowRuntimeConfigProduct(
            id = it.slug,
            slug = it.slug,
            displayName = it.displayName,
            description = it.description.ifEmpty { null },
            price = it.price.amount.toDouble(),
            priceString = it.price.formatted,
            currencyCode = it.price.currencyCode.ifEmpty { null },
            period = flowPeriodOf(it),
            trialPeriod = flowTrialPeriodOf(it),
            periodUnit = subscription?.period?.unit?.let(::unitWord),
            periodCount = subscription?.period?.count,
            pricePerWeek = subscription?.pricePerWeek?.amount?.toDouble(),
            pricePerWeekString = subscription?.pricePerWeek?.formatted,
            pricePerMonth = subscription?.pricePerMonth?.amount?.toDouble(),
            pricePerMonthString = subscription?.pricePerMonth?.formatted,
            pricePerYear = subscription?.pricePerYear?.amount?.toDouble(),
            pricePerYearString = subscription?.pricePerYear?.formatted,
            introOffer = introOffer,
            introEligible = introEligible,
            savings = flowSavingsOf(it, resolved),
        )
    }

    return FlowRuntimeConfig(
        products = configured,
        locale = locale,
        platform = "android",
        defaultSelectedProductId = configured.firstOrNull()?.id,
        capabilities = capabilities,
        state = state,
        input = input,
        place = place,
        permissions = permissions,
        restoresPlace = restoresPlace,
    )
}

/**
 * The product a flow's [reference] names: by slug first, then by store product id, which packages
 * built before slug references name products by. Several products share a store product id when
 * they are base plans of one Play subscription; such a reference resolves to the first.
 */
internal fun findFlowProduct(products: List<VoidhashProduct>, reference: String): VoidhashProduct? =
    products.firstOrNull { it.slug == reference } ?: products.firstOrNull { it.storeProductId == reference }
