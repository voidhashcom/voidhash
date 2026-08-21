import CryptoKit
import Foundation

/// Deterministic account identifiers supplied to StoreKit and Google Play.
///
/// The derivation is a cross-platform contract: the backend resolves purchases by recomputing
/// the same UUIDv5, so the namespace, hash and lowercase formatting must match
/// `src/core/utils/account-token.ts` byte for byte.
public enum AccountToken {
    /// Shared UUIDv5 namespace for StoreKit and Google Play account identifiers.
    public static let namespace = "3919eb4e-3466-593c-8c1e-84554e13a0a6"

    /// Derives an RFC 4122 UUIDv5 from a namespace UUID and a UTF-8 name.
    ///
    /// - Returns: The lowercase UUID string, or `nil` when `namespaceUuid` is not a UUID.
    public static func uuidV5(namespaceUuid: String, name: String) -> String? {
        guard let namespaceBytes = uuidToBytes(namespaceUuid) else {
            return nil
        }

        var input = namespaceBytes
        input.append(contentsOf: Array(name.utf8))

        var bytes = Array(Insecure.SHA1.hash(data: Data(input)).prefix(16))
        bytes[6] = (bytes[6] & 0x0f) | 0x50
        bytes[8] = (bytes[8] & 0x3f) | 0x80
        return bytesToUuid(bytes)
    }

    /// Derives the deterministic account token for a distinct id.
    public static func derive(distinctId: String) -> String {
        // The namespace is a compile-time constant UUID, so the parse can never fail.
        return uuidV5(namespaceUuid: namespace, name: distinctId) ?? ""
    }

    private static func uuidToBytes(_ uuid: String) -> [UInt8]? {
        let hex = uuid.replacingOccurrences(of: "-", with: "")
        guard hex.count == 32 else {
            return nil
        }

        var bytes: [UInt8] = []
        bytes.reserveCapacity(16)
        var index = hex.startIndex
        while index < hex.endIndex {
            let next = hex.index(index, offsetBy: 2)
            guard let byte = UInt8(hex[index..<next], radix: 16) else {
                return nil
            }
            bytes.append(byte)
            index = next
        }
        return bytes
    }

    private static func bytesToUuid(_ bytes: [UInt8]) -> String {
        let hex = bytes.map { String(format: "%02x", $0) }.joined()
        let slice = { (start: Int, end: Int) -> String in
            let lower = hex.index(hex.startIndex, offsetBy: start)
            let upper = hex.index(hex.startIndex, offsetBy: end)
            return String(hex[lower..<upper])
        }
        return [slice(0, 8), slice(8, 12), slice(12, 16), slice(16, 20), slice(20, 32)]
            .joined(separator: "-")
    }
}
