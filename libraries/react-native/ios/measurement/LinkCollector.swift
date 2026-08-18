import CryptoKit
import Foundation

/** Captures iOS link callbacks into the encrypted, pre-JavaScript inbox. */
@objcMembers public final class VoidhashLinkCollector: NSObject, @unchecked Sendable {
    public static let shared = VoidhashLinkCollector()

    private let lock = NSLock()
    private lazy var store: MeasurementStore? = try? MeasurementStore()

    /** Captures a Universal Link, custom-scheme URL, or launch URL before React Native starts. */
    @discardableResult
    public func capture(
        url: URL,
        source: String,
        appState: String
    ) -> Bool {
        lock.withLock {
            guard let store else { return false }
            return (try? Self.capture(
                store: store,
                raw: url.absoluteString,
                source: source,
                appState: appState
            )) ?? false
        }
    }

    @discardableResult
    static func capture(
        store: MeasurementStore,
        raw: String,
        source: String,
        appState: String,
        now: Date = Date()
    ) throws -> Bool {
        let digest = SHA256.hash(data: Data(raw.utf8)).map { String(format: "%02x", $0) }.joined()
        let nowMs = Int64(now.timeIntervalSince1970 * 1_000)
        guard try store.checkAndSetDedupe(
            namespace: "native-link-capture",
            key: digest,
            expiresAtMs: nowMs + 30_000
        ) else { return false }
        let blobId = "link-\(UUID().uuidString.lowercased())"
        _ = try store.putProtectedEvidence(
            blobId: blobId,
            purpose: "link-capture",
            consentRevision: 0,
            retentionClass: "installation",
            value: Data(raw.utf8)
        )
        return try store.appendInbox(
            id: "inbox-\(UUID().uuidString.lowercased())",
            kind: "link",
            source: source,
            appState: appState,
            receivedAt: ISO8601DateFormatter().string(from: now),
            protectedPayloadRef: blobId
        )
    }
}
