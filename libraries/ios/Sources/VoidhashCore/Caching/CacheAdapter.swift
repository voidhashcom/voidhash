import Foundation

/// Key/value string storage backing ``CacheManager``.
///
/// Mirrors the React Native `CacheAdapter` service so both SDKs persist the exact same JSON
/// envelopes.
public protocol CacheAdapter: Sendable {
    /// Returns the stored string for `key`, or `nil` when absent.
    func get(_ key: String) async -> String?
    /// Stores `value` under `key`.
    func set(_ key: String, value: String) async
    /// Removes the entry stored under `key`.
    func delete(_ key: String) async
}

/// A ``CacheAdapter`` that can list what it holds.
///
/// Only needed by the one-time migration out of the pre-namespace layout, which has to find
/// entries whose keys it does not know in advance (`person:*`, `processed-transaction:*`).
public protocol EnumerableCacheAdapter: CacheAdapter {
    /// Every key currently stored in this adapter's namespace, without the namespace prefix.
    func keys() async -> [String]
}

/// `UserDefaults` backed ``CacheAdapter``.
///
/// Keys are namespaced with `keyPrefix` because `UserDefaults` is shared with the host app. Use
/// ``init(defaults:publishableKey:baseUrl:)`` so the namespace also separates two clients
/// configured with different keys or origins.
public final class UserDefaultsCacheAdapter: CacheAdapter {
    /// Namespace used when no publishable key is supplied.
    public static let defaultKeyPrefix = "vh:\(CacheNamespace.schemaVersion):"

    // `UserDefaults` is thread-safe but not annotated `Sendable`.
    private nonisolated(unsafe) let defaults: UserDefaults
    private let keyPrefix: String

    public init(
        defaults: UserDefaults = .standard,
        keyPrefix: String = UserDefaultsCacheAdapter.defaultKeyPrefix
    ) {
        self.defaults = defaults
        self.keyPrefix = keyPrefix
    }

    /// Namespaces every key by the publishable key and API origin, per ``CacheNamespace``.
    public convenience init(
        defaults: UserDefaults = .standard,
        publishableKey: String,
        baseUrl: URL
    ) {
        self.init(
            defaults: defaults,
            keyPrefix: CacheNamespace.prefix(publishableKey: publishableKey, baseUrl: baseUrl))
    }

    /// The namespace prefix applied to every key.
    public var namespace: String {
        return keyPrefix
    }

    public func get(_ key: String) async -> String? {
        return defaults.string(forKey: keyPrefix + key)
    }

    public func set(_ key: String, value: String) async {
        defaults.set(value, forKey: keyPrefix + key)
    }

    public func delete(_ key: String) async {
        defaults.removeObject(forKey: keyPrefix + key)
    }
}

extension UserDefaultsCacheAdapter: EnumerableCacheAdapter {
    public func keys() async -> [String] {
        return defaults.dictionaryRepresentation().keys
            .filter { $0.hasPrefix(keyPrefix) }
            .map { String($0.dropFirst(keyPrefix.count)) }
    }
}

/// In-memory ``CacheAdapter``, useful for tests and for opting out of persistence.
public actor InMemoryCacheAdapter: EnumerableCacheAdapter {
    private var storage: [String: String] = [:]

    public init() {}

    public func get(_ key: String) async -> String? {
        return storage[key]
    }

    public func set(_ key: String, value: String) async {
        storage[key] = value
    }

    public func delete(_ key: String) async {
        storage.removeValue(forKey: key)
    }

    public func keys() async -> [String] {
        return Array(storage.keys)
    }
}
