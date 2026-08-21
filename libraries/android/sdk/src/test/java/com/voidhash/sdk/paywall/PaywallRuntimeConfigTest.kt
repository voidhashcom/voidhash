package com.voidhash.sdk.paywall

import com.voidhash.core.paywall.PaywallBridge
import com.voidhash.sdk.api.ResolvedPaywall
import com.voidhash.sdk.billing.VoidhashProduct
import org.json.JSONObject
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

internal fun testProduct(
    id: String = "pro_monthly",
    slug: String = "pro-monthly",
    displayPrice: String = "59,99 €",
    billingPeriod: String? = "P1M",
) = VoidhashProduct(
    id = id,
    slug = slug,
    name = "Pro Monthly",
    description = "Pro access",
    displayName = "Pro",
    displayPrice = displayPrice,
    price = 59.99,
    currency = "EUR",
    type = "subs",
    billingPeriod = billingPeriod,
    googlePlayOfferToken = "offer-monthly",
)

internal fun testResolvedPaywall(productSlugs: List<String> = listOf("pro-monthly")) =
    ResolvedPaywall(
        locationSlug = "onboarding",
        htmlUrl = "https://cdn.voidhash.com/pw.html",
        releaseId = "rel_1",
        productSlugs = productSlugs,
        variables = mapOf("headline" to "Go Pro"),
    )

class PaywallRuntimeConfigTest {
    @Test
    fun `maps ISO-8601 billing periods`() {
        assertEquals("month", mapStoreIntervalToPeriod("P1M"))
        assertEquals("year", mapStoreIntervalToPeriod("P1Y"))
        assertEquals("week", mapStoreIntervalToPeriod("P1W"))
        assertEquals("week", mapStoreIntervalToPeriod("P7D"))
    }

    @Test
    fun `maps keyword variants case-insensitively`() {
        assertEquals("month", mapStoreIntervalToPeriod(" Monthly "))
        assertEquals("year", mapStoreIntervalToPeriod("ANNUAL"))
        assertEquals("lifetime", mapStoreIntervalToPeriod("lifetime"))
    }

    @Test
    fun `unknown and missing intervals map to null`() {
        assertNull(mapStoreIntervalToPeriod(null))
        assertNull(mapStoreIntervalToPeriod(""))
        assertNull(mapStoreIntervalToPeriod("P3D"))
    }

    @Test
    fun `builds the runtime config from store products`() {
        val config = buildPaywallRuntimeConfig(
            paywall = testResolvedPaywall(),
            productsBySlug = mapOf("pro-monthly" to testProduct()),
            locale = "de-DE",
        )

        assertEquals(1, config.products.size)
        assertEquals("pro_monthly", config.defaultSelectedProductId)
        assertEquals("android", config.platform)
        assertEquals("de-DE", config.locale)
        assertEquals("Go Pro", config.variables["headline"])

        val product = config.products.single()
        assertEquals("pro-monthly", product.slug)
        assertEquals("59,99 €", product.priceString)
        assertEquals("EUR", product.currencyCode)
        assertEquals("month", product.period)
        assertNull(product.trialPeriod)
    }

    @Test
    fun `a trial period is omitted from the wire until the store maps one`() {
        val config = buildPaywallRuntimeConfig(
            paywall = testResolvedPaywall(),
            productsBySlug = mapOf("pro-monthly" to testProduct()),
            locale = null,
        )

        val product = JSONObject(PaywallEnvelope.configureMessage(config))
            .getJSONObject("payload")
            .getJSONArray("products")
            .getJSONObject(0)

        assertFalse(product.has("trialPeriod"))
        assertEquals(
            "P1W",
            config.products.single().copy(trialPeriod = "P1W").toJson().getString("trialPeriod"),
        )
    }

    @Test
    fun `unresolved product slugs are reported and skipped`() {
        val skipped = mutableListOf<String>()

        val config = buildPaywallRuntimeConfig(
            paywall = testResolvedPaywall(listOf("pro-monthly", "pro-annual")),
            productsBySlug = mapOf("pro-monthly" to testProduct()),
            locale = null,
            onSkippedProductSlug = skipped::add,
        )

        assertEquals(listOf("pro-annual"), skipped)
        assertEquals(1, config.products.size)
        assertNull(config.locale)
    }

    @Test
    fun `the configure envelope is ASCII-safe`() {
        val message = PaywallEnvelope.configureMessage(
            buildPaywallRuntimeConfig(
                paywall = testResolvedPaywall(),
                productsBySlug = mapOf("pro-monthly" to testProduct()),
                locale = null,
            ),
        )

        assertTrue(message.all { it.code < 0x80 })
        assertTrue(message.contains("\\u20ac"))

        val decoded = JSONObject(message)
        assertEquals("configure", decoded.getString("type"))
        assertEquals(PaywallBridge.VERSION, decoded.getInt("version"))
        assertEquals(
            "59,99 €",
            decoded.getJSONObject("payload").getJSONArray("products").getJSONObject(0)
                .getString("priceString"),
        )
    }

    @Test
    fun `the inbound delivery script round-trips localized prices`() {
        val message = PaywallEnvelope.statusMessage("failed", error = "59,99 €")
        val script = PaywallBridge.inboundScript(message)

        assertTrue(script.startsWith("(function(){const d=atob('"))
        assertTrue(script.all { it.code < 0x80 })
        assertFalse(script.contains("€"))
    }
}
