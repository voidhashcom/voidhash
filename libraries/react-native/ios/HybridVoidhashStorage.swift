import Foundation
import NitroModules

/// Exposes the bare-native cache store to the React Native SDK. The behaviour lives in
/// ``VoidhashStorageCore``; this class only bridges it into Nitro.
final class HybridVoidhashStorage: HybridVoidhashStorageSpec {
    private let core = VoidhashStorageCore()

    func get(key: String) throws -> Promise<String?> {
        return Promise.async {
            await self.core.get(key)
        }
    }

    func set(key: String, value: String) throws -> Promise<Void> {
        return Promise.async {
            await self.core.set(key, value: value)
        }
    }

    func delete(key: String) throws -> Promise<Void> {
        return Promise.async {
            await self.core.delete(key)
        }
    }
}
