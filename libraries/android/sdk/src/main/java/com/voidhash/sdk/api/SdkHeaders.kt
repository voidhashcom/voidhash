package com.voidhash.sdk.api

import com.voidhash.sdk.AnalyticsConsent
import com.voidhash.sdk.VOIDHASH_SDK_VERSION
import com.voidhash.sdk.platform.PlatformInfo
import java.util.UUID

private const val HEX_DIGITS = "0123456789ABCDEF"

/**
 * Builds the header set every `/api/v1/sdk` request carries. The names and
 * values are a wire contract shared with the other Voidhash SDKs — see
 * `src/core/utils/get-common-sdk-headers.ts`.
 *
 * HTTP header values are printable ASCII, and OkHttp refuses to build a request with anything
 * else. A distinct id outside that range is sent percent-encoded (UTF-8, RFC 3986) together
 * with `x-distinct-id-encoding: percent`, which tells the API to decode it. So is one with a
 * leading or trailing space, which OkHttp and every HTTP hop would otherwise trim. Free-text
 * device and app metadata is informational, so its non-ASCII characters are percent-encoded
 * without a marker. Other printable ASCII values are sent exactly as given.
 */
class SdkHeaders(
    private val publishableKey: String,
    private val platform: PlatformInfo,
    private val readOnlyProvider: () -> Boolean = { false },
    private val debugProvider: () -> Boolean = { false },
    private val sdkVersion: String = VOIDHASH_SDK_VERSION,
    /** Sent as `x-sdk`: `android`, or the SDK wrapping this one, such as `react-native`. */
    private val sdkName: String = "android",
    private val nonceProvider: () -> String = { UUID.randomUUID().toString() },
    /** Whether none of the app's activities is started, sent as `x-is-backgrounded`. */
    private val backgroundedProvider: () -> Boolean = { false },
    /** The end user's analytics consent, sent as `x-analytics-consent` unless granted. */
    private val analyticsConsentProvider: () -> AnalyticsConsent = { AnalyticsConsent.GRANTED },
) {
    /** Returns the common headers for a request made as [distinctId]. */
    fun build(distinctId: String): Map<String, String> {
        val distinctIdSentAsIs = distinctId.all(::isPrintableAscii) &&
            !distinctId.startsWith(' ') && !distinctId.endsWith(' ')
        val headers = linkedMapOf(
            "x-publishable-key" to publishableKey,
            "x-distinct-id" to if (distinctIdSentAsIs) {
                distinctId
            } else {
                percentEncode(distinctId, ::isUnreserved)
            },
            "x-observer-mode" to if (readOnlyProvider()) "true" else "false",
            "x-is-debug-build" to if (debugProvider() || platform.isDebugBuild) "true" else "false",
            "x-nonce" to nonceProvider(),
            "x-sdk" to sdkName,
            "x-sdk-version" to sdkVersion,
            "x-platform" to "android",
            "x-platform-flavor" to "native",
            "x-client-bundle-id" to percentEncode(platform.bundleId, ::isPrintableAscii),
            "x-is-backgrounded" to if (backgroundedProvider()) "true" else "false",
        )
        if (!distinctIdSentAsIs) headers["x-distinct-id-encoding"] = "percent"
        val consent = analyticsConsentProvider()
        if (consent != AnalyticsConsent.GRANTED) headers["x-analytics-consent"] = consent.wireValue

        platform.systemVersion?.let { headers["x-platform-version"] = percentEncode(it, ::isPrintableAscii) }
        platform.deviceBrand?.let { headers["x-platform-brand"] = percentEncode(it, ::isPrintableAscii) }
        platform.deviceName?.let { headers["x-platform-device"] = percentEncode(it, ::isPrintableAscii) }
        platform.appVersion?.let {
            headers["x-client-version"] = percentEncode(it, ::isPrintableAscii)
            headers["x-platform-flavor-version"] = percentEncode(it, ::isPrintableAscii)
        }
        platform.locales.firstOrNull()?.let { headers["x-client-locale"] = percentEncode(it, ::isPrintableAscii) }
        if (platform.locales.isNotEmpty()) {
            headers["x-preferred-locales"] = percentEncode(platform.locales.joinToString(","), ::isPrintableAscii)
        }

        return headers
    }

    /** Percent-encodes the UTF-8 bytes of every character [keep] rejects. */
    private fun percentEncode(value: String, keep: (Char) -> Boolean): String {
        if (value.all(keep)) return value
        val encoded = StringBuilder()
        for (byte in value.toByteArray(Charsets.UTF_8)) {
            val octet = byte.toInt() and 0xFF
            // Every byte of a multi-byte character is >= 0x80, so it is never kept as is.
            if (octet < 0x80 && keep(octet.toChar())) {
                encoded.append(octet.toChar())
            } else {
                encoded.append('%').append(HEX_DIGITS[octet shr 4]).append(HEX_DIGITS[octet and 0x0F])
            }
        }
        return encoded.toString()
    }

    private fun isPrintableAscii(char: Char): Boolean = char in ' '..'~'

    private fun isUnreserved(char: Char): Boolean =
        char in 'A'..'Z' || char in 'a'..'z' || char in '0'..'9' || char in "-._~"
}
