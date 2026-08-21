package com.voidhash.sdk

import android.app.Activity
import com.voidhash.core.billing.BillingProductType
import com.voidhash.sdk.analytics.AnalyticsClient
import com.voidhash.sdk.api.VoidhashApiClient
import com.voidhash.sdk.api.VoidhashPerson
import com.voidhash.sdk.billing.FakeBillingEngine
import com.voidhash.sdk.billing.testSubscriptionDetail
import com.voidhash.sdk.cache.CacheManager
import com.voidhash.sdk.cache.InMemoryCacheAdapter
import com.voidhash.sdk.identity.IdentityStore
import com.voidhash.sdk.paywall.PaywallCoordinator
import com.voidhash.sdk.paywall.PaywallPresenterPort
import com.voidhash.sdk.paywall.testResolvedPaywall
import com.voidhash.sdk.schema.SchemaManager
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.cancel
import kotlinx.coroutines.isActive
import kotlinx.coroutines.test.runTest
import org.json.JSONObject
import org.junit.After
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

private fun schemaJson(version: String, withProduct: Boolean) = JSONObject(
    """
    {
      "version": "$version",
      "locations": {},
      "products": ${if (withProduct) PRODUCTS_JSON else "{}"}
    }
    """.trimIndent(),
)

private const val PRODUCTS_JSON = """
{
  "pro-monthly": {
    "slug": "pro-monthly",
    "type": "subscription",
    "properties": { "name": "Pro Monthly" },
    "configuration": {
      "providers": { "googlePlay": { "productId": "pro_monthly", "basePlanId": "monthly" } }
    }
  }
}
"""

private fun personJson(personId: String) = JSONObject(
    """{"distinctId":"user-123","personId":"$personId","entitlements":{"grants":[]}}""",
)

private class TestPresenter : PaywallPresenterPort {
    val messages = mutableListOf<String>()
    var dismissError: Throwable? = null
    var onBridgeEvent: ((String) -> Unit)? = null

    override suspend fun show(
        locationSlug: String,
        htmlUrl: String,
        onBridgeEvent: ((String) -> Unit)?,
        onDismiss: (() -> Unit)?,
    ): Boolean {
        this.onBridgeEvent = onBridgeEvent
        return true
    }

    override suspend fun dismiss() {
        dismissError?.let { throw it }
    }

    override fun postMessage(locationSlug: String, data: String) {
        messages.add(data)
    }
}

class VoidhashClientTest {
    private val apiClient = mockk<VoidhashApiClient>(relaxed = false)
    private val adapter = InMemoryCacheAdapter()
    private var now = 1_700_000_000_000L
    private val cacheManager = CacheManager(adapter) { now }
    private val identityStore = IdentityStore(cacheManager) { "user-123" }
    private val billing = FakeBillingEngine()
    private val presenter = TestPresenter()
    private val warnings = mutableListOf<String>()
    private val clientScope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)

    @After
    fun tearDown() {
        clientScope.cancel()
    }

    private fun buildClient(appVersion: String? = null): VoidhashClient {
        val clientRef = java.util.concurrent.atomic.AtomicReference<VoidhashClient?>(null)
        val client = VoidhashClient(
            apiClient = apiClient,
            cacheManager = cacheManager,
            identityStore = identityStore,
            schemaManager = SchemaManager(
                apiClient = apiClient,
                cacheManager = cacheManager,
                appVersion = appVersion,
                refreshScope = clientScope,
                onSchema = { schema -> clientRef.get()?.publishSchema(schema) },
                onWarning = warnings::add,
            ),
            orchestrator = PurchaseOrchestrator(
                billing = billing,
                apiClient = apiClient,
                cacheManager = cacheManager,
                identityStore = identityStore,
                onWarning = warnings::add,
            ),
            analyticsClient = AnalyticsClient(
                ingestUrl = "https://ingest.invalid",
                publishableKey = "pk_test",
                distinctIdProvider = identityStore::getDistinctId,
                sleep = { CompletableDeferred<Unit>().await() },
                onWarning = warnings::add,
            ),
            billing = billing,
            scope = clientScope,
            paywallCoordinatorFactory = { purchaseHandler ->
                PaywallCoordinator(
                    presenter = presenter,
                    purchaseHandler = purchaseHandler,
                    resolvePaywall = { testResolvedPaywall() },
                    onWarning = warnings::add,
                )
            },
            activitySink = {},
            enabled = true,
            readOnly = false,
            onWarning = warnings::add,
        )
        clientRef.set(client)
        return client
    }

    @Test
    fun `initialize resolves the schema once`() = runTest {
        coEvery { apiClient.getSchema(any()) } returns schemaJson("v1", withProduct = false)
        val client = buildClient()

        client.initialize()
        client.initialize()

        coVerify(exactly = 1) { apiClient.getSchema(any()) }
        assertEquals(emptyList(), client.getProducts())
    }

    @Test
    fun `a failed initialize leaves the client uninitialized and retryable`() = runTest {
        coEvery { apiClient.getSchema(any()) } throws
            VoidhashNetworkException("schema offline") andThen schemaJson("v1", withProduct = false)
        val client = buildClient()

        assertFailsWith<VoidhashNetworkException> { client.initialize() }

        val notReady = assertFailsWith<VoidhashException> { client.getProducts() }
        assertEquals("CONFIGURATION_MISSING", notReady.code)

        client.initialize()

        assertEquals(emptyList(), client.getProducts())
        coVerify(exactly = 2) { apiClient.getSchema(any()) }
    }

    @Test
    fun `a concurrent initialize caller waits for the schema`() = runTest {
        val gate = CompletableDeferred<Unit>()
        coEvery { apiClient.getSchema(any()) } coAnswers {
            gate.await()
            schemaJson("v1", withProduct = false)
        }
        val client = buildClient()

        val first = async { client.initialize() }
        testScheduler.runCurrent()
        val second = async {
            client.initialize()
            client.getProducts()
        }
        testScheduler.runCurrent()

        gate.complete(Unit)
        first.await()

        assertEquals(emptyList(), second.await())
        coVerify(exactly = 1) { apiClient.getSchema(any()) }
    }

    @Test
    fun `a background schema refresh replaces the stale session schema`() = runTest {
        cacheManager.set("schema:1.0.0", schemaJson("v1", withProduct = false), ttlMs = 60_000)
        coEvery { apiClient.getSchema(any()) } returns schemaJson("v2", withProduct = true)
        billing.productsByType = mapOf(
            BillingProductType.SUBS to listOf(testSubscriptionDetail()),
            BillingProductType.INAPP to emptyList(),
        )
        val client = buildClient(appVersion = "1.0.0")

        client.initialize()

        assertEquals("pro-monthly", client.getProducts().single().slug)
    }

    @Test
    fun `the person snapshot is cached under the shared key and policy`() = runTest {
        coEvery { apiClient.getPerson("user-123") } returns VoidhashPerson.fromJson(personJson("p_1"))
        val client = buildClient()

        assertEquals("p_1", client.getCurrentPerson()?.personId)
        assertEquals("p_1", client.getCurrentPerson()?.personId)

        coVerify(exactly = 1) { apiClient.getPerson(any()) }

        val envelope = JSONObject(assertNotNull(adapter.get("person:user-123")))
        assertEquals(now + 1000L * 60 * 60 * 24 * 2, envelope.getLong("expiresAt"))
        assertEquals(now + 1000L * 60 * 5, envelope.getLong("staleAt"))
        assertEquals("p_1", envelope.getJSONObject("value").getString("personId"))
    }

    @Test
    fun `a forced fetch bypasses the person cache`() = runTest {
        coEvery { apiClient.getPerson("user-123") } returns
            VoidhashPerson.fromJson(personJson("p_1")) andThen
            VoidhashPerson.fromJson(personJson("p_2"))
        val client = buildClient()

        assertEquals("p_1", client.getCurrentPerson()?.personId)
        assertEquals("p_2", client.getCurrentPerson(forceFetch = true)?.personId)
        assertEquals("p_2", client.getCurrentPerson()?.personId)

        coVerify(exactly = 2) { apiClient.getPerson(any()) }
    }

    @Test
    fun `an expired person entry is refetched`() = runTest {
        coEvery { apiClient.getPerson("user-123") } returns VoidhashPerson.fromJson(personJson("p_1"))
        val client = buildClient()

        client.getCurrentPerson()
        now += 1000L * 60 * 60 * 24 * 3

        client.getCurrentPerson()

        coVerify(exactly = 2) { apiClient.getPerson(any()) }
    }

    @Test
    fun `a bridge dispatch failure answers the pending request`() = runTest {
        presenter.dismissError = IllegalStateException("no activity")
        val client = buildClient()

        assertTrue(client.presentPaywall(mockk<Activity>(relaxed = true), "onboarding"))
        presenter.messages.clear()

        presenter.onBridgeEvent!!.invoke(
            """{"version":1,"type":"close","requestId":"req-1"}""",
        )

        val payload = JSONObject(presenter.messages.single()).getJSONObject("payload")
        assertEquals("close", payload.getString("action"))
        assertEquals("error", payload.getString("status"))
        assertEquals("ACTION_FAILED", payload.getJSONObject("error").getString("code"))
        assertEquals("no activity", payload.getJSONObject("error").getString("message"))
    }

    @Test
    fun `shutdown cancels the SDK scope`() = runTest {
        val client = buildClient()

        client.shutdown()

        assertFalse(clientScope.isActive)
    }
}
