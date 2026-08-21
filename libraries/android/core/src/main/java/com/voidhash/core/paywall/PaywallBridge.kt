package com.voidhash.core.paywall

/**
 * Shared paywall bridge contract between the native presenters and the paywall
 * page. Every constant here is part of the wire contract and must stay
 * behaviourally identical to the iOS `PaywallBridge.swift` counterpart and the
 * TypeScript `src/internal/paywall-bridge/protocol.ts`.
 */
object PaywallBridge {
    /** Envelope version understood by deployed paywall bundles. */
    const val VERSION = 1

    /**
     * Name of the JavaScript interface exposed to the page. Deployed paywall
     * HTML calls `window.ReactNativeWebView.postMessage(...)`, so the name is
     * load-bearing on every platform, React Native or not.
     */
    const val JS_INTERFACE_NAME = "ReactNativeWebView"

    /**
     * Shim installed in the page so `window.ReactNativeWebView.postMessage`
     * forwards to the injected Android JavaScript interface.
     */
    const val MESSAGING_SHIM_SCRIPT =
        "window.ReactNativeWebView = window.ReactNativeWebView || {};" +
            "window.ReactNativeWebView.postMessage = function(data) {" +
            "ReactNativeWebView.postMessage(String(data));" +
            "};"

    private const val BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

    /**
     * Escapes every non-ASCII code unit as `\uXXXX`.
     *
     * Inbound messages are delivered by base64-encoding the JSON and decoding it
     * in the page with `atob`, which yields one Latin-1 character per byte.
     * Multi-byte UTF-8 sequences (localized prices like "59,99 €") would arrive
     * as mojibake, so the payload must be pure ASCII before encoding.
     */
    fun escapeNonAscii(json: String): String {
        val builder = StringBuilder(json.length)
        for (character in json) {
            if (character.code < 0x80) {
                builder.append(character)
            } else {
                builder.append("\\u").append(character.code.toString(16).padStart(4, '0'))
            }
        }
        return builder.toString()
    }

    /**
     * Builds the native → page delivery script for [json]. The payload is
     * ASCII-escaped, base64-encoded and decoded with `atob` inside the page.
     */
    fun inboundScript(json: String): String {
        val encoded = base64(escapeNonAscii(json))
        return "(function(){const d=atob('$encoded');window.dispatchEvent(new MessageEvent('message',{data:d}));if(typeof window.onVoidhashNativeMessage==='function'){window.onVoidhashNativeMessage(d);}})();"
    }

    /**
     * Base64-encodes [value]'s UTF-8 bytes without line wrapping. Implemented
     * here rather than through `android.util.Base64` so the bridge stays
     * testable on the JVM and free of framework dependencies.
     */
    fun base64(value: String): String {
        val bytes = value.toByteArray(Charsets.UTF_8)
        val builder = StringBuilder((bytes.size + 2) / 3 * 4)
        var index = 0
        while (index + 2 < bytes.size) {
            val chunk = (bytes[index].toInt() and 0xff shl 16) or
                (bytes[index + 1].toInt() and 0xff shl 8) or
                (bytes[index + 2].toInt() and 0xff)
            builder.append(BASE64_ALPHABET[chunk ushr 18 and 0x3f])
            builder.append(BASE64_ALPHABET[chunk ushr 12 and 0x3f])
            builder.append(BASE64_ALPHABET[chunk ushr 6 and 0x3f])
            builder.append(BASE64_ALPHABET[chunk and 0x3f])
            index += 3
        }

        when (bytes.size - index) {
            1 -> {
                val chunk = bytes[index].toInt() and 0xff shl 16
                builder.append(BASE64_ALPHABET[chunk ushr 18 and 0x3f])
                builder.append(BASE64_ALPHABET[chunk ushr 12 and 0x3f])
                builder.append("==")
            }
            2 -> {
                val chunk = (bytes[index].toInt() and 0xff shl 16) or
                    (bytes[index + 1].toInt() and 0xff shl 8)
                builder.append(BASE64_ALPHABET[chunk ushr 18 and 0x3f])
                builder.append(BASE64_ALPHABET[chunk ushr 12 and 0x3f])
                builder.append(BASE64_ALPHABET[chunk ushr 6 and 0x3f])
                builder.append("=")
            }
        }

        return builder.toString()
    }
}
