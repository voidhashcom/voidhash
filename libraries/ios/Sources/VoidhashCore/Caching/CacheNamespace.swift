import Foundation

/// Builds the storage key prefix isolating one SDK configuration from every other writer.
///
/// `UserDefaults` is shared with the host app, so a bare `voidhash:` prefix can collide with the
/// host's own keys and, worse, two clients configured with different publishable keys or origins
/// would read each other's entries. The namespace is
/// `vh:<schemaVersion>:<hash(publishableKey + baseUrl)>:`; bumping ``schemaVersion`` lets a future
/// release abandon the whole namespace without migration heuristics.
public enum CacheNamespace {
    /// Version of the persisted cache layout.
    public static let schemaVersion = 1

    /// Returns the prefix every key written for this configuration carries.
    public static func prefix(publishableKey: String, baseUrl: URL) -> String {
        let fingerprint = hash(publishableKey + "|" + baseUrl.absoluteString)
        return "vh:\(schemaVersion):\(fingerprint):"
    }

    /// 32-bit FNV-1a over UTF-8, rendered as eight lowercase hex digits.
    ///
    /// Deliberately not `hashValue`: Swift seeds that per process, so it would produce a
    /// different namespace on every launch. The width and rendering match the Kotlin and
    /// TypeScript SDKs so an embedded client and its host SDK derive one namespace.
    public static func hash(_ value: String) -> String {
        var result: UInt32 = 0x811c_9dc5
        for byte in Array(value.utf8) {
            result ^= UInt32(byte)
            result = result &* 0x0100_0193
        }
        let hex = String(result, radix: 16)
        return String(repeating: "0", count: max(0, 8 - hex.count)) + hex
    }
}
