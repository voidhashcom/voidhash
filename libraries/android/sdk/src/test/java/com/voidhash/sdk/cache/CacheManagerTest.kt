package com.voidhash.sdk.cache

import org.json.JSONObject
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class CacheManagerTest {
    private val adapter = InMemoryCacheAdapter()
    private var now = 1_000_000L
    private val cacheManager = CacheManager(adapter) { now }

    @Test
    fun `writes the shared envelope shape`() {
        cacheManager.set("greeting", "hello", ttlMs = 500, staleTimeMs = 100)

        val envelope = JSONObject(adapter.get("greeting")!!)
        assertEquals("hello", envelope.getString("value"))
        assertEquals(now, envelope.getLong("createdAt"))
        assertEquals(now + 100, envelope.getLong("staleAt"))
        assertEquals(now + 500, envelope.getLong("expiresAt"))
    }

    @Test
    fun `entries without a ttl carry explicit nulls`() {
        cacheManager.set("greeting", "hello")

        val envelope = JSONObject(adapter.get("greeting")!!)
        assertTrue(envelope.isNull("expiresAt"))
        assertTrue(envelope.isNull("staleAt"))
    }

    @Test
    fun `a fresh entry is neither stale nor expired`() {
        cacheManager.set("greeting", "hello", ttlMs = 500, staleTimeMs = 100)

        val hit = assertNotNull(cacheManager.getString("greeting"))
        assertEquals("hello", hit.value)
        assertFalse(hit.isStale)
        assertFalse(hit.isExpired)
    }

    @Test
    fun `an entry past its stale time is served as stale`() {
        cacheManager.set("greeting", "hello", ttlMs = 500, staleTimeMs = 100)
        now += 200

        val hit = assertNotNull(cacheManager.getString("greeting"))
        assertTrue(hit.isStale)
        assertFalse(hit.isExpired)
    }

    @Test
    fun `an expired entry is dropped on read`() {
        cacheManager.set("greeting", "hello", ttlMs = 500)
        now += 600

        assertNull(cacheManager.getString("greeting"))
        assertNull(adapter.get("greeting"))
    }

    @Test
    fun `clear drops every key tracked in the index`() {
        cacheManager.set("a", "1")
        cacheManager.set("b", JSONObject().put("value", 2))

        assertEquals(listOf("a", "b"), cacheManager.getCacheKeys())

        cacheManager.clear()

        assertNull(cacheManager.getString("a"))
        assertNull(cacheManager.getObject("b"))
        assertEquals(emptyList(), cacheManager.getCacheKeys())
    }

    @Test
    fun `objects round-trip through the envelope`() {
        cacheManager.set("schema", JSONObject().put("version", "v1"))

        val hit = assertNotNull(cacheManager.getObject("schema"))
        assertEquals("v1", hit.value.getString("version"))
    }

    @Test
    fun `a zero window means never expires and never stale`() {
        cacheManager.set("greeting", "hello", ttlMs = 0, staleTimeMs = 0)

        val envelope = JSONObject(adapter.get("greeting")!!)
        assertTrue(envelope.isNull("expiresAt"))
        assertTrue(envelope.isNull("staleAt"))

        now += 10_000
        val hit = assertNotNull(cacheManager.getString("greeting"))
        assertFalse(hit.isExpired)
        assertFalse(hit.isStale)
    }

    @Test
    fun `a stored zero deadline is not read as instantly expired`() {
        adapter.set(
            "greeting",
            """{"createdAt":0,"expiresAt":0,"staleAt":0,"value":"hello"}""",
        )

        val hit = assertNotNull(cacheManager.getString("greeting"))
        assertEquals("hello", hit.value)
        assertFalse(hit.isExpired)
        assertFalse(hit.isStale)
        assertNull(hit.expiresAt)
        assertNull(hit.staleAt)
    }

    @Test
    fun `reads the envelope shape the other SDKs write`() {
        adapter.set(
            "person:user-123",
            """{"createdAt":900000,"expiresAt":2000000,"staleAt":1500000,"value":{"personId":"p_1"}}""",
        )

        val hit = assertNotNull(cacheManager.getObject("person:user-123"))
        assertEquals("p_1", hit.value.getString("personId"))
        assertEquals(900_000L, hit.createdAt)
        assertEquals(2_000_000L, hit.expiresAt)
        assertEquals(1_500_000L, hit.staleAt)
        assertFalse(hit.isExpired)
        assertFalse(hit.isStale)
    }
}
