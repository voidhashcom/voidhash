package com.voidhash.sdk

import com.voidhash.core.billing.BillingProductType
import com.voidhash.sdk.api.SyncTransactionRequest
import com.voidhash.sdk.api.VoidhashApiClient
import com.voidhash.sdk.billing.FakeBillingEngine
import com.voidhash.sdk.billing.billingResult
import com.voidhash.sdk.billing.mapBillingPurchaseToTransaction
import com.voidhash.sdk.billing.testOneTimeDetail
import com.voidhash.sdk.billing.testPurchase
import com.voidhash.sdk.billing.testSubscriptionDetail
import com.voidhash.sdk.cache.CacheManager
import com.voidhash.sdk.cache.InMemoryCacheAdapter
import com.voidhash.sdk.identity.IdentityStore
import com.voidhash.sdk.schema.RuntimeGooglePlayConfiguration
import com.voidhash.sdk.schema.RuntimeProductDefinition
import com.voidhash.sdk.schema.RuntimeProductProviders
import com.voidhash.sdk.schema.RuntimeSchema
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.async
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

private fun schema(vararg products: RuntimeProductDefinition) = RuntimeSchema(
    version = "v1",
    products = products.associateBy { it.slug },
    locations = emptyMap(),
)

private fun subscriptionDefinition(basePlanId: String? = "monthly") = RuntimeProductDefinition(
    slug = "pro-monthly",
    type = "subscription",
    name = "Pro Monthly",
    providers = RuntimeProductProviders(
        googlePlay = RuntimeGooglePlayConfiguration("pro_monthly", basePlanId),
    ),
)

private val consumableDefinition = RuntimeProductDefinition(
    slug = "coins",
    type = "one-time-consumable",
    name = "Coins",
    providers = RuntimeProductProviders(googlePlay = RuntimeGooglePlayConfiguration("coins", null)),
)

class PurchaseOrchestratorTest {
    private val billing = FakeBillingEngine()
    private val apiClient = mockk<VoidhashApiClient>()
    private val cacheManager = CacheManager(InMemoryCacheAdapter())
    private val identityStore = IdentityStore(cacheManager) { "user-123" }
    private var readOnly = false
    private var personRefreshes = 0

    private fun orchestrator() = PurchaseOrchestrator(
        billing = billing,
        apiClient = apiClient,
        cacheManager = cacheManager,
        identityStore = identityStore,
        readOnlyProvider = { readOnly },
        onPersonRefresh = { personRefreshes += 1 },
    )

    @Test
    fun `getProducts selects the offer token matching the configured base plan`() = runTest {
        billing.productsByType = mapOf(
            BillingProductType.SUBS to listOf(testSubscriptionDetail()),
            BillingProductType.INAPP to emptyList(),
        )

        val products = orchestrator().getProducts(schema(subscriptionDefinition("annual")))

        assertEquals(1, products.size)
        assertEquals("offer-annual", products[0].googlePlayOfferToken)
        assertEquals("P1Y", products[0].billingPeriod)
        assertEquals("pro-monthly", products[0].slug)
        assertEquals("59,99 €", products[0].displayPrice)
        assertEquals(5999.0, products[0].price)
    }

    @Test
    fun `getProducts falls back to the first offer when no base plan is configured`() = runTest {
        billing.productsByType = mapOf(
            BillingProductType.SUBS to listOf(testSubscriptionDetail()),
            BillingProductType.INAPP to emptyList(),
        )

        val products = orchestrator().getProducts(schema(subscriptionDefinition(basePlanId = null)))

        assertEquals("offer-monthly", products[0].googlePlayOfferToken)
    }

    @Test
    fun `a successful purchase syncs and acknowledges`() = runTest {
        coEvery { apiClient.syncTransaction(any(), any()) } returns true
        billing.buyResult = { arrayOf(testPurchase()) }

        val transaction = orchestrator().purchase(
            product(basePlanId = "monthly"),
            schema(subscriptionDefinition()),
        )

        val request = slot<SyncTransactionRequest>()
        coVerify(exactly = 1) { apiClient.syncTransaction("user-123", capture(request)) }

        assertEquals("GPA.1", transaction.transactionId)
        assertEquals("pro-monthly", request.captured.productSlug)
        assertEquals("pro_monthly", request.captured.providerProductId)
        assertEquals("token-1", request.captured.purchaseToken)
        assertEquals(listOf("token-1"), billing.acknowledgedTokens)
        assertEquals(1, personRefreshes)
        assertEquals(
            "3501e751-7582-58f9-9c1d-533c7466049f",
            billing.buyParams.single().obfuscatedAccountId,
        )
        assertEquals(listOf("offer-monthly"), billing.buyParams.single().offerTokenArr?.toList())
    }

    @Test
    fun `a consumable purchase is consumed instead of acknowledged`() = runTest {
        coEvery { apiClient.syncTransaction(any(), any()) } returns true
        billing.buyResult = { arrayOf(testPurchase(productId = "coins")) }

        orchestrator().purchase(
            product(id = "coins", slug = "coins", type = "inapp", offerToken = null),
            schema(consumableDefinition),
        )

        assertEquals(listOf("token-1"), billing.consumedTokens)
        assertTrue(billing.acknowledgedTokens.isEmpty())
    }

    @Test
    fun `observer mode syncs but never finishes with the store`() = runTest {
        readOnly = true
        coEvery { apiClient.syncTransaction(any(), any()) } returns true

        orchestrator().processTransaction(
            mapBillingPurchaseToTransaction(testPurchase()),
            schema(subscriptionDefinition()),
            readOnlyOverride = null,
        )

        coVerify(exactly = 1) { apiClient.syncTransaction(any(), any()) }
        assertTrue(billing.acknowledgedTokens.isEmpty())
    }

    @Test
    fun `a purchase started in owner mode finishes even if read-only flips mid-flight`() = runTest {
        coEvery { apiClient.syncTransaction(any(), any()) } returns true
        billing.buyResult = {
            readOnly = true
            arrayOf(testPurchase())
        }

        orchestrator().purchase(product(), schema(subscriptionDefinition()))

        assertEquals(listOf("token-1"), billing.acknowledgedTokens)
    }

    @Test
    fun `an already processed transaction is not synced again`() = runTest {
        coEvery { apiClient.syncTransaction(any(), any()) } returns true
        val orchestrator = orchestrator()
        val transaction = mapBillingPurchaseToTransaction(testPurchase())

        orchestrator.processTransaction(transaction, schema(subscriptionDefinition()), null)
        orchestrator.processTransaction(transaction, schema(subscriptionDefinition()), null)

        coVerify(exactly = 1) { apiClient.syncTransaction(any(), any()) }
        assertEquals(listOf("token-1"), billing.acknowledgedTokens)
    }

    @Test
    fun `concurrent processing of the same transaction is coalesced`() = runTest {
        val gate = CompletableDeferred<Unit>()
        coEvery { apiClient.syncTransaction(any(), any()) } coAnswers {
            gate.await()
            true
        }

        val orchestrator = orchestrator()
        val transaction = mapBillingPurchaseToTransaction(testPurchase())
        val schema = schema(subscriptionDefinition())

        val first = launch { orchestrator.processTransaction(transaction, schema, null) }
        testScheduler.runCurrent()
        val second = launch { orchestrator.processTransaction(transaction, schema, null) }
        testScheduler.runCurrent()

        gate.complete(Unit)
        first.join()
        second.join()

        coVerify(exactly = 1) { apiClient.syncTransaction(any(), any()) }
        assertEquals(listOf("token-1"), billing.acknowledgedTokens)
    }

    @Test
    fun `a joining caller sees the failure of the run it coalesced onto`() = runTest {
        val gate = CompletableDeferred<Unit>()
        coEvery { apiClient.syncTransaction(any(), any()) } coAnswers {
            gate.await()
            throw VoidhashNetworkException("sync failed")
        }

        val orchestrator = orchestrator()
        val transaction = mapBillingPurchaseToTransaction(testPurchase())
        val schema = schema(subscriptionDefinition())

        val observer = async {
            runCatching { orchestrator.processTransaction(transaction, schema, null) }
        }
        testScheduler.runCurrent()
        val purchaser = async {
            runCatching { orchestrator.processTransaction(transaction, schema, false) }
        }
        testScheduler.runCurrent()

        gate.complete(Unit)

        assertTrue(observer.await().isFailure)
        val joined = purchaser.await()
        assertTrue(joined.isFailure)
        assertEquals("NETWORK_ERROR: sync failed", joined.exceptionOrNull()?.message)
        assertTrue(billing.acknowledgedTokens.isEmpty())
    }

    @Test
    fun `a cancelled run does not resolve joiners as success`() = runTest {
        val gate = CompletableDeferred<Unit>()
        coEvery { apiClient.syncTransaction(any(), any()) } coAnswers {
            gate.await()
            true
        }

        val orchestrator = orchestrator()
        val transaction = mapBillingPurchaseToTransaction(testPurchase())
        val schema = schema(subscriptionDefinition())

        val owner = launch { orchestrator.processTransaction(transaction, schema, null) }
        testScheduler.runCurrent()
        val joiner = async {
            runCatching { orchestrator.processTransaction(transaction, schema, null) }
        }
        testScheduler.runCurrent()

        owner.cancel()
        testScheduler.runCurrent()

        assertTrue(joiner.await().isFailure)
        assertTrue(billing.acknowledgedTokens.isEmpty())
    }

    @Test
    fun `a rejected transaction is never finished with the store`() = runTest {
        coEvery { apiClient.syncTransaction(any(), any()) } returns false

        val error = assertFailsWith<VoidhashException> {
            orchestrator().processTransaction(
                mapBillingPurchaseToTransaction(testPurchase()),
                schema(subscriptionDefinition()),
                null,
            )
        }

        assertEquals("TRANSACTION_VERIFICATION_FAILED", error.code)
        assertTrue(billing.acknowledgedTokens.isEmpty())
    }

    @Test
    fun `a failed reconcile reports RECONCILE_TRANSACTIONS_FAILED`() = runTest {
        coEvery { apiClient.syncTransaction(any(), any()) } returns false
        billing.ownedByType = mapOf(
            BillingProductType.SUBS to listOf(testPurchase()),
            BillingProductType.INAPP to emptyList(),
        )

        val error = assertFailsWith<VoidhashException> {
            orchestrator().reconcileObservedTransactions(schema(subscriptionDefinition()))
        }

        assertEquals("RECONCILE_TRANSACTIONS_FAILED", error.code)
        assertEquals(
            "RECONCILE_TRANSACTIONS_FAILED: Failed to restore 1 transactions",
            error.message,
        )
    }

    @Test
    fun `a person refresh failure does not fail an acknowledged purchase`() = runTest {
        coEvery { apiClient.syncTransaction(any(), any()) } returns true
        billing.buyResult = { arrayOf(testPurchase()) }
        val warnings = mutableListOf<String>()
        val orchestrator = PurchaseOrchestrator(
            billing = billing,
            apiClient = apiClient,
            cacheManager = cacheManager,
            identityStore = identityStore,
            onPersonRefresh = { throw VoidhashNetworkException("person offline") },
            onWarning = warnings::add,
        )

        val transaction = orchestrator.purchase(product(), schema(subscriptionDefinition()))

        assertEquals("GPA.1", transaction.transactionId)
        assertEquals(listOf("token-1"), billing.acknowledgedTokens)
        assertEquals(1, warnings.size)
    }

    @Test
    fun `a failed acknowledge surfaces the billing error`() = runTest {
        coEvery { apiClient.syncTransaction(any(), any()) } returns true
        billing.acknowledgeResult = billingResult(6.0, "Billing error")

        val error = assertFailsWith<VoidhashException> {
            orchestrator().processTransaction(
                mapBillingPurchaseToTransaction(testPurchase()),
                schema(subscriptionDefinition()),
                null,
            )
        }

        assertEquals("BILLING_ERROR: Billing error", error.message)
    }

    @Test
    fun `pending transactions are ignored`() = runTest {
        orchestrator().processTransaction(
            mapBillingPurchaseToTransaction(testPurchase(purchaseState = 2.0)),
            schema(subscriptionDefinition()),
            null,
        )

        coVerify(exactly = 0) { apiClient.syncTransaction(any(), any()) }
    }

    @Test
    fun `transactions without a purchase token are skipped`() = runTest {
        val warnings = mutableListOf<String>()
        val orchestrator = PurchaseOrchestrator(
            billing = billing,
            apiClient = apiClient,
            cacheManager = cacheManager,
            identityStore = identityStore,
            onWarning = warnings::add,
        )

        orchestrator.processTransaction(
            mapBillingPurchaseToTransaction(testPurchase(purchaseToken = "")),
            schema(subscriptionDefinition()),
            null,
        )

        coVerify(exactly = 0) { apiClient.syncTransaction(any(), any()) }
        assertEquals(1, warnings.size)
    }

    @Test
    fun `restore reconciles owned items and skips consumables`() = runTest {
        coEvery { apiClient.syncTransaction(any(), any()) } returns true
        billing.ownedByType = mapOf(
            BillingProductType.SUBS to listOf(testPurchase()),
            BillingProductType.INAPP to listOf(
                testPurchase(productId = "coins", orderId = "GPA.2", purchaseToken = "token-2"),
            ),
        )

        orchestrator().restorePurchases(schema(subscriptionDefinition(), consumableDefinition))

        coVerify(exactly = 1) { apiClient.syncTransaction(any(), any()) }
        assertEquals(listOf("token-1"), billing.acknowledgedTokens)
        assertTrue(billing.consumedTokens.isEmpty())
        assertEquals(1, personRefreshes)
    }

    @Test
    fun `already acknowledged transactions are synced but not re-acknowledged`() = runTest {
        coEvery { apiClient.syncTransaction(any(), any()) } returns true

        orchestrator().processTransaction(
            mapBillingPurchaseToTransaction(testPurchase(isAcknowledged = true)),
            schema(subscriptionDefinition()),
            null,
        )

        coVerify(exactly = 1) { apiClient.syncTransaction(any(), any()) }
        assertTrue(billing.acknowledgedTokens.isEmpty())
    }

    @Test
    fun `one-time products are queried too`() = runTest {
        billing.productsByType = mapOf(
            BillingProductType.INAPP to listOf(testOneTimeDetail(id = "coins")),
            BillingProductType.SUBS to emptyList(),
        )

        val products = orchestrator().getProducts(schema(consumableDefinition))

        assertEquals("coins", products.single().id)
        assertEquals(99.0, products.single().price)
        assertEquals(null, products.single().googlePlayOfferToken)
    }

    private fun product(
        id: String = "pro_monthly",
        slug: String = "pro-monthly",
        type: String = "subs",
        offerToken: String? = "offer-monthly",
        basePlanId: String? = "monthly",
    ) = com.voidhash.sdk.billing.VoidhashProduct(
        id = id,
        slug = slug,
        name = "Pro Monthly",
        description = "Pro access",
        displayName = "Pro",
        displayPrice = "59,99 €",
        price = 59.99,
        currency = "EUR",
        type = type,
        billingPeriod = basePlanId?.let { "P1M" },
        googlePlayOfferToken = offerToken,
    )
}
