package com.voidhash.core.billing

import android.app.Activity
import android.content.Context
import android.text.TextUtils
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.ProductDetailsResponseListener
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesResponseListener
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryProductDetailsResult
import com.android.billingclient.api.QueryPurchasesParams
import io.mockk.every
import io.mockk.mockk
import io.mockk.mockkStatic
import io.mockk.slot
import io.mockk.unmockkStatic
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.async
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Before
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
class BillingEngineTest {
    /**
     * `BillingFlowParams` validates its inputs through `TextUtils`, which is a
     * stubbed no-op in local unit tests, so it is routed to the real semantics.
     */
    @Before
    fun stubTextUtils() {
        mockkStatic(TextUtils::class)
        every { TextUtils.isEmpty(any()) } answers { firstArg<CharSequence?>().isNullOrEmpty() }
    }

    @After
    fun unstubTextUtils() {
        unmockkStatic(TextUtils::class)
    }

    private val activity = mockk<Activity>(relaxed = true)
    private val context = mockk<Context>(relaxed = true)
    private val billingClient = mockk<BillingClient>(relaxed = true)
    private var listener: PurchasesUpdatedListener? = null
    private var stateListener: BillingClientStateListener? = null
    private val warnings = mutableListOf<String>()

    private fun createEngine(
        contextProvider: () -> Context? = { context },
        activityProvider: () -> Activity? = { activity },
    ): BillingEngine =
        BillingEngine(
            contextProvider = contextProvider,
            activityProvider = activityProvider,
            billingClientFactory = { _, purchasesUpdatedListener ->
                listener = purchasesUpdatedListener
                billingClient
            },
            onWarning = warnings::add,
        )

    private fun billingResult(responseCode: Int, debugMessage: String = ""): BillingResult =
        BillingResult.newBuilder()
            .setResponseCode(responseCode)
            .setDebugMessage(debugMessage)
            .build()

    private fun stubConnection() {
        every { billingClient.isReady } returns true
        every { billingClient.startConnection(any()) } answers {
            stateListener = firstArg()
            stateListener!!.onBillingSetupFinished(billingResult(BillingClient.BillingResponseCode.OK))
        }
    }

    private fun stubProductQuery(productId: String) {
        val oneTimeOffer = mockk<ProductDetails.OneTimePurchaseOfferDetails>(relaxed = true) {
            every { priceCurrencyCode } returns "EUR"
            every { formattedPrice } returns "59,99 €"
            every { priceAmountMicros } returns 59_990_000L
        }
        val productDetails = mockk<ProductDetails>(relaxed = true) {
            every { this@mockk.productId } returns productId
            every { title } returns "Pro"
            every { description } returns "Pro plan"
            every { productType } returns BillingClient.ProductType.INAPP
            every { name } returns "Pro"
            every { oneTimePurchaseOfferDetails } returns oneTimeOffer
            every { subscriptionOfferDetails } returns null
        }
        val queryResult = mockk<QueryProductDetailsResult>(relaxed = true) {
            every { productDetailsList } returns listOf(productDetails)
        }

        every { billingClient.queryProductDetailsAsync(any<QueryProductDetailsParams>(), any()) } answers {
            secondArg<ProductDetailsResponseListener>().onProductDetailsResponse(
                billingResult(BillingClient.BillingResponseCode.OK),
                queryResult,
            )
        }
    }

    private fun purchase(productId: String, purchaseToken: String = "token-1"): Purchase =
        mockk<Purchase>(relaxed = true) {
            every { products } returns listOf(productId)
            every { this@mockk.purchaseToken } returns purchaseToken
            every { orderId } returns "order-1"
            every { isAutoRenewing } returns true
            every { isAcknowledged } returns false
        }

    @Test
    fun `init fails when no context is available`() = runTest {
        val engine = createEngine(contextProvider = { null })

        val error = assertFailsWith<Error> { engine.initConnection() }
        assertEquals(
            "GOOGLE_BILLING_NOT_INITIALIZED: Google Billing connection not initialized",
            error.message,
        )
    }

    @Test
    fun `init fails when play services are unavailable`() = runTest {
        val engine = BillingEngine(
            contextProvider = { context },
            activityProvider = { activity },
            isPlayServicesAvailable = { false },
            billingClientFactory = { _, _ -> billingClient },
        )

        val error = assertFailsWith<Error> { engine.initConnection() }
        assertEquals(
            "GOOGLE_BILLING_NOT_INITIALIZED: Google Billing connection not initialized",
            error.message,
        )
    }

    @Test
    fun `init fails when the billing setup reports a failure`() = runTest {
        every { billingClient.isReady } returns false
        every { billingClient.startConnection(any()) } answers {
            firstArg<BillingClientStateListener>()
                .onBillingSetupFinished(billingResult(BillingClient.BillingResponseCode.BILLING_UNAVAILABLE))
        }
        val engine = createEngine()

        val error = assertFailsWith<Error> { engine.initConnection() }
        assertEquals(
            "GOOGLE_BILLING_NOT_INITIALIZED: Google Billing connection initialization failed",
            error.message,
        )
    }

    @Test
    fun `buy fails when there is no current activity`() = runTest {
        stubConnection()
        val engine = createEngine(activityProvider = { null })
        engine.initConnection()

        val error = assertFailsWith<Error> {
            engine.buyItemByType(BillingBuyItemParams(BillingProductType.INAPP, arrayOf("pro")))
        }
        assertEquals("CURRENT_ACTIVITY_NULL: Current activity returned null", error.message)
    }

    @Test
    fun `buy resolves with the purchases delivered through the listener`() = runTest {
        stubConnection()
        stubProductQuery("pro")
        val launched = slot<BillingFlowParams>()
        every { billingClient.launchBillingFlow(activity, capture(launched)) } returns
            billingResult(BillingClient.BillingResponseCode.OK)

        val observed = mutableListOf<BillingPurchase>()
        val engine = createEngine()
        engine.initConnection { observed += it }
        engine.getItemsByType(BillingProductType.INAPP, arrayOf("pro"))

        val purchases = async {
            runCatching {
                engine.buyItemByType(BillingBuyItemParams(BillingProductType.INAPP, arrayOf("pro")))
            }
        }
        runCurrent()

        listener!!.onPurchasesUpdated(
            billingResult(BillingClient.BillingResponseCode.OK),
            listOf(purchase("pro")),
        )

        val result = purchases.await().getOrThrow()
        assertEquals(listOf("pro"), result.map { it.id })
        assertEquals("token-1", result.single().purchaseToken)
        assertEquals(listOf("pro"), observed.map { it.id })
        assertTrue(launched.isCaptured)
    }

    @Test
    fun `a second buy is rejected while one is in progress`() = runTest {
        stubConnection()
        stubProductQuery("pro")
        every { billingClient.launchBillingFlow(any(), any()) } returns
            billingResult(BillingClient.BillingResponseCode.OK)

        val engine = createEngine()
        engine.initConnection()
        engine.getItemsByType(BillingProductType.INAPP, arrayOf("pro"))

        val first = async {
            engine.buyItemByType(BillingBuyItemParams(BillingProductType.INAPP, arrayOf("pro")))
        }
        runCurrent()

        val error = assertFailsWith<IllegalStateException> {
            engine.buyItemByType(BillingBuyItemParams(BillingProductType.INAPP, arrayOf("pro")))
        }
        assertEquals(
            "PURCHASE_IN_PROGRESS: Another Google Billing purchase is already active",
            error.message,
        )

        listener!!.onPurchasesUpdated(
            billingResult(BillingClient.BillingResponseCode.OK),
            listOf(purchase("pro")),
        )
        first.await()
    }

    @Test
    fun `a cancelled billing flow surfaces USER_CANCELLED`() = runTest {
        stubConnection()
        stubProductQuery("pro")
        every { billingClient.launchBillingFlow(any(), any()) } returns
            billingResult(BillingClient.BillingResponseCode.OK)

        val engine = createEngine()
        engine.initConnection()
        engine.getItemsByType(BillingProductType.INAPP, arrayOf("pro"))

        val purchases = async {
            runCatching {
                engine.buyItemByType(BillingBuyItemParams(BillingProductType.INAPP, arrayOf("pro")))
            }
        }
        runCurrent()

        listener!!.onPurchasesUpdated(
            billingResult(BillingClient.BillingResponseCode.USER_CANCELED, "User pressed back"),
            null,
        )

        val error = assertFailsWith<Error> { purchases.await().getOrThrow() }
        assertEquals("USER_CANCELLED: User pressed back", error.message)
    }

    @Test
    fun `an unavailable item surfaces SKU_NOT_FOUND`() = runTest {
        stubConnection()
        stubProductQuery("pro")
        every { billingClient.launchBillingFlow(any(), any()) } returns
            billingResult(BillingClient.BillingResponseCode.OK)

        val engine = createEngine()
        engine.initConnection()
        engine.getItemsByType(BillingProductType.INAPP, arrayOf("pro"))

        val purchases = async {
            runCatching {
                engine.buyItemByType(BillingBuyItemParams(BillingProductType.INAPP, arrayOf("pro")))
            }
        }
        runCurrent()

        listener!!.onPurchasesUpdated(
            billingResult(BillingClient.BillingResponseCode.ITEM_UNAVAILABLE, "Item unavailable"),
            null,
        )

        val error = assertFailsWith<Error> { purchases.await().getOrThrow() }
        assertEquals("SKU_NOT_FOUND: Item unavailable", error.message)
    }

    @Test
    fun `a rejected billing flow surfaces BILLING_ERROR`() = runTest {
        stubConnection()
        stubProductQuery("pro")
        every { billingClient.launchBillingFlow(any(), any()) } returns
            billingResult(BillingClient.BillingResponseCode.DEVELOPER_ERROR, "bad params")

        val engine = createEngine()
        engine.initConnection()
        engine.getItemsByType(BillingProductType.INAPP, arrayOf("pro"))

        val error = assertFailsWith<Error> {
            engine.buyItemByType(BillingBuyItemParams(BillingProductType.INAPP, arrayOf("pro")))
        }
        assertEquals("BILLING_ERROR: Google Billing operation failed - bad params", error.message)
    }

    @Test
    fun `buying an unknown sku fails before the flow is launched`() = runTest {
        stubConnection()
        val engine = createEngine()
        engine.initConnection()

        val error = assertFailsWith<Error> {
            engine.buyItemByType(BillingBuyItemParams(BillingProductType.INAPP, arrayOf("pro")))
        }
        assertEquals(
            "SKU_NOT_FOUND: The SKU was not found. Please fetch products first by calling getItems",
            error.message,
        )
    }

    @Test
    fun `subscription buys require one offer token per sku`() = runTest {
        stubConnection()
        val engine = createEngine()
        engine.initConnection()

        val error = assertFailsWith<Error> {
            engine.buyItemByType(
                BillingBuyItemParams(
                    type = BillingProductType.SUBS,
                    skuArr = arrayOf("pro", "plus"),
                    offerTokenArr = arrayOf("offer-1"),
                ),
            )
        }
        assertEquals(
            "SKU_OFFER_MISMATCH: The number of SKUs (2) must match the number of offer tokens (1) for subscriptions",
            error.message,
        )
    }

    @Test
    fun `ending the connection fails the pending purchase`() = runTest {
        stubConnection()
        stubProductQuery("pro")
        every { billingClient.launchBillingFlow(any(), any()) } returns
            billingResult(BillingClient.BillingResponseCode.OK)

        val engine = createEngine()
        engine.initConnection()
        engine.getItemsByType(BillingProductType.INAPP, arrayOf("pro"))

        val purchases = async {
            runCatching {
                engine.buyItemByType(BillingBuyItemParams(BillingProductType.INAPP, arrayOf("pro")))
            }
        }
        runCurrent()

        engine.endConnection()

        val error = assertFailsWith<Error> { purchases.await().getOrThrow() }
        assertEquals("CONNECTION_ENDED: Google Billing connection ended", error.message)
    }

    @Test
    fun `a billing service disconnect fails the pending purchase`() = runTest {
        stubConnection()
        stubProductQuery("pro")
        every { billingClient.launchBillingFlow(any(), any()) } returns
            billingResult(BillingClient.BillingResponseCode.OK)

        val engine = createEngine()
        engine.initConnection()
        engine.getItemsByType(BillingProductType.INAPP, arrayOf("pro"))

        val purchases = async {
            runCatching {
                engine.buyItemByType(BillingBuyItemParams(BillingProductType.INAPP, arrayOf("pro")))
            }
        }
        runCurrent()

        stateListener!!.onBillingServiceDisconnected()

        val error = assertFailsWith<Error> { purchases.await().getOrThrow() }
        assertEquals("BILLING_ERROR: Google Billing service disconnected", error.message)
    }

    @Test
    fun `a repeated billing setup callback does not resume twice`() = runTest {
        every { billingClient.isReady } returns true
        every { billingClient.startConnection(any()) } answers {
            val connectionListener = firstArg<BillingClientStateListener>()
            connectionListener.onBillingSetupFinished(billingResult(BillingClient.BillingResponseCode.OK))
            connectionListener.onBillingSetupFinished(
                billingResult(BillingClient.BillingResponseCode.BILLING_UNAVAILABLE),
            )
        }

        assertTrue(createEngine().initConnection())
    }

    @Test
    fun `a failed connection is not cached`() = runTest {
        var connections = 0
        every { billingClient.isReady } returns true
        every { billingClient.startConnection(any()) } answers {
            connections += 1
            val responseCode = if (connections == 1) {
                BillingClient.BillingResponseCode.BILLING_UNAVAILABLE
            } else {
                BillingClient.BillingResponseCode.OK
            }
            firstArg<BillingClientStateListener>().onBillingSetupFinished(billingResult(responseCode))
        }

        val engine = createEngine()
        assertFailsWith<Error> { engine.initConnection() }
        assertTrue(engine.initConnection())
        assertEquals(2, connections)
    }

    @Test
    fun `concurrent callers share a single connection attempt`() = runTest {
        var connections = 0
        every { billingClient.isReady } returns true
        every { billingClient.startConnection(any()) } answers {
            connections += 1
            stateListener = firstArg()
        }
        stubProductQuery("pro")

        val engine = createEngine()
        val first = async { engine.getItemsByType(BillingProductType.INAPP, arrayOf("pro")) }
        val second = async { engine.getItemsByType(BillingProductType.INAPP, arrayOf("pro")) }
        runCurrent()

        assertEquals(1, connections)

        stateListener!!.onBillingSetupFinished(billingResult(BillingClient.BillingResponseCode.OK))

        assertEquals(listOf("pro"), first.await().map { it.id })
        assertEquals(listOf("pro"), second.await().map { it.id })
        assertEquals(1, connections)
    }

    @Test
    fun `a purchase without a product id is reported`() = runTest {
        stubConnection()
        every { billingClient.queryPurchasesAsync(any<QueryPurchasesParams>(), any()) } answers {
            secondArg<PurchasesResponseListener>().onQueryPurchasesResponse(
                billingResult(BillingClient.BillingResponseCode.OK),
                listOf(
                    mockk<Purchase>(relaxed = true) {
                        every { products } returns emptyList()
                        every { orderId } returns "order-1"
                    },
                ),
            )
        }

        val engine = createEngine()
        engine.initConnection()

        val purchases = engine.getAvailableItemsByType(BillingProductType.INAPP)

        assertEquals("", purchases.single().id)
        assertEquals(
            listOf("Google Billing purchase order-1 carries no product id"),
            warnings,
        )
    }

    @Test
    fun `acknowledge maps the response code and message`() = runTest {
        stubConnection()
        every { billingClient.acknowledgePurchase(any(), any()) } answers {
            secondArg<com.android.billingclient.api.AcknowledgePurchaseResponseListener>()
                .onAcknowledgePurchaseResponse(
                    billingResult(BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED, "already owned"),
                )
        }

        val engine = createEngine()
        engine.initConnection()

        val result = engine.acknowledgePurchase("token-1")
        assertEquals(
            BillingAcknowledgeResult(
                responseCode = BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED.toDouble(),
                debugMessage = "already owned",
                code = "ITEM_ALREADY_OWNED",
                message = "Item already owned",
            ),
            result,
        )
    }

    @Test
    fun `response code and message maps cover every known billing response`() {
        val codes = mapOf(
            BillingClient.BillingResponseCode.OK to ("OK" to "Success"),
            BillingClient.BillingResponseCode.USER_CANCELED to ("USER_CANCELED" to "User canceled the purchase"),
            BillingClient.BillingResponseCode.SERVICE_UNAVAILABLE to ("SERVICE_UNAVAILABLE" to "Billing service is unavailable"),
            BillingClient.BillingResponseCode.BILLING_UNAVAILABLE to ("BILLING_UNAVAILABLE" to "Billing is unavailable"),
            BillingClient.BillingResponseCode.ITEM_UNAVAILABLE to ("ITEM_UNAVAILABLE" to "Item is unavailable"),
            BillingClient.BillingResponseCode.DEVELOPER_ERROR to ("DEVELOPER_ERROR" to "Developer error"),
            BillingClient.BillingResponseCode.ERROR to ("ERROR" to "Billing error"),
            BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED to ("ITEM_ALREADY_OWNED" to "Item already owned"),
            BillingClient.BillingResponseCode.ITEM_NOT_OWNED to ("ITEM_NOT_OWNED" to "Item not owned"),
            99 to ("UNKNOWN" to "Unknown error"),
        )

        codes.forEach { (responseCode, expected) ->
            assertEquals(expected.first, BillingEngine.getBillingResponseCode(responseCode))
            assertEquals(expected.second, BillingEngine.getBillingResponseMessage(responseCode))
        }
    }

    @Test
    fun `replacement modes map to themselves and fall back to unknown`() {
        val modes = listOf(
            BillingFlowParams.SubscriptionUpdateParams.ReplacementMode.CHARGE_PRORATED_PRICE,
            BillingFlowParams.SubscriptionUpdateParams.ReplacementMode.WITHOUT_PRORATION,
            BillingFlowParams.SubscriptionUpdateParams.ReplacementMode.DEFERRED,
            BillingFlowParams.SubscriptionUpdateParams.ReplacementMode.WITH_TIME_PRORATION,
            BillingFlowParams.SubscriptionUpdateParams.ReplacementMode.CHARGE_FULL_PRICE,
        )

        modes.forEach { mode ->
            assertEquals(mode, BillingEngine.mapReplacementMode(mode))
        }
        assertEquals(
            BillingFlowParams.SubscriptionUpdateParams.ReplacementMode.UNKNOWN_REPLACEMENT_MODE,
            BillingEngine.mapReplacementMode(42),
        )
    }
}
