import Foundation
import Testing

@testable import VoidhashCore

/// Clock whose value tests can move forward.
private final class MutableClock: @unchecked Sendable {
    private let lock = NSLock()
    private var value: Double

    init(_ value: Double) {
        self.value = value
    }

    var now: Double {
        lock.lock()
        defer { lock.unlock() }
        return value
    }

    func advance(by milliseconds: Double) {
        lock.lock()
        value += milliseconds
        lock.unlock()
    }
}

@Suite("Cache manager")
struct CacheManagerTests {
    @Test("a fresh entry round-trips with its envelope timestamps")
    func freshEntry() async throws {
        let clock = MutableClock(1000)
        let adapter = InMemoryCacheAdapter()
        let cache = CacheManager(adapter: adapter, now: { clock.now })

        await cache.set("greeting", value: "hello", ttl: 5000, staleTime: 1000)
        let hit = try #require(await cache.get("greeting", as: String.self))

        #expect(hit.value == "hello")
        #expect(hit.createdAt == 1000)
        #expect(hit.staleAt == 2000)
        #expect(hit.expiresAt == 6000)
        #expect(hit.isStale == false)
        #expect(hit.isExpired == false)
    }

    @Test("an entry past staleAt is still served, flagged stale")
    func staleEntry() async throws {
        let clock = MutableClock(1000)
        let cache = CacheManager(adapter: InMemoryCacheAdapter(), now: { clock.now })

        await cache.set("greeting", value: "hello", ttl: 5000, staleTime: 1000)
        clock.advance(by: 1500)
        let hit = try #require(await cache.get("greeting", as: String.self))

        #expect(hit.isStale == true)
        #expect(hit.isExpired == false)
    }

    @Test("an expired entry is deleted and reported as a miss")
    func expiredEntry() async {
        let clock = MutableClock(1000)
        let adapter = InMemoryCacheAdapter()
        let cache = CacheManager(adapter: adapter, now: { clock.now })

        await cache.set("greeting", value: "hello", ttl: 5000)
        clock.advance(by: 6000)

        #expect(await cache.get("greeting", as: String.self) == nil)
        #expect(await adapter.get("greeting") == nil)
    }

    @Test("entries without a ttl never expire and are never stale")
    func entryWithoutTtl() async throws {
        let clock = MutableClock(1000)
        let cache = CacheManager(adapter: InMemoryCacheAdapter(), now: { clock.now })

        await cache.set("greeting", value: "hello")
        clock.advance(by: 1_000_000)
        let hit = try #require(await cache.get("greeting", as: String.self))

        #expect(hit.isStale == false)
        #expect(hit.expiresAt == nil)
        #expect(hit.staleAt == nil)
    }

    @Test("a zero ttl and stale time mean never, as they do in the TypeScript SDK")
    func zeroDurationsNeverElapse() async throws {
        let clock = MutableClock(1000)
        let adapter = InMemoryCacheAdapter()
        let cache = CacheManager(adapter: adapter, now: { clock.now })

        await cache.set("greeting", value: "hello", ttl: 0, staleTime: 0)
        clock.advance(by: 1_000_000)
        let hit = try #require(await cache.get("greeting", as: String.self))

        #expect(hit.value == "hello")
        #expect(hit.expiresAt == nil)
        #expect(hit.staleAt == nil)
        #expect(hit.isExpired == false)
        #expect(hit.isStale == false)

        // Written as an explicit `null`, exactly like a missing ttl.
        let raw = try #require(await adapter.get("greeting"))
        let json = try #require(
            try JSONSerialization.jsonObject(with: Data(raw.utf8)) as? [String: Any])
        #expect(json["expiresAt"] is NSNull)
        #expect(json["staleAt"] is NSNull)
    }

    @Test("a stored zero deadline is not read as instantly expired")
    func storedZeroDeadlineIsNeverElapsed() async throws {
        let adapter = InMemoryCacheAdapter()
        await adapter.set(
            "greeting",
            value: #"{"value":"hello","createdAt":0,"expiresAt":0,"staleAt":0}"#
        )
        let cache = CacheManager(adapter: adapter, now: { 1000 })

        let hit = try #require(await cache.get("greeting", as: String.self))

        #expect(hit.value == "hello")
        #expect(hit.isExpired == false)
        #expect(hit.isStale == false)
    }

    @Test("the persisted envelope keeps the cross-platform shape")
    func envelopeShape() async throws {
        let adapter = InMemoryCacheAdapter()
        let cache = CacheManager(adapter: adapter, now: { 1000 })

        await cache.set("greeting", value: "hello")
        let raw = try #require(await adapter.get("greeting"))
        let json = try #require(
            try JSONSerialization.jsonObject(with: Data(raw.utf8)) as? [String: Any])

        #expect(json["value"] as? String == "hello")
        #expect(json["createdAt"] as? Double == 1000)
        #expect(json["expiresAt"] is NSNull)
        #expect(json["staleAt"] is NSNull)
    }

    @Test("writes register the key in the cache-keys index")
    func cacheKeysIndex() async {
        let cache = CacheManager(adapter: InMemoryCacheAdapter(), now: { 1000 })

        await cache.set("a", value: "1")
        await cache.set("b", value: "2")

        #expect(await cache.getCacheKeys() == ["a", "b"])
    }

    @Test("clear removes every indexed key and the index itself")
    func clearViaIndex() async {
        let adapter = InMemoryCacheAdapter()
        let cache = CacheManager(adapter: adapter, now: { 1000 })

        await cache.set("a", value: "1")
        await cache.set("b", value: "2")
        await cache.clear()

        #expect(await adapter.get("a") == nil)
        #expect(await adapter.get("b") == nil)
        #expect(await adapter.get(CacheManager.cacheKeysKey) == nil)
        #expect(await cache.getCacheKeys().isEmpty)
    }

    @Test("a corrupt envelope reads as a miss")
    func corruptEnvelope() async {
        let adapter = InMemoryCacheAdapter()
        await adapter.set("greeting", value: "not json")
        let cache = CacheManager(adapter: adapter, now: { 1000 })

        #expect(await cache.get("greeting", as: String.self) == nil)
    }

    @Test("the UserDefaults adapter namespaces its keys")
    func userDefaultsAdapter() async throws {
        let suiteName = "voidhash.tests.\(UUID().uuidString)"
        let defaults = try #require(UserDefaults(suiteName: suiteName))
        defer { defaults.removePersistentDomain(forName: suiteName) }

        let adapter = UserDefaultsCacheAdapter(defaults: defaults, keyPrefix: "voidhash:")
        await adapter.set("greeting", value: "hello")

        #expect(await adapter.get("greeting") == "hello")
        #expect(defaults.string(forKey: "voidhash:greeting") == "hello")

        await adapter.delete("greeting")
        #expect(await adapter.get("greeting") == nil)
    }
}
