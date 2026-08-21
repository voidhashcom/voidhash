package com.voidhash.sdk.api

import com.voidhash.sdk.VOIDHASH_SDK_VERSION
import com.voidhash.sdk.platform.PlatformInfo
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse

internal fun testPlatformInfo(
    appVersion: String? = "1.4.2",
    locales: List<String> = listOf("en-US", "de-DE"),
    isDebugBuild: Boolean = false,
) = PlatformInfo(
    bundleId = "com.example.app",
    appVersion = appVersion,
    systemVersion = "14",
    deviceBrand = "Google",
    deviceName = "Pixel 8",
    locales = locales,
    isDebugBuild = isDebugBuild,
)

class SdkHeadersTest {
    @Test
    fun `builds the shared header set`() {
        val headers = SdkHeaders(
            publishableKey = "pk_test",
            platform = testPlatformInfo(),
            nonceProvider = { "nonce-1" },
        ).build("vh:anon:abc")

        assertEquals("pk_test", headers["x-publishable-key"])
        assertEquals("vh:anon:abc", headers["x-distinct-id"])
        assertEquals("production", headers["x-environment"])
        assertEquals("false", headers["x-observer-mode"])
        assertEquals("false", headers["x-is-debug-build"])
        assertEquals("nonce-1", headers["x-nonce"])
        assertEquals("android", headers["x-sdk"])
        assertEquals(VOIDHASH_SDK_VERSION, headers["x-sdk-version"])
        assertEquals("android", headers["x-platform"])
        assertEquals("14", headers["x-platform-version"])
        assertEquals("Google", headers["x-platform-brand"])
        assertEquals("Pixel 8", headers["x-platform-device"])
        assertEquals("native", headers["x-platform-flavor"])
        assertEquals("1.4.2", headers["x-platform-flavor-version"])
        assertEquals("com.example.app", headers["x-client-bundle-id"])
        assertEquals("1.4.2", headers["x-client-version"])
        assertEquals("en-US", headers["x-client-locale"])
        assertEquals("en-US,de-DE", headers["x-preferred-locales"])
        assertEquals("false", headers["x-is-backgrounded"])
    }

    @Test
    fun `observer mode and debug builds are reported`() {
        val headers = SdkHeaders(
            publishableKey = "pk_test",
            platform = testPlatformInfo(isDebugBuild = true),
            readOnlyProvider = { true },
        ).build("user-123")

        assertEquals("true", headers["x-observer-mode"])
        assertEquals("true", headers["x-is-debug-build"])
    }

    @Test
    fun `optional headers are omitted when unknown`() {
        val headers = SdkHeaders(
            publishableKey = "pk_test",
            platform = testPlatformInfo(appVersion = null, locales = emptyList()),
        ).build("user-123")

        assertFalse(headers.containsKey("x-client-version"))
        assertFalse(headers.containsKey("x-client-locale"))
        assertFalse(headers.containsKey("x-preferred-locales"))
    }
}
