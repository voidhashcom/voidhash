import Foundation

/// Shared constants and encoders for the paywall WebView bridge.
///
/// The page-facing API stays `window.ReactNativeWebView.postMessage` on every platform because
/// deployed paywall HTML depends on it. The delivery script and the ASCII-safe JSON escaping
/// must stay byte-identical to `src/internal/paywall-bridge/protocol.ts` and to the Android
/// core.
public enum PaywallBridge {
    /// Envelope version understood by the paywall runtime.
    public static let version = 1

    /// Name of the WKWebView script message handler the shim posts to.
    public static let messageHandlerName = "reactNative"

    /// Installs the `window.ReactNativeWebView.postMessage` shim in the page.
    public static let shimScript =
        "window.ReactNativeWebView = window.ReactNativeWebView || {}; window.ReactNativeWebView.postMessage = function(data) { window.webkit.messageHandlers.reactNative.postMessage(String(data)); };"

    /// Escapes every non-ASCII UTF-16 code unit as `\\uXXXX`.
    ///
    /// Inbound messages are delivered base64-encoded and decoded in the page with `atob`, which
    /// yields one Latin-1 character per byte — multi-byte UTF-8 sequences (localized prices like
    /// `"59,99 €"`) would arrive as mojibake. Escaping per code unit keeps the payload pure ASCII
    /// and is surrogate-pair-safe.
    public static func asciiSafeJson(_ json: String) -> String {
        var escaped = ""
        escaped.reserveCapacity(json.utf16.count)

        for unit in json.utf16 {
            if unit < 0x80, let scalar = Unicode.Scalar(unit) {
                escaped.unicodeScalars.append(scalar)
            } else {
                escaped += String(format: "\\u%04x", unit)
            }
        }

        return escaped
    }

    /// Builds the JavaScript that delivers a native → page message.
    public static func inboundScript(json: String) -> String {
        let encoded = Data(asciiSafeJson(json).utf8).base64EncodedString()
        return "(function(){const d=atob('" + encoded
            + "');window.dispatchEvent(new MessageEvent('message',{data:d}));if(typeof window.onVoidhashNativeMessage==='function'){window.onVoidhashNativeMessage(d);}})();"
    }
}
