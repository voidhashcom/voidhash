package com.voidhash.sdk.identity

import com.voidhash.sdk.cache.CacheManager
import com.voidhash.sdk.cache.InMemoryCacheAdapter
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

private const val DNS_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"

class AccountTokenTest {
    @Test
    fun `derives the pinned RFC 4122 vector`() {
        assertEquals(
            "2ed6657d-e927-568b-95e1-2665a8aea6a2",
            AccountToken.uuidV5(DNS_NAMESPACE, "www.example.com"),
        )
    }

    @Test
    fun `the voidhash namespace is derived from the DNS namespace`() {
        assertEquals(
            AccountToken.NAMESPACE,
            AccountToken.uuidV5(DNS_NAMESPACE, "appaccounttoken.voidhash.com"),
        )
    }

    @Test
    fun `derives the pinned distinct id vectors`() {
        assertEquals("3501e751-7582-58f9-9c1d-533c7466049f", AccountToken.derive("user-123"))
        assertEquals("c6eb5cb5-739d-52a9-9a32-6a0fb4be71cc", AccountToken.derive("USER-123"))
        assertEquals("22c4cde2-2c40-5266-9699-35f7d271e1a8", AccountToken.derive("vh:anon:k2j4h5g6f7"))
    }

    @Test
    fun `hashes UTF-8 bytes, not code units`() {
        assertEquals(
            "84080bfc-8e5a-5daf-9ec4-c2221ea8d948",
            AccountToken.derive("naïve@exämple.com"),
        )
    }
}

class IdentityStoreTest {
    private fun store(anonymousId: String = "vh:anon:test") =
        IdentityStore(CacheManager(InMemoryCacheAdapter())) { anonymousId }

    @Test
    fun `generates and persists an anonymous distinct id`() {
        val identityStore = store()
        val distinctId = identityStore.getDistinctId()

        assertTrue(distinctId.startsWith("vh:anon:"))
        assertEquals(distinctId, identityStore.getDistinctId())
        assertTrue(identityStore.isAnonymous())
    }

    @Test
    fun `identify replaces the distinct id and reset drops it`() {
        val identityStore = store()
        identityStore.getDistinctId()

        identityStore.setDistinctId("user-123")
        assertEquals("user-123", identityStore.getDistinctId())
        assertTrue(!identityStore.isAnonymous())

        identityStore.reset()
        assertEquals("vh:anon:test", identityStore.getDistinctId())
    }
}
