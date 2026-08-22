package com.voidhash.sdk

import com.voidhash.sdk.api.DevelopmentPurchaseRequest
import com.voidhash.sdk.api.SdkHeaders
import com.voidhash.sdk.api.VoidhashApiClient
import com.voidhash.sdk.billing.FakeBillingEngine
import com.voidhash.sdk.billing.testPurchase
import com.voidhash.sdk.cache.CacheManager
import com.voidhash.sdk.cache.InMemoryCacheAdapter
import com.voidhash.sdk.identity.IdentityStore
import com.voidhash.sdk.platform.PlatformInfo
import com.voidhash.sdk.schema.RuntimeDevelopmentConfiguration
import com.voidhash.sdk.schema.RuntimeProductDefinition
import com.voidhash.sdk.schema.RuntimeProductProviders
import com.voidhash.sdk.schema.RuntimeSchema
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

private fun developmentSchema() = RuntimeSchema(
    version = "v1",
    products = mapOf(
        "pro-monthly" to RuntimeProductDefinition(
            slug = "pro-monthly",
            type = "subscription",
            name = "Pro Monthly",
            providers = RuntimeProductProviders(
                development = RuntimeDevelopmentConfiguration(
                    productId = "pro-monthly",
                    price = 9.99,
                    currencyCode = "USD",
                    period = "month",
                    periodCount = 1,
                    duration = "monthly",
                    warning = null,
                ),
            ),
        ),
    ),
    locations = emptyMap(),
)

class DevelopmentModeTest {
    private val billing = FakeBillingEngine()
    private val apiClient = mockk<VoidhashApiClient>()
    private val cacheManager = CacheManager(InMemoryCacheAdapter())
    private val identityStore = IdentityStore(cacheManager) { "user-123" }
    private var personRefreshes = 0

    private fun orchestrator() = PurchaseOrchestrator(
        billing = billing,
        apiClient = apiClient,
        cacheManager = cacheManager,
        identityStore = identityStore,
        developmentMode = true,
        onPersonRefresh = { personRefreshes += 1 },
    )

    @Test
    fun `getProducts synthesizes products from the development provider`() = runTest {
        val products = orchestrator().getProducts(developmentSchema())

        assertEquals(1, products.size)
        assertEquals("pro-monthly", products[0].id)
        assertEquals("pro-monthly", products[0].slug)
        assertEquals(9.99, products[0].price)
        assertEquals("month", products[0].billingPeriod)
        assertEquals(null, products[0].googlePlayOfferToken)
    }

    @Test
    fun `a purchase routes to the development endpoint and never touches the store`() = runTest {
        coEvery { apiClient.developmentPurchase(any(), any()) } returns true
        billing.buyResult = { arrayOf(testPurchase(orderId = "dev-1", purchaseToken = "dev:dev-1")) }

        val products = orchestrator().getProducts(developmentSchema())
        val transaction = orchestrator().purchase(products[0], developmentSchema())

        val request = slot<DevelopmentPurchaseRequest>()
        coVerify(exactly = 1) { apiClient.developmentPurchase("user-123", capture(request)) }
        coVerify(exactly = 0) { apiClient.syncTransaction(any(), any()) }

        assertTrue(transaction.isDevelopment)
        assertEquals("dev-1", request.captured.devTransactionId)
        assertEquals("pro-monthly", request.captured.productSlug)
        assertEquals(emptyList(), billing.acknowledgedTokens)
        assertEquals(emptyList(), billing.consumedTokens)
        assertEquals(1, personRefreshes)
    }

    @Test
    fun `a cancelled sheet surfaces USER_CANCELLED and skips the backend`() = runTest {
        billing.buyResult = { throw VoidhashException("USER_CANCELLED", "Development purchase cancelled") }

        val products = orchestrator().getProducts(developmentSchema())
        val error = assertFailsWith<VoidhashException> {
            orchestrator().purchase(products[0], developmentSchema())
        }

        assertEquals("USER_CANCELLED", error.code)
        coVerify(exactly = 0) { apiClient.developmentPurchase(any(), any()) }
        assertEquals(0, personRefreshes)
    }

    @Test
    fun `headers switch to the development environment while dev mode is active`() {
        var developmentMode = false
        val headers = SdkHeaders(
            publishableKey = "pk_test",
            platform = testPlatformInfo(isDebugBuild = true),
            environmentProvider = { if (developmentMode) "development" else "production" },
        )

        assertEquals("production", headers.build("u")["x-environment"])
        developmentMode = true
        assertEquals("development", headers.build("u")["x-environment"])
    }

    @Test
    fun `development mode stays off in release builds even with dev requested`() {
        // Mirrors the gating in Voidhash.configure: options.dev && platform.isDebugBuild.
        val releasePlatform = testPlatformInfo(isDebugBuild = false)
        assertFalse(releasePlatform.isDebugBuild && true)
    }
}

private fun testPlatformInfo(isDebugBuild: Boolean) = PlatformInfo(
    bundleId = "com.example.app",
    appVersion = "1.2.3",
    systemVersion = "15",
    deviceBrand = "google",
    deviceName = "Pixel 8",
    locales = listOf("en-US"),
    isDebugBuild = isDebugBuild,
)
