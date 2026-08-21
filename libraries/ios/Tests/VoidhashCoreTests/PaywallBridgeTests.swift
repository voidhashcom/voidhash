import Foundation
import Testing

@testable import VoidhashCore

@Suite("Paywall bridge encoding")
struct PaywallBridgeTests {
    @Test("ASCII payloads are untouched")
    func asciiPayloadUnchanged() {
        let json = "{\"version\":1,\"type\":\"status\",\"payload\":{\"status\":\"purchasing\"}}"

        #expect(PaywallBridge.asciiSafeJson(json) == json)
    }

    @Test("non-ASCII code units escape as \\uXXXX")
    func escapesNonAscii() {
        let json = "{\"priceString\":\"59,99 \u{20ac}\"}"

        #expect(PaywallBridge.asciiSafeJson(json) == "{\"priceString\":\"59,99 \\u20ac\"}")
    }

    @Test("surrogate pairs escape per code unit")
    func escapesSurrogatePairs() {
        #expect(PaywallBridge.asciiSafeJson("{\"emoji\":\"\u{1f600}\"}") == "{\"emoji\":\"\\ud83d\\ude00\"}")
        #expect(PaywallBridge.asciiSafeJson("\"na\u{ef}ve\"") == "\"na\\u00efve\"")
    }

    @Test("escaping is idempotent for already escaped payloads")
    func escapingIsIdempotent() {
        let escaped = PaywallBridge.asciiSafeJson("{\"priceString\":\"59,99 \u{20ac}\"}")

        #expect(PaywallBridge.asciiSafeJson(escaped) == escaped)
    }

    @Test("inbound script matches the shared delivery contract")
    func inboundScriptContract() {
        let json = "{\"version\":1,\"type\":\"configure\",\"payload\":{\"products\":[{\"priceString\":\"59,99 \u{20ac}\"}]}}"
        let expectedBase64 =
            "eyJ2ZXJzaW9uIjoxLCJ0eXBlIjoiY29uZmlndXJlIiwicGF5bG9hZCI6eyJwcm9kdWN0cyI6W3sicHJpY2VTdHJpbmciOiI1OSw5OSBcdTIwYWMifV19fQ=="

        let script = PaywallBridge.inboundScript(json: json)

        #expect(
            script
                == "(function(){const d=atob('" + expectedBase64
                + "');window.dispatchEvent(new MessageEvent('message',{data:d}));if(typeof window.onVoidhashNativeMessage==='function'){window.onVoidhashNativeMessage(d);}})();"
        )
    }

    @Test("base64 payload round-trips to the JSON the page parses")
    func roundTripsThroughBase64() throws {
        let json = "{\"priceString\":\"59,99 \u{20ac}\"}"

        let script = PaywallBridge.inboundScript(json: json)
        let encoded = try #require(
            script.split(separator: "'").dropFirst().first.map(String.init))
        let decoded = try #require(Data(base64Encoded: encoded))
        let delivered = try #require(String(data: decoded, encoding: .ascii))

        #expect(delivered == "{\"priceString\":\"59,99 \\u20ac\"}")

        let parsed =
            try JSONSerialization.jsonObject(with: Data(delivered.utf8)) as? [String: Any]
        #expect(parsed?["priceString"] as? String == "59,99 \u{20ac}")
    }

    @Test("bridge constants stay on the deployed page contract")
    func bridgeConstants() {
        #expect(PaywallBridge.version == 1)
        #expect(PaywallBridge.messageHandlerName == "reactNative")
        #expect(
            PaywallBridge.shimScript
                == "window.ReactNativeWebView = window.ReactNativeWebView || {}; window.ReactNativeWebView.postMessage = function(data) { window.webkit.messageHandlers.reactNative.postMessage(String(data)); };"
        )
    }
}
