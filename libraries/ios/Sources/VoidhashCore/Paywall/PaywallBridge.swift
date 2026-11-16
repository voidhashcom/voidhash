import Foundation

/// Shared constants of the envelope a flow and its host exchange.
public enum PaywallBridge {
    /// Envelope version understood by the flow runtime.
    public static let version = 1

    /// Escapes every non-ASCII UTF-16 code unit as `\\uXXXX`, so an envelope survives transports
    /// that are not UTF-8 clean. Escaping per code unit is surrogate-pair-safe.
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
}
