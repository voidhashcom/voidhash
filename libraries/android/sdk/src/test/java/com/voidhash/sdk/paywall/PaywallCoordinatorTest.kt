package com.voidhash.sdk.paywall

import com.voidhash.sdk.VoidhashException
import com.voidhash.sdk.api.ResolvedPaywall
import com.voidhash.sdk.billing.VoidhashProduct
import com.voidhash.sdk.billing.VoidhashTransaction
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.runTest
import org.json.JSONObject
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

private class RecordingPresenter : PaywallPresenterPort {
    val messages = mutableListOf<String>()
    var shownHtmlUrl: String? = null
    var shows = 0
    var dismissed = false
    var dismissError: Throwable? = null
    var onBridgeEvent: ((String) -> Unit)? = null
    var onDismiss: (() -> Unit)? = null

    override suspend fun show(
        locationSlug: String,
        htmlUrl: String,
        onBridgeEvent: ((String) -> Unit)?,
        onDismiss: (() -> Unit)?,
    ): Boolean {
        shows += 1
        shownHtmlUrl = htmlUrl
        this.onBridgeEvent = onBridgeEvent
        this.onDismiss = onDismiss
        return true
    }

    override suspend fun dismiss() {
        dismissError?.let { throw it }
        dismissed = true
        onDismiss?.invoke()
    }

    override fun postMessage(locationSlug: String, data: String) {
        messages.add(data)
    }

    fun envelopes(): List<JSONObject> = messages.map { JSONObject(it) }

    fun statuses(): List<String> = envelopes()
        .filter { it.getString("type") == "status" }
        .map { it.getJSONObject("payload").getString("status") }

    fun responses(): List<JSONObject> = envelopes()
        .filter { it.getString("type") == "response" }
        .map { it.getJSONObject("payload") }
}

private class RecordingListener : PaywallListener {
    val events = mutableListOf<Pair<String, Map<String, Any?>>>()
    val logs = mutableListOf<Pair<String, String>>()
    var completed: VoidhashTransaction? = null
    var failed: Throwable? = null
    var restored = false
    var dismissed = false
    var throwOnPurchaseCompleted = false

    override fun onEvent(name: String, properties: Map<String, Any?>) {
        events.add(name to properties)
    }

    override fun onLog(level: String, message: String) {
        logs.add(level to message)
    }

    override fun onPurchaseCompleted(transaction: VoidhashTransaction) {
        completed = transaction
        if (throwOnPurchaseCompleted) {
            throw IllegalStateException("host listener blew up")
        }
    }

    override fun onPurchaseFailed(error: Throwable) {
        failed = error
    }

    override fun onRestoreCompleted() {
        restored = true
    }

    override fun onDismiss() {
        dismissed = true
    }
}

private val transaction = VoidhashTransaction(
    id = "pro_monthly",
    transactionId = "GPA.1",
    productId = "pro_monthly",
    purchaseDate = 1_700_000_000_000.0,
    quantity = 1,
    isAcknowledged = true,
    purchaseState = "purchased",
    purchaseToken = "token-1",
    appAccountToken = null,
    receipt = null,
    isAutoRenewing = true,
)

private class FakePurchaseHandler(
    var products: List<VoidhashProduct> = listOf(testProduct()),
) : PaywallPurchaseHandler {
    var productsError: Throwable? = null
    var purchaseError: Throwable? = null
    var restoreError: Throwable? = null
    var purchaseGate: CompletableDeferred<Unit>? = null
    var restored = false
    var purchasedProduct: VoidhashProduct? = null

    override suspend fun products(): List<VoidhashProduct> {
        productsError?.let { throw it }
        return products
    }

    override suspend fun purchase(product: VoidhashProduct): VoidhashTransaction {
        purchasedProduct = product
        purchaseGate?.await()
        purchaseError?.let { throw it }
        return transaction
    }

    override suspend fun restorePurchases() {
        restoreError?.let { throw it }
        restored = true
    }
}

private fun envelope(type: String, payload: String = "{}", requestId: String? = "req-1") =
    JSONObject()
        .put("version", 1)
        .put("type", type)
        .also { json -> requestId?.let { json.put("requestId", it) } }
        .put("payload", JSONObject(payload))
        .toString()

class PaywallCoordinatorTest {
    private val presenter = RecordingPresenter()
    private val purchaseHandler = FakePurchaseHandler()
    private val listener = RecordingListener()
    private val opened = mutableListOf<String>()
    private val captured = mutableListOf<Pair<String, Map<String, Any?>>>()
    private val warnings = mutableListOf<String>()
    private var resolved: ResolvedPaywall? = testResolvedPaywall()

    private fun coordinator() = PaywallCoordinator(
        presenter = presenter,
        purchaseHandler = purchaseHandler,
        resolvePaywall = { resolved },
        openExternal = opened::add,
        locale = "de-DE",
        onCapture = { name, properties -> captured.add(name to properties) },
        onWarning = warnings::add,
    )

    /** Presents the paywall and drops the post-present `configure` envelope. */
    private suspend fun presented(): PaywallCoordinator {
        val coordinator = coordinator()
        coordinator.present("onboarding", listener)
        presenter.messages.clear()
        return coordinator
    }

    @Test
    fun `present shows the resolved release`() = runTest {
        assertTrue(coordinator().present("onboarding", listener))
        assertEquals("https://cdn.voidhash.com/pw.html", presenter.shownHtmlUrl)
    }

    @Test
    fun `present returns false when nothing is showing`() = runTest {
        resolved = null
        assertFalse(coordinator().present("onboarding", listener))
        assertNull(presenter.shownHtmlUrl)
    }

    @Test
    fun `present re-sends configure for warm bundles`() = runTest {
        coordinator().present("onboarding", listener)

        val configure = presenter.envelopes().single()
        assertEquals("configure", configure.getString("type"))
        assertFalse(configure.has("requestId"))
        assertEquals(
            "pro_monthly",
            configure.getJSONObject("payload").getString("defaultSelectedProductId"),
        )
    }

    @Test
    fun `ready is answered with configure and no response envelope`() = runTest {
        val coordinator = presented()

        coordinator.handleBridgeMessage("onboarding", envelope("ready"))

        val configure = presenter.envelopes().single()
        assertEquals("configure", configure.getString("type"))
        assertEquals("req-1", configure.getString("requestId"))
        assertEquals("de-DE", configure.getJSONObject("payload").getString("locale"))
        assertTrue(presenter.responses().isEmpty())
    }

    @Test
    fun `a store failure still configures the bundle without products`() = runTest {
        val coordinator = presented()
        purchaseHandler.productsError = VoidhashException("BILLING_ERROR", "store unavailable")

        coordinator.handleBridgeMessage("onboarding", envelope("ready"))

        val payload = presenter.envelopes().single().getJSONObject("payload")
        assertEquals(0, payload.getJSONArray("products").length())
        assertEquals("Go Pro", payload.getJSONObject("variables").getString("headline"))
        assertTrue(warnings.first().startsWith("Failed to resolve paywall products"))
    }

    @Test
    fun `a successful purchase emits purchasing then purchased and dismisses`() = runTest {
        val coordinator = presented()

        coordinator.handleBridgeMessage(
            "onboarding",
            envelope("purchase", """{"productId":"pro-monthly"}"""),
        )

        assertEquals(listOf("purchasing", "purchased"), presenter.statuses())
        assertEquals("pro-monthly", purchaseHandler.purchasedProduct?.slug)
        assertEquals(transaction, listener.completed)

        val response = presenter.responses().single()
        assertEquals("success", response.getString("status"))
        assertEquals("pro_monthly", response.getJSONObject("data").getString("productId"))
        assertTrue(presenter.dismissed)
    }

    @Test
    fun `the purchasing status carries the requested product id`() = runTest {
        val coordinator = presented()

        coordinator.handleBridgeMessage(
            "onboarding",
            envelope("purchase", """{"productId":"pro-monthly"}"""),
        )

        val purchasing = presenter.envelopes().first().getJSONObject("payload")
        assertEquals("purchasing", purchasing.getString("status"))
        assertEquals("pro-monthly", purchasing.getString("productId"))
    }

    @Test
    fun `products are resolved by store id before slug`() = runTest {
        purchaseHandler.products = listOf(
            testProduct(id = "pro_annual", slug = "pro_monthly"),
            testProduct(id = "pro_monthly", slug = "pro-monthly"),
        )
        val coordinator = presented()

        coordinator.handleBridgeMessage(
            "onboarding",
            envelope("purchase", """{"productId":"pro_monthly"}"""),
        )

        assertEquals("pro-monthly", purchaseHandler.purchasedProduct?.slug)
    }

    @Test
    fun `a cancelled purchase emits cancelled, not failed`() = runTest {
        purchaseHandler.purchaseError = Error("USER_CANCELLED: User cancelled the purchase")
        val coordinator = presented()

        coordinator.handleBridgeMessage(
            "onboarding",
            envelope("purchase", """{"productId":"pro-monthly"}"""),
        )

        assertEquals(listOf("purchasing", "cancelled"), presenter.statuses())
        assertNull(listener.failed)
        assertEquals("ACTION_FAILED", presenter.responses().single().getJSONObject("error").getString("code"))
        assertFalse(presenter.dismissed)
    }

    @Test
    fun `a failed purchase reports ACTION_FAILED with the underlying message`() = runTest {
        purchaseHandler.purchaseError =
            VoidhashException("BILLING_ERROR", "Google Billing operation failed")
        val coordinator = presented()

        coordinator.handleBridgeMessage(
            "onboarding",
            envelope("purchase", """{"productId":"pro-monthly"}"""),
        )

        assertEquals(listOf("purchasing", "failed"), presenter.statuses())
        assertEquals(
            "BILLING_ERROR: Google Billing operation failed",
            presenter.envelopes()[1].getJSONObject("payload").getString("error"),
        )

        val error = presenter.responses().single().getJSONObject("error")
        assertEquals("ACTION_FAILED", error.getString("code"))
        assertEquals("BILLING_ERROR: Google Billing operation failed", error.getString("message"))
        assertEquals("BILLING_ERROR", listener.failed?.let { (it as VoidhashException).code })
    }

    @Test
    fun `an unknown product fails without starting a purchase`() = runTest {
        val coordinator = presented()

        coordinator.handleBridgeMessage(
            "onboarding",
            envelope("purchase", """{"productId":"nope"}"""),
        )

        assertEquals(listOf("purchasing", "failed"), presenter.statuses())
        assertNull(purchaseHandler.purchasedProduct)

        val failed = presenter.envelopes()[1].getJSONObject("payload")
        assertEquals("Product not found: nope", failed.getString("error"))
        assertFalse(failed.has("productId"))
        assertEquals(
            "Product not found: nope",
            presenter.responses().single().getJSONObject("error").getString("message"),
        )
    }

    @Test
    fun `a store failure during a purchase is not reported as a missing product`() = runTest {
        val coordinator = presented()
        purchaseHandler.productsError = VoidhashException("BILLING_ERROR", "store unavailable")

        coordinator.handleBridgeMessage(
            "onboarding",
            envelope("purchase", """{"productId":"pro-monthly"}"""),
        )

        assertEquals(listOf("purchasing", "failed"), presenter.statuses())
        val error = presenter.responses().single().getJSONObject("error")
        assertEquals("ACTION_FAILED", error.getString("code"))
        assertEquals("BILLING_ERROR: store unavailable", error.getString("message"))
        assertEquals(1, warnings.size)
    }

    @Test
    fun `a concurrent action is rejected as busy`() = runTest {
        val gate = CompletableDeferred<Unit>()
        purchaseHandler.purchaseGate = gate
        val coordinator = presented()

        val purchase = launch {
            coordinator.handleBridgeMessage(
                "onboarding",
                envelope("purchase", """{"productId":"pro-monthly"}"""),
            )
        }
        testScheduler.runCurrent()

        coordinator.handleBridgeMessage("onboarding", envelope("restore", requestId = "req-2"))

        val busy = presenter.responses().single().getJSONObject("error")
        assertEquals("ACTION_BUSY", busy.getString("code"))
        assertEquals("Another paywall action is already running", busy.getString("message"))
        assertFalse(purchaseHandler.restored)

        gate.complete(Unit)
        purchase.join()
    }

    @Test
    fun `a throwing listener does not turn a successful purchase into a failure`() = runTest {
        listener.throwOnPurchaseCompleted = true
        val coordinator = presented()

        coordinator.handleBridgeMessage(
            "onboarding",
            envelope("purchase", """{"productId":"pro-monthly"}"""),
        )

        assertEquals(listOf("purchasing", "purchased"), presenter.statuses())
        assertEquals("success", presenter.responses().single().getString("status"))
        assertTrue(presenter.dismissed)
        assertEquals(1, warnings.size)
    }

    @Test
    fun `restore emits restoring then restored and dismisses`() = runTest {
        val coordinator = presented()

        coordinator.handleBridgeMessage("onboarding", envelope("restore"))

        assertEquals(listOf("restoring", "restored"), presenter.statuses())
        assertTrue(purchaseHandler.restored)
        assertTrue(listener.restored)
        assertEquals("success", presenter.responses().single().getString("status"))
        assertTrue(presenter.dismissed)
    }

    @Test
    fun `a failed restore emits failed with ACTION_FAILED`() = runTest {
        purchaseHandler.restoreError = VoidhashException("API_ERROR", "API operation failed")
        val coordinator = presented()

        coordinator.handleBridgeMessage("onboarding", envelope("restore"))

        assertEquals(listOf("restoring", "failed"), presenter.statuses())
        assertEquals(
            "ACTION_FAILED",
            presenter.responses().single().getJSONObject("error").getString("code"),
        )
        assertFalse(presenter.dismissed)
    }

    @Test
    fun `close dismisses the paywall without a response`() = runTest {
        val coordinator = presented()

        coordinator.handleBridgeMessage("onboarding", envelope("close"))

        assertTrue(presenter.dismissed)
        assertTrue(listener.dismissed)
        assertTrue(presenter.messages.isEmpty())
    }

    @Test
    fun `openExternal opens the url without a response`() = runTest {
        val coordinator = presented()

        coordinator.handleBridgeMessage(
            "onboarding",
            envelope("openExternal", """{"url":"https://voidhash.com/terms"}"""),
        )

        assertEquals(listOf("https://voidhash.com/terms"), opened)
        assertTrue(presenter.messages.isEmpty())
    }

    @Test
    fun `event envelopes are captured and forwarded to the listener`() = runTest {
        val coordinator = presented()

        coordinator.handleBridgeMessage(
            "onboarding",
            envelope("event", """{"name":"cta_tapped","properties":{"variant":"a"}}"""),
        )

        assertEquals("cta_tapped", captured.single().first)
        assertEquals("a", captured.single().second["variant"])
        assertEquals("onboarding", captured.single().second["paywall_location"])
        assertEquals("cta_tapped", listener.events.single().first)
        assertEquals(null, listener.events.single().second["paywall_location"])
        assertTrue(presenter.messages.isEmpty())
    }

    @Test
    fun `log envelopes reach the listener`() = runTest {
        val coordinator = presented()

        coordinator.handleBridgeMessage(
            "onboarding",
            envelope("log", """{"level":"warn","message":"slow render"}"""),
        )

        assertEquals("warn" to "slow render", listener.logs.single())
        assertTrue(presenter.messages.isEmpty())
    }

    @Test
    fun `unrecognized envelopes are warned about and ignored`() = runTest {
        val coordinator = presented()

        coordinator.handleBridgeMessage("onboarding", "not json")
        coordinator.handleBridgeMessage("onboarding", envelope("unsupported"))
        coordinator.handleBridgeMessage(
            "onboarding",
            JSONObject().put("version", 2).put("type", "ready").toString(),
        )
        coordinator.handleBridgeMessage("onboarding", envelope("purchase", """{"productId":""}"""))

        assertEquals(4, warnings.size)
        assertTrue(presenter.messages.isEmpty())
    }

    @Test
    fun `a vanished bridge handler answers the pending request`() = runTest {
        val coordinator = presented()

        coordinator.reportBridgeMessageFailure(
            "onboarding",
            envelope("purchase", """{"productId":"pro-monthly"}"""),
            IllegalStateException("dispatcher exploded"),
        )

        val response = presenter.responses().single()
        assertEquals("purchase", response.getString("action"))
        assertEquals("ACTION_FAILED", response.getJSONObject("error").getString("code"))
        assertEquals("dispatcher exploded", response.getJSONObject("error").getString("message"))
        assertEquals(1, warnings.size)
    }

    @Test
    fun `a vanished bridge handler stays quiet without a request id`() = runTest {
        val coordinator = presented()

        coordinator.reportBridgeMessageFailure(
            "onboarding",
            envelope("close", requestId = null),
            IllegalStateException("dispatcher exploded"),
        )

        assertTrue(presenter.messages.isEmpty())
        assertEquals(1, warnings.size)
    }

    @Test
    fun `a dismiss failure does not undo a successful purchase`() = runTest {
        presenter.dismissError = IllegalStateException("no activity")
        val coordinator = presented()

        coordinator.handleBridgeMessage(
            "onboarding",
            envelope("purchase", """{"productId":"pro-monthly"}"""),
        )

        assertEquals(listOf("purchasing", "purchased"), presenter.statuses())
        assertEquals("success", presenter.responses().single().getString("status"))
        assertEquals(1, warnings.size)
    }
}
