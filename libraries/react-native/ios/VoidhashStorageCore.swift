import Foundation
import VoidhashCore

/// The Nitro-free heart of `HybridVoidhashStorage`: the React Native SDK's cache store.
///
/// Wraps the same ``UserDefaultsCacheAdapter`` the Swift SDK persists through — same suite, same
/// key prefix — so the TypeScript `CacheManager` and the embedded native client share one cache.
/// The adapter is injectable so tests can isolate a `UserDefaults` suite.
final class VoidhashStorageCore: Sendable {
    private let adapter: any CacheAdapter

    init(adapter: any CacheAdapter = UserDefaultsCacheAdapter()) {
        self.adapter = adapter
    }

    func get(_ key: String) async -> String? {
        return await adapter.get(key)
    }

    func set(_ key: String, value: String) async {
        await adapter.set(key, value: value)
    }

    func delete(_ key: String) async {
        await adapter.delete(key)
    }
}
