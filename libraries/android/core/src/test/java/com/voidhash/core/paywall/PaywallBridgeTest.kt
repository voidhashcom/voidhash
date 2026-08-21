package com.voidhash.core.paywall

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class PaywallBridgeTest {
    @Test
    fun `escapes every non-ascii code unit as a lowercase unicode escape`() {
        assertEquals(
            "{\"priceString\":\"59,99 \\u20ac\"}",
            PaywallBridge.escapeNonAscii("""{"priceString":"59,99 €"}"""),
        )
    }

    @Test
    fun `escapes surrogate pairs per code unit`() {
        assertEquals("\\ud83d\\ude80", PaywallBridge.escapeNonAscii("🚀"))
    }

    @Test
    fun `leaves ascii payloads untouched`() {
        val json = """{"version":1,"type":"status","payload":{"status":"purchased"}}"""
        assertEquals(json, PaywallBridge.escapeNonAscii(json))
    }

    @Test
    fun `base64 matches the jdk encoder for every padding length`() {
        listOf("", "a", "ab", "abc", "abcd", "abcde", """{"a":"b"}""").forEach { value ->
            assertEquals(
                java.util.Base64.getEncoder().encodeToString(value.toByteArray(Charsets.UTF_8)),
                PaywallBridge.base64(value),
                "base64 mismatch for \"$value\"",
            )
        }
    }

    @Test
    fun `inbound script carries an ascii-safe base64 payload the page can atob`() {
        val json = """{"version":1,"type":"configure","payload":{"priceString":"59,99 €"}}"""
        val script = PaywallBridge.inboundScript(json)

        val encoded = script.substringAfter("const d=atob('").substringBefore("')")
        val decoded = String(java.util.Base64.getDecoder().decode(encoded), Charsets.ISO_8859_1)

        assertTrue(decoded.all { it.code < 0x80 }, "payload must be pure ascii")
        assertEquals(
            "{\"version\":1,\"type\":\"configure\",\"payload\":{\"priceString\":\"59,99 \\u20ac\"}}",
            decoded,
        )
        assertEquals(
            "(function(){const d=atob('$encoded');window.dispatchEvent(new MessageEvent('message',{data:d}));if(typeof window.onVoidhashNativeMessage==='function'){window.onVoidhashNativeMessage(d);}})();",
            script,
        )
    }

    @Test
    fun `exposes the page-facing bridge names`() {
        assertEquals(1, PaywallBridge.VERSION)
        assertEquals("ReactNativeWebView", PaywallBridge.JS_INTERFACE_NAME)
        assertEquals(
            "window.ReactNativeWebView = window.ReactNativeWebView || {};" +
                "window.ReactNativeWebView.postMessage = function(data) {" +
                "ReactNativeWebView.postMessage(String(data));" +
                "};",
            PaywallBridge.MESSAGING_SHIM_SCRIPT,
        )
    }
}
