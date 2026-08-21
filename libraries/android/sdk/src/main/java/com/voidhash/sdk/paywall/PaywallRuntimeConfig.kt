package com.voidhash.sdk.paywall

import com.voidhash.sdk.api.ResolvedPaywall
import com.voidhash.sdk.billing.VoidhashProduct
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale

private val PERIOD_BY_NORMALIZED_INTERVAL: Map<String, String> = mapOf(
    // ISO-8601 billing periods (Play Billing `billingPeriod`).
    "p1m" to "month",
    "p1y" to "year",
    "p1w" to "week",
    "p7d" to "week",
    // Keyword variants seen across store SDK surfaces.
    "month" to "month",
    "monthly" to "month",
    "year" to "year",
    "yearly" to "year",
    "annual" to "year",
    "week" to "week",
    "weekly" to "week",
    "lifetime" to "lifetime",
)

/**
 * Maps a native store billing-interval string (Play Billing ISO-8601
 * `billingPeriod`) to the paywall contract §7.1 period union. Returns `null`
 * for unknown or missing intervals — `period` is optional on the wire.
 */
fun mapStoreIntervalToPeriod(interval: String?): String? {
    if (interval.isNullOrBlank()) {
        return null
    }
    return PERIOD_BY_NORMALIZED_INTERVAL[interval.trim().lowercase(Locale.US)]
}

/**
 * A purchasable product as surfaced to a paywall bundle (contract §7.1).
 *
 * @property trialPeriod ISO-8601 free-trial duration; always `null` until the
 *   Play Billing free-trial pricing phase is mapped.
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

/** Everything a paywall bundle needs at runtime beyond its own tree (contract §7.1). */
data class PaywallRuntimeConfig(
    val products: List<PaywallRuntimeConfigProduct>,
    val variables: Map<String, Any?>,
    val locale: String?,
    val platform: String?,
    val defaultSelectedProductId: String?,
) {
    internal fun toJson(): JSONObject = JSONObject().apply {
        put("products", JSONArray(products.map { it.toJson() }))
        put("variables", JSONObject(variables.mapValues { it.value ?: JSONObject.NULL }))
        locale?.let { put("locale", it) }
        platform?.let { put("platform", it) }
        defaultSelectedProductId?.let { put("defaultSelectedProductId", it) }
    }
}

/**
 * Builds the runtime config for [paywall] from the products resolved in the
 * store. Product slugs that didn't resolve are skipped (reported through
 * [onSkippedProductSlug]); an empty product list is valid.
 */
fun buildPaywallRuntimeConfig(
    paywall: ResolvedPaywall,
    productsBySlug: Map<String, VoidhashProduct>,
    locale: String?,
    onSkippedProductSlug: (String) -> Unit = {},
): PaywallRuntimeConfig {
    val products = mutableListOf<PaywallRuntimeConfigProduct>()

    for (slug in paywall.productSlugs) {
        val product = productsBySlug[slug]
        if (product == null) {
            onSkippedProductSlug(slug)
            continue
        }

        products.add(
            PaywallRuntimeConfigProduct(
                id = product.id,
                slug = product.slug,
                displayName = product.displayName,
                description = product.description.ifEmpty { null },
                price = product.price.takeUnless { it.isNaN() || it.isInfinite() },
                priceString = product.displayPrice,
                currencyCode = product.currency.ifEmpty { null },
                period = mapStoreIntervalToPeriod(product.billingPeriod),
            ),
        )
    }

    return PaywallRuntimeConfig(
        products = products,
        variables = paywall.variables,
        locale = locale,
        platform = "android",
        defaultSelectedProductId = products.firstOrNull()?.id,
    )
}
