package com.voidhash.sdk.analytics

import com.voidhash.sdk.VOIDHASH_SDK_VERSION
import com.voidhash.sdk.api.testPlatformInfo
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.json.JSONObject
import org.junit.After
import org.junit.Before
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class AnalyticsClientTest {
    private lateinit var server: MockWebServer
    private val sleeps = mutableListOf<Long>()
    private val warnings = mutableListOf<String>()
    private var now = 1_700_000_000_000L
    private var uuidCounter = 0

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    private fun client(
        standardProperties: () -> Map<String, Any?> = { emptyMap() },
        sleep: suspend (Long) -> Unit = { sleeps.add(it) },
    ) = AnalyticsClient(
        ingestUrl = server.url("/").toString().trimEnd('/'),
        publishableKey = "pk_test",
        distinctIdProvider = { "user-123" },
        clock = { now },
        uuidFactory = { "uuid-${uuidCounter++}" },
        sleep = sleep,
        standardProperties = standardProperties,
        onWarning = warnings::add,
    )

    private fun takeEvents(): org.json.JSONArray =
        JSONObject(server.takeRequest().body.readUtf8()).getJSONArray("events")

    @Test
    fun `posts the ingest batch body`() = runTest {
        server.enqueue(MockResponse().setResponseCode(202).setBody("""{"accepted":1,"rejected":0}"""))

        val analytics = client()
        analytics.capture("paywall_viewed", mapOf("location" to "onboarding"))
        analytics.flush()

        val request = server.takeRequest()
        val body = JSONObject(request.body.readUtf8())

        assertEquals("/i/v1/batch", request.path)
        assertEquals("pk_test", body.getString("token"))
        assertEquals("2023-11-14T22:13:20.000Z", body.getString("sent_at"))

        val event = body.getJSONArray("events").getJSONObject(0)
        assertEquals("uuid-0", event.getString("uuid"))
        assertEquals("paywall_viewed", event.getString("event"))
        assertEquals("user-123", event.getString("distinct_id"))
        assertEquals("2023-11-14T22:13:20.000Z", event.getString("timestamp"))
        assertEquals("onboarding", event.getJSONObject("properties").getString("location"))
    }

    @Test
    fun `merges the standardized properties into every event`() = runTest {
        server.enqueue(MockResponse().setResponseCode(202))

        val platform = testPlatformInfo().copy(appName = "Example", appBuild = "42")
        val analytics = client(standardProperties = { analyticsStandardProperties(platform) })
        analytics.capture(
            "paywall_viewed",
            mapOf("location" to "onboarding", "\$platform" to "web"),
        )
        analytics.flush()

        val properties = takeEvents().getJSONObject(0).getJSONObject("properties")

        assertEquals("onboarding", properties.getString("location"))
        // Standardized properties describe the app, so they win a key conflict.
        assertEquals("android", properties.getString("\$platform"))
        assertEquals("android", properties.getString("\$sdk"))
        assertEquals(VOIDHASH_SDK_VERSION, properties.getString("\$sdk_version"))
        assertEquals("Example", properties.getString("\$app_name"))
        assertEquals("42", properties.getString("\$app_build"))
        assertEquals("1.4.2", properties.getString("\$app_version"))
        assertEquals("com.example.app", properties.getString("\$bundle_id"))
        assertEquals("Google", properties.getString("\$device_brand"))
        assertEquals("Pixel 8", properties.getString("\$device_name"))
        assertEquals("en-US", properties.getString("\$locale"))
        assertEquals("14", properties.getString("\$platform_version"))
    }

    @Test
    fun `the app name falls back to the bundle id`() {
        val properties = analyticsStandardProperties(testPlatformInfo())

        assertEquals("com.example.app", properties["\$app_name"])
        assertEquals(null, properties["\$app_build"])
    }

    @Test
    fun `flushes at most twenty events per batch`() = runTest {
        server.enqueue(MockResponse().setResponseCode(202))
        server.enqueue(MockResponse().setResponseCode(202))

        val analytics = client()
        repeat(25) { analytics.capture("event_$it") }
        analytics.flush()

        assertEquals(20, takeEvents().length())
        assertEquals(5, takeEvents().length())
        assertEquals(0, analytics.queueLength)
    }

    @Test
    fun `retries server errors with exponential backoff`() = runTest {
        server.enqueue(MockResponse().setResponseCode(500))
        server.enqueue(MockResponse().setResponseCode(500))
        server.enqueue(MockResponse().setResponseCode(202))

        val analytics = client()
        analytics.capture("event")
        analytics.flush()

        assertEquals(3, server.requestCount)
        assertEquals(listOf(1000L, 2000L), sleeps)
        assertTrue(warnings.isEmpty())
    }

    @Test
    fun `re-queues a retryable batch instead of dropping it`() = runTest {
        repeat(3) { server.enqueue(MockResponse().setResponseCode(500)) }
        server.enqueue(MockResponse().setResponseCode(202))

        val analytics = client()
        analytics.capture("event")
        analytics.flush()

        assertEquals(3, server.requestCount)
        assertEquals(listOf(1000L, 2000L), sleeps)
        assertEquals(1, analytics.queueLength)
        assertTrue(warnings.isEmpty())

        // Still queued, and sent once the backoff window has elapsed.
        analytics.flush()
        assertEquals(3, server.requestCount)

        now += 2000
        analytics.flush()
        assertEquals(4, server.requestCount)
        assertEquals(0, analytics.queueLength)
    }

    @Test
    fun `postpones a Retry-After batch instead of sleeping on it`() = runTest {
        server.enqueue(MockResponse().setResponseCode(429).setHeader("Retry-After", "7"))
        server.enqueue(MockResponse().setResponseCode(202))

        val analytics = client()
        analytics.capture("event")
        analytics.flush()

        assertEquals(1, server.requestCount)
        assertTrue(sleeps.isEmpty())
        assertEquals(1, analytics.queueLength)

        now += 7000
        analytics.flush()

        assertEquals(2, server.requestCount)
        assertEquals(0, analytics.queueLength)
    }

    @Test
    fun `splits the batch on 413`() = runTest {
        server.enqueue(MockResponse().setResponseCode(413))
        server.enqueue(MockResponse().setResponseCode(202))
        server.enqueue(MockResponse().setResponseCode(202))

        val analytics = client()
        repeat(4) { analytics.capture("event_$it") }
        analytics.flush()

        server.takeRequest()
        assertEquals(2, takeEvents().length())
        assertEquals(2, takeEvents().length())
        assertTrue(sleeps.isEmpty())
    }

    @Test
    fun `drops non-retryable failures with a warning`() = runTest {
        server.enqueue(MockResponse().setResponseCode(400).setBody("""{"code":"invalid_request"}"""))

        val analytics = client()
        analytics.capture("event")
        analytics.flush()

        assertEquals(1, server.requestCount)
        assertEquals(1, warnings.size)
        assertEquals(0, analytics.queueLength)
        assertTrue(sleeps.isEmpty())
    }

    @Test
    fun `non-finite property values are sent as null with a warning`() = runTest {
        server.enqueue(MockResponse().setResponseCode(202))

        val analytics = client()
        analytics.capture(
            "scored",
            mapOf(
                "score" to Double.NaN,
                "ratio" to Float.POSITIVE_INFINITY,
                "level" to 3,
            ),
        )
        analytics.flush()

        val properties = takeEvents().getJSONObject(0).getJSONObject("properties")
        assertTrue(properties.isNull("score"))
        assertTrue(properties.isNull("ratio"))
        assertEquals(3, properties.getInt("level"))
        assertEquals(2, warnings.size)
    }

    @Test
    fun `a flush failure is warned about instead of tearing the daemon down`() = runTest {
        server.enqueue(MockResponse().setResponseCode(500))

        val analytics = client(sleep = { throw IllegalStateException("scheduler is gone") })
        analytics.capture("event")
        analytics.flushQuietly()

        assertEquals(1, warnings.size)
        assertTrue(warnings.single().startsWith("Analytics flush failed"))
    }
}
