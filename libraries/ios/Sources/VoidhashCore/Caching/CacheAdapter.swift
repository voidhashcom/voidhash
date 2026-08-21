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

/// `UserDefaults` backed ``CacheAdapter``.
///
/// Keys are namespaced with `keyPrefix` because `UserDefaults` is shared with the host app,
/// unlike the private AsyncStorage namespace the React Native SDK writes to.
public final class UserDefaultsCacheAdapter: CacheAdapter {
    /// Default namespace applied to every key written by the SDK.
    public static let defaultKeyPrefix = "voidhash:"

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

/// In-memory ``CacheAdapter``, useful for tests and for opting out of persistence.
public actor InMemoryCacheAdapter: CacheAdapter {
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
}
