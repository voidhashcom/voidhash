package com.voidhash.sdk.schema

import com.voidhash.sdk.api.SdkHeaders
import com.voidhash.sdk.api.VoidhashApiClient
import com.voidhash.sdk.api.testPlatformInfo
import com.voidhash.sdk.cache.CacheManager
import com.voidhash.sdk.cache.InMemoryCacheAdapter
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.job
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Before
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

private fun schemaBody(version: String) = """
{
  "version": "$version",
  "perks": {},
  "locations": {
    "onboarding": { "slug": "onboarding", "name": "Onboarding", "description": null }
  },
  "products": {
    "pro-monthly": {
      "slug": "pro-monthly",
      "type": "subscription",
      "properties": { "name": "Pro Monthly" },
      "configuration": {
        "perks": {},
        "providers": { "googlePlay": { "productId": "pro_monthly", "basePlanId": "monthly" } }
      }
    }
  }
}
""".trimIndent()

class SchemaManagerTest {
    private lateinit var server: MockWebServer
    private lateinit var apiClient: VoidhashApiClient
    private val adapter = InMemoryCacheAdapter()
    private val cacheManager = CacheManager(adapter)

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
        apiClient = VoidhashApiClient(
            baseUrl = server.url("/").toString().trimEnd('/'),
            headers = SdkHeaders("pk_test", testPlatformInfo()),
        )
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    private fun manager(appVersion: String?, scope: CoroutineScope, onSchema: (RuntimeSchema) -> Unit = {}) =
        SchemaManager(apiClient, cacheManager, appVersion, scope, onSchema)

    @Test
    fun `a cold cache fetches, parses and caches`() = runTest {
        server.enqueue(MockResponse().setBody(schemaBody("v1")))

        val schema = manager("1.0.0", this).resolveSchema("user-123")

        assertEquals("v1", schema.version)
        assertEquals("Pro Monthly", schema.products.getValue("pro-monthly").name)
        assertEquals(
            "monthly",
            schema.products.getValue("pro-monthly").providers.googlePlay?.basePlanId,
        )
        assertEquals("Onboarding", schema.locations.getValue("onboarding").name)
        assertEquals("v1", cacheManager.getObject("schema:1.0.0")?.value?.getString("version"))
        assertEquals(1, server.requestCount)
    }

    @Test
    fun `a warm cache is served immediately and revalidated in the background`() = runTest {
        server.enqueue(MockResponse().setBody(schemaBody("v1")))
        server.enqueue(MockResponse().setBody(schemaBody("v2")))

        val scope = CoroutineScope(UnconfinedTestDispatcher(testScheduler))
        manager("1.0.0", scope).resolveSchema("user-123")

        val published = mutableListOf<String>()
        val schema = manager("1.0.0", scope) { published.add(it.version) }.resolveSchema("user-123")
        scope.coroutineContext.job.children.forEach { it.join() }

        assertEquals("v1", schema.version)
        assertEquals(listOf("v1", "v2"), published)
        assertEquals("v2", cacheManager.getObject("schema:1.0.0")?.value?.getString("version"))
        assertEquals(2, server.requestCount)
    }

    @Test
    fun `a failing background refresh keeps serving the cached schema`() = runTest {
        server.enqueue(MockResponse().setBody(schemaBody("v1")))
        server.enqueue(MockResponse().setResponseCode(500).setBody("{}"))

        val scope = CoroutineScope(UnconfinedTestDispatcher(testScheduler))
        manager("1.0.0", scope).resolveSchema("user-123")

        assertEquals("v1", manager("1.0.0", scope).resolveSchema("user-123").version)
        scope.coroutineContext.job.children.forEach { it.join() }
        assertEquals("v1", cacheManager.getObject("schema:1.0.0")?.value?.getString("version"))
    }

    @Test
    fun `a cold cache fetch failure is fatal`() = runTest {
        server.enqueue(MockResponse().setResponseCode(500).setBody("{}"))

        assertFailsWith<Exception> { manager("1.0.0", this).resolveSchema("user-123") }
    }

    @Test
    fun `each app version gets its own cache key`() = runTest {
        server.enqueue(MockResponse().setBody(schemaBody("v1")))
        server.enqueue(MockResponse().setBody(schemaBody("v2")))

        manager("1.0.0", this).resolveSchema("user-123")
        val next = manager("1.1.0", this).resolveSchema("user-123")

        assertEquals("v2", next.version)
        assertEquals("v1", cacheManager.getObject("schema:1.0.0")?.value?.getString("version"))
        assertEquals("v2", cacheManager.getObject("schema:1.1.0")?.value?.getString("version"))
    }

    @Test
    fun `without an app version the cache is skipped`() = runTest {
        server.enqueue(MockResponse().setBody(schemaBody("v1")))
        server.enqueue(MockResponse().setBody(schemaBody("v2")))

        assertEquals("v1", manager(null, this).resolveSchema("user-123").version)
        assertEquals("v2", manager(null, this).resolveSchema("user-123").version)
        assertEquals(emptyList(), cacheManager.getCacheKeys())
    }
}
