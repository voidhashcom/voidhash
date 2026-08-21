import Foundation
import Testing

@testable import VoidhashCore

@Suite("Identity store")
struct IdentityStoreTests {
    private func makeStore(adapter: InMemoryCacheAdapter, anonymousId: String = "vh:anon:generated")
        -> IdentityStore
    {
        return IdentityStore(
            cacheManager: CacheManager(adapter: adapter, now: { 1000 }),
            generateAnonymousId: { anonymousId }
        )
    }

    @Test("allocates and persists an anonymous distinct id on first read")
    func generatesAnonymousId() async {
        let adapter = InMemoryCacheAdapter()
        let store = makeStore(adapter: adapter)

        let distinctId = await store.getDistinctId()

        #expect(distinctId == "vh:anon:generated")
        #expect(await store.getDistinctIdFromCache() == "vh:anon:generated")
        #expect(await store.getDistinctId() == distinctId)
    }

    @Test("the default anonymous id is a prefixed lowercase uuid")
    func defaultAnonymousIdShape() async {
        let store = IdentityStore(cacheManager: CacheManager(adapter: InMemoryCacheAdapter()))

        let distinctId = await store.getDistinctId()
        let suffix = String(distinctId.dropFirst(IdentityStore.anonymousDistinctIdPrefix.count))

        #expect(distinctId.hasPrefix("vh:anon:"))
        #expect(UUID(uuidString: suffix) != nil)
        #expect(suffix == suffix.lowercased())
        #expect(IdentityStore.isAnonymous(distinctId))
    }

    @Test("identify replaces the persisted distinct id")
    func identifySwitchesIdentity() async {
        let store = makeStore(adapter: InMemoryCacheAdapter())

        _ = await store.getDistinctId()
        await store.identify(distinctId: "user-123")

        #expect(await store.getDistinctId() == "user-123")
        #expect(IdentityStore.isAnonymous("user-123") == false)
    }

    @Test("reset clears the cache and the next read is anonymous again")
    func resetClearsCache() async {
        let adapter = InMemoryCacheAdapter()
        let cache = CacheManager(adapter: adapter, now: { 1000 })
        let store = IdentityStore(
            cacheManager: cache, generateAnonymousId: { "vh:anon:generated" })

        await store.identify(distinctId: "user-123")
        await cache.set("schema:1.0.0", value: "cached")
        await store.reset()

        #expect(await adapter.get("schema:1.0.0") == nil)
        #expect(await store.getDistinctIdFromCache() == nil)
        #expect(await store.getDistinctId() == "vh:anon:generated")
    }
}
