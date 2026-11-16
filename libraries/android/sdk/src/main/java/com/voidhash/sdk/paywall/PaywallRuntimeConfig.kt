package com.voidhash.sdk.paywall

import com.voidhash.sdk.billing.VoidhashPaymentMode
import com.voidhash.sdk.billing.VoidhashPeriod
import com.voidhash.sdk.billing.VoidhashPeriodUnit
import com.voidhash.sdk.billing.VoidhashProduct
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
 * A purchasable product as a flow receives it.
 *
 * @property id the product's slug, which flows name products by.
 * @property period the billing period as text: `month`, `3 months`, `lifetime`; `null` for a
 *   one-time product.
 * @property trialPeriod the length of the free trial the user can get, as text: `1 week`,
 *   `3 days`; `null` without one.
 */
data class PaywallRuntimeConfigProduct(
    val id: String,
    val slug: String,
    val displayName: String,
    val description: String?,
    val price: Double?,
    val priceString: String,
    val currencyCode: String?,
    val period: String?,
    val trialPeriod: String? = null,
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
    }
}

/**
 * The `configure` payload a flow receives once it is on screen.
 *
 * @property capabilities wire names of the capabilities the app granted.
 * @property state variables saved from an earlier presentation of the same flow; `null` when
 *   none are saved.
 */
data class PaywallRuntimeConfig(
    val products: List<PaywallRuntimeConfigProduct>,
    val locale: String?,
    val platform: String?,
    val defaultSelectedProductId: String?,
    val capabilities: List<String>,
    val state: JSONObject?,
) {
    internal fun toJson(): JSONObject = JSONObject().apply {
        put("products", JSONArray(products.map { it.toJson() }))
        // Flows carry their own defaults; the SDK supplies no values of its own.
        put("variables", JSONObject())
        locale?.let { put("locale", it) }
        platform?.let { put("platform", it) }
        defaultSelectedProductId?.let { put("defaultSelectedProductId", it) }
        put("capabilities", JSONArray(capabilities))
        state?.let { put("state", JSONObject().put("variables", it)) }
    }
}

/**
 * Builds the configuration of a flow whose package references [productIds], from the products
 * resolved in the store. Each id names a product by slug, or failing that by store product id, as
 * packages built before slug references do; ids that did not resolve are skipped (reported through
 * [onSkippedProduct]); an empty product list is valid.
 */
fun buildPaywallRuntimeConfig(
    productIds: List<String>,
    products: List<VoidhashProduct>,
    locale: String?,
    capabilities: List<String> = emptyList(),
    state: JSONObject? = null,
    onSkippedProduct: (String) -> Unit = {},
): PaywallRuntimeConfig {
    val configured = productIds.mapNotNull { reference ->
        val product = findFlowProduct(products, reference)
        if (product == null) onSkippedProduct(reference)
        product?.let {
            PaywallRuntimeConfigProduct(
                id = it.slug,
                slug = it.slug,
                displayName = it.displayName,
                description = it.description.ifEmpty { null },
                price = it.price.amount.toDouble(),
                priceString = it.price.formatted,
                currencyCode = it.price.currencyCode.ifEmpty { null },
                period = flowPeriodOf(it),
                trialPeriod = flowTrialPeriodOf(it),
            )
        }
    }

    return PaywallRuntimeConfig(
        products = configured,
        locale = locale,
        platform = "android",
        defaultSelectedProductId = configured.firstOrNull()?.id,
        capabilities = capabilities,
        state = state,
    )
}

/**
 * The product a flow's [reference] names: by slug first, then by store product id, which packages
 * built before slug references name products by. Several products share a store product id when
 * they are base plans of one Play subscription; such a reference resolves to the first.
 */
internal fun findFlowProduct(products: List<VoidhashProduct>, reference: String): VoidhashProduct? =
    products.firstOrNull { it.slug == reference } ?: products.firstOrNull { it.storeProductId == reference }
