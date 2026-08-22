package com.voidhash.sdk.api

import com.voidhash.sdk.VoidhashApiException
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.json.JSONObject
import org.junit.After
import org.junit.Before
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue

class VoidhashApiClientTest {
    private lateinit var server: MockWebServer
    private lateinit var client: VoidhashApiClient

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
        client = VoidhashApiClient(
            baseUrl = server.url("/").toString().trimEnd('/'),
            headers = SdkHeaders(
                publishableKey = "pk_test",
                platform = testPlatformInfo(),
                nonceProvider = { "nonce-1" },
            ),
        )
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    @Test
    fun `getSchema sends the common headers`() = runTest {
        server.enqueue(
            MockResponse().setBody("""{"version":"v1","products":{},"locations":{},"perks":{}}"""),
        )

        val schema = client.getSchema("vh:anon:abc")
        val request = server.takeRequest()

        assertEquals("v1", schema.getString("version"))
        assertEquals("/api/v1/sdk/schema", request.path)
        assertEquals("GET", request.method)
        assertEquals("pk_test", request.getHeader("x-publishable-key"))
        assertEquals("vh:anon:abc", request.getHeader("x-distinct-id"))
        assertEquals("android", request.getHeader("x-sdk"))
    }

    @Test
    fun `a missing person is not an error`() = runTest {
        server.enqueue(MockResponse().setResponseCode(404).setBody("""{"_tag":"Api/SdkPersonNotFoundError"}"""))

        assertNull(client.getPerson("vh:anon:abc"))
    }

    @Test
    fun `parses the person snapshot`() = runTest {
        server.enqueue(
            MockResponse().setBody(
                """
                {
                  "distinctId": "user-123",
                  "personId": "person_1",
                  "email": "a@b.co",
                  "name": null,
                  "entitlements": {
                    "grants": [
                      {
                        "perkId": "pro",
                        "source": "subscription",
                        "sourceId": "sub_1",
                        "sourcePersonId": "person_1",
                        "status": "active",
                        "expiresAt": null
                      }
                    ]
                  },
                  "subscriptions": {
                    "current": {
                      "subscriptionId": "sub_1",
                      "productId": "prod_1",
                      "status": "active",
                      "expiresAt": "2026-01-01T00:00:00.000Z"
                    },
                    "history": []
                  },
                  "purchases": { "history": [] }
                }
                """.trimIndent(),
            ),
        )

        val person = client.getPerson("user-123")!!

        assertEquals("user-123", person.distinctId)
        assertEquals("a@b.co", person.email)
        assertNull(person.name)
        assertEquals(listOf("pro"), person.activePerkIds)
        assertEquals("active", person.currentSubscription?.status)
    }

    @Test
    fun `identify posts the new distinct id`() = runTest {
        server.enqueue(MockResponse().setBody("""{"distinctId":"user-123","personId":"person_1"}"""))

        client.identify("vh:anon:abc", "user-123", "a@b.co", null)
        val request = server.takeRequest()
        val body = JSONObject(request.body.readUtf8())

        assertEquals("/api/v1/sdk/identify", request.path)
        assertEquals("user-123", body.getString("distinctId"))
        assertEquals("a@b.co", body.getString("email"))
        assertTrue(!body.has("name"))
    }

    @Test
    fun `evaluate flags posts the requested keys`() = runTest {
        server.enqueue(
            MockResponse().setBody("""{"flags":[{"key":"new_ui","enabled":true,"variantKey":"b"}]}"""),
        )

        val flags = client.evaluateFlags("user-123", listOf("new_ui"))
        val body = JSONObject(server.takeRequest().body.readUtf8())

        assertEquals(listOf(FeatureFlag("new_ui", true, "b")), flags)
        assertEquals("new_ui", body.getJSONArray("flagKeys").getString(0))
    }

    @Test
    fun `resolve paywall returns null when nothing is showing`() = runTest {
        server.enqueue(MockResponse().setBody("null"))

        assertNull(client.resolvePaywall("user-123", "onboarding"))
        assertEquals("/api/v1/sdk/resolve-paywall", server.takeRequest().path)
    }

    @Test
    fun `resolve paywall returns null when no paywall is published`() = runTest {
        // "no paywall published for this location" is a 404, not a failure:
        // presentPaywall documents returning false for it.
        server.enqueue(
            MockResponse().setResponseCode(404).setBody("""{"_tag":"Api/SdkPaywallNotFoundError"}"""),
        )

        assertNull(client.resolvePaywall("user-123", "onboarding"))
        assertEquals("/api/v1/sdk/resolve-paywall", server.takeRequest().path)
    }

    @Test
    fun `resolve paywall maps the release`() = runTest {
        server.enqueue(
            MockResponse().setBody(
                """
                {
                  "location": { "id": "loc_1", "name": "Onboarding", "slug": "onboarding" },
                  "showing": {
                    "id": "showing_1",
                    "type": "paywall_release",
                    "startedAt": "2026-01-01T00:00:00.000Z",
                    "paywall": { "id": "pw_1", "name": "Main", "slug": "main" },
                    "paywallId": "pw_1",
                    "paywallReleaseId": "rel_1",
                    "paywallRelease": {
                      "htmlUrl": "https://cdn.voidhash.com/pw.html",
                      "publishedAt": null,
                      "releaseId": "rel_1",
                      "version": 3,
                      "runtime": {
                        "contentHash": "abc",
                        "productSlugs": ["pro-monthly"],
                        "variables": { "headline": "Go Pro" }
                      }
                    }
                  }
                }
                """.trimIndent(),
            ),
        )

        val paywall = client.resolvePaywall("user-123", "onboarding")!!

        assertEquals("onboarding", paywall.locationSlug)
        assertEquals("https://cdn.voidhash.com/pw.html", paywall.htmlUrl)
        assertEquals(listOf("pro-monthly"), paywall.productSlugs)
        assertEquals("Go Pro", paywall.variables["headline"])
    }

    @Test
    fun `sync transaction posts the android payload`() = runTest {
        server.enqueue(MockResponse().setBody("""{"accepted":true}"""))

        val accepted = client.syncTransaction(
            "user-123",
            SyncTransactionRequest(
                appAccountToken = "3501e751-7582-58f9-9c1d-533c7466049f",
                providerProductId = "pro_monthly",
                productSlug = "pro-monthly",
                purchaseDate = 1_700_000_000_000.0,
                purchaseToken = "token-1",
                quantity = 1,
                receipt = "{}",
                transactionId = "GPA.1",
            ),
        )
        val body = JSONObject(server.takeRequest().body.readUtf8())

        assertTrue(accepted)
        assertEquals("android", body.getString("platform"))
        assertEquals("pro_monthly", body.getString("providerProductId"))
        assertEquals("pro-monthly", body.getString("productSlug"))
        assertEquals("token-1", body.getString("purchaseToken"))
        assertEquals("GPA.1", body.getString("transactionId"))
        assertEquals(1, body.getInt("quantity"))
        assertEquals(1_700_000_000_000.0, body.getDouble("purchaseDate"))
    }

    @Test
    fun `maps unauthorized responses onto a coded error`() = runTest {
        server.enqueue(
            MockResponse().setResponseCode(401).setBody("""{"_tag":"Api/AuthenticationError"}"""),
        )

        val error = assertFailsWith<VoidhashApiException> { client.getSchema("user-123") }

        assertEquals(401, error.status)
        assertEquals("AUTHENTICATION_FAILED", error.code)
        assertEquals("AUTHENTICATION_FAILED: Api/AuthenticationError", error.message)
    }

    @Test
    fun `maps server errors onto a coded error`() = runTest {
        server.enqueue(
            MockResponse().setResponseCode(500).setBody("""{"_tag":"Api/SdkServiceError","cause":"boom"}"""),
        )

        val error = assertFailsWith<VoidhashApiException> { client.getSchema("user-123") }

        assertEquals("API_ERROR", error.code)
        assertEquals("boom", error.description)
    }
}
