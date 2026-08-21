package com.voidhash.sdk.api

import com.voidhash.sdk.VOIDHASH_SDK_VERSION
import com.voidhash.sdk.platform.PlatformInfo
import java.util.UUID

/**
 * Builds the header set every `/api/v1/sdk` request carries. The names and
 * values are a wire contract shared with the other Voidhash SDKs — see
 * `src/core/utils/get-common-sdk-headers.ts`.
 */
class SdkHeaders(
    private val publishableKey: String,
    private val platform: PlatformInfo,
    private val readOnlyProvider: () -> Boolean = { false },
    private val debugProvider: () -> Boolean = { false },
    private val sdkVersion: String = VOIDHASH_SDK_VERSION,
    private val nonceProvider: () -> String = { UUID.randomUUID().toString() },
) {
    /** Returns the common headers for a request made as [distinctId]. */
    fun build(distinctId: String): Map<String, String> {
        val headers = linkedMapOf(
            "x-publishable-key" to publishableKey,
            "x-distinct-id" to distinctId,
            "x-environment" to "production",
            "x-observer-mode" to if (readOnlyProvider()) "true" else "false",
            "x-is-debug-build" to if (debugProvider() || platform.isDebugBuild) "true" else "false",
            "x-nonce" to nonceProvider(),
            "x-sdk" to "android",
            "x-sdk-version" to sdkVersion,
            "x-platform" to "android",
            "x-platform-flavor" to "native",
            "x-client-bundle-id" to platform.bundleId,
            "x-is-backgrounded" to "false",
        )

        platform.systemVersion?.let { headers["x-platform-version"] = it }
        platform.deviceBrand?.let { headers["x-platform-brand"] = it }
        platform.deviceName?.let { headers["x-platform-device"] = it }
        platform.appVersion?.let {
            headers["x-client-version"] = it
            headers["x-platform-flavor-version"] = it
        }
        platform.locales.firstOrNull()?.let { headers["x-client-locale"] = it }
        if (platform.locales.isNotEmpty()) {
            headers["x-preferred-locales"] = platform.locales.joinToString(",")
        }

        return headers
    }
}
