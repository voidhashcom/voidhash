import Foundation
import Testing

@testable import VoidhashCore

/// Scripted ``SchemaFetching`` recording calls and replaying queued outcomes.
private actor StubSchemaFetcher: SchemaFetching {
    private var outcomes: [Result<RuntimeSchema, any Error>]
    private(set) var calls: [[String: String]] = []

    init(_ outcomes: [Result<RuntimeSchema, any Error>]) {
        self.outcomes = outcomes
    }

    var callCount: Int { calls.count }

    func fetchSchema(headers: [String: String]) async throws -> RuntimeSchema {
        calls.append(headers)
        guard !outcomes.isEmpty else {
            throw VoidhashApiError.network("no outcome queued")
        }
        return try outcomes.removeFirst().get()
    }
}

private func makeSchema(version: String) -> RuntimeSchema {
    return RuntimeSchema(
        version: version,
        products: [
            "pro-monthly": RuntimeProductDefinition(
                slug: "pro-monthly",
                type: "subscription",
                properties: RuntimeProductProperties(name: "Pro Monthly"),
                configuration: RuntimeProductConfiguration(
                    providers: RuntimeProductProviders(
                        appleAppStore: RuntimeAppleAppStoreProductConfiguration(
                            productId: "com.voidhash.pro.monthly")))
            )
        ],
        locations: [
            "onboarding": RuntimePaywallLocationDefinition(slug: "onboarding", name: "Onboarding")
        ]
    )
}

/// Collects every schema published by the manager.
private final class SchemaRecorder: @unchecked Sendable {
    private let lock = NSLock()
    private var versions: [String] = []

    var published: [String] {
        lock.lock()
        defer { lock.unlock() }
        return versions
    }

    func record(_ schema: RuntimeSchema) {
        lock.lock()
        versions.append(schema.version)
        lock.unlock()
    }
}

@Suite("Schema manager")
struct SchemaManagerTests {
    static let headers = ["x-publishable-key": "pk_test", "x-distinct-id": "user-123"]

    @Test("a cold cache fetches synchronously and caches with the 30 day ttl")
    func coldCacheFetches() async throws {
        let adapter = InMemoryCacheAdapter()
        let cache = CacheManager(adapter: adapter, now: { 1000 })
        let recorder = SchemaRecorder()
        let fetcher = StubSchemaFetcher([.success(makeSchema(version: "v1"))])
        let manager = SchemaManager(
            apiClient: fetcher, cacheManager: cache, appVersion: "1.0.0",
            onSchemaUpdated: { recorder.record($0) })

        let schema = try await manager.resolveSchema(headers: SchemaManagerTests.headers)
        let cached = try #require(await cache.get("schema:1.0.0", as: RuntimeSchema.self))

        #expect(schema.version == "v1")
        #expect(cached.value == schema)
        #expect(cached.expiresAt == 1000 + SchemaManager.cacheTtlMilliseconds)
        #expect(recorder.published == ["v1"])
        #expect(await fetcher.calls.first?["x-distinct-id"] == "user-123")
    }

    @Test("a cold cache failure is fatal")
    func coldCacheFailureIsFatal() async {
        let manager = SchemaManager(
            apiClient: StubSchemaFetcher([.failure(VoidhashApiError.network("offline"))]),
            cacheManager: CacheManager(adapter: InMemoryCacheAdapter()),
            appVersion: "1.0.0")

        await #expect(throws: FailedToFetchSchemaError.self) {
            _ = try await manager.resolveSchema(headers: SchemaManagerTests.headers)
        }
    }

    @Test("the fatal schema error keeps the CODE: message shape")
    func schemaErrorDescription() {
        let error = FailedToFetchSchemaError(underlying: VoidhashApiError.network("offline"))

        #expect(error.description == "FAILED_TO_FETCH_SCHEMA: Failed to fetch schema at init")
    }

    @Test("a warm cache is served immediately and refreshed in the background")
    func warmCacheServesAndRefreshes() async throws {
        let clock = 1000.0
        let cache = CacheManager(adapter: InMemoryCacheAdapter(), now: { clock })
        await cache.set(
            "schema:1.0.0", value: makeSchema(version: "cached"),
            ttl: SchemaManager.cacheTtlMilliseconds)

        let recorder = SchemaRecorder()
        let fetcher = StubSchemaFetcher([.success(makeSchema(version: "refreshed"))])
        let manager = SchemaManager(
            apiClient: fetcher, cacheManager: cache, appVersion: "1.0.0",
            onSchemaUpdated: { recorder.record($0) })

        let schema = try await manager.resolveSchema(headers: SchemaManagerTests.headers)
        #expect(schema.version == "cached")

        await manager.backgroundRefreshTask?.value

        #expect(await fetcher.callCount == 1)
        #expect(recorder.published == ["cached", "refreshed"])
        #expect(await cache.get("schema:1.0.0", as: RuntimeSchema.self)?.value.version == "refreshed")
    }

    @Test("a failing background refresh leaves the cached schema in place")
    func backgroundRefreshFailureIsSwallowed() async throws {
        let cache = CacheManager(adapter: InMemoryCacheAdapter(), now: { 1000 })
        await cache.set(
            "schema:1.0.0", value: makeSchema(version: "cached"),
            ttl: SchemaManager.cacheTtlMilliseconds)

        let manager = SchemaManager(
            apiClient: StubSchemaFetcher([.failure(VoidhashApiError.network("offline"))]),
            cacheManager: cache, appVersion: "1.0.0")

        let schema = try await manager.resolveSchema(headers: SchemaManagerTests.headers)
        await manager.backgroundRefreshTask?.value

        #expect(schema.version == "cached")
        #expect(await cache.get("schema:1.0.0", as: RuntimeSchema.self)?.value.version == "cached")
    }

    @Test("an expired cache entry falls back to a synchronous fetch")
    func expiredCacheRefetches() async throws {
        let adapter = InMemoryCacheAdapter()
        let writeCache = CacheManager(adapter: adapter, now: { 1000 })
        await writeCache.set("schema:1.0.0", value: makeSchema(version: "cached"), ttl: 5000)

        let readCache = CacheManager(adapter: adapter, now: { 100_000 })
        let fetcher = StubSchemaFetcher([.success(makeSchema(version: "fresh"))])
        let manager = SchemaManager(
            apiClient: fetcher, cacheManager: readCache, appVersion: "1.0.0")

        let schema = try await manager.resolveSchema(headers: SchemaManagerTests.headers)

        #expect(schema.version == "fresh")
        #expect(await manager.backgroundRefreshTask == nil)
    }

    @Test("a different app version does not read another version's cache")
    func cacheIsKeyedByAppVersion() async throws {
        let adapter = InMemoryCacheAdapter()
        let cache = CacheManager(adapter: adapter, now: { 1000 })
        await cache.set(
            "schema:1.0.0", value: makeSchema(version: "old"),
            ttl: SchemaManager.cacheTtlMilliseconds)

        let manager = SchemaManager(
            apiClient: StubSchemaFetcher([.success(makeSchema(version: "new"))]),
            cacheManager: cache, appVersion: "2.0.0")

        #expect(
            try await manager.resolveSchema(headers: SchemaManagerTests.headers).version == "new")
        #expect(await cache.get("schema:2.0.0", as: RuntimeSchema.self)?.value.version == "new")
        #expect(await cache.get("schema:1.0.0", as: RuntimeSchema.self)?.value.version == "old")
    }

    @Test("no app version skips the cache entirely")
    func noAppVersionSkipsCache() async throws {
        let adapter = InMemoryCacheAdapter()
        let cache = CacheManager(adapter: adapter, now: { 1000 })
        let fetcher = StubSchemaFetcher([
            .success(makeSchema(version: "v1")), .success(makeSchema(version: "v2")),
        ])
        let manager = SchemaManager(apiClient: fetcher, cacheManager: cache, appVersion: nil)

        #expect(
            try await manager.resolveSchema(headers: SchemaManagerTests.headers).version == "v1")
        #expect(
            try await manager.resolveSchema(headers: SchemaManagerTests.headers).version == "v2")
        #expect(await fetcher.callCount == 2)
        #expect(await cache.getCacheKeys().isEmpty)
        #expect(await manager.backgroundRefreshTask == nil)
    }

    @Test("no app version makes a fetch failure fatal")
    func noAppVersionFailureIsFatal() async {
        let manager = SchemaManager(
            apiClient: StubSchemaFetcher([.failure(VoidhashApiError.network("offline"))]),
            cacheManager: CacheManager(adapter: InMemoryCacheAdapter()),
            appVersion: nil)

        await #expect(throws: FailedToFetchSchemaError.self) {
            _ = try await manager.resolveSchema(headers: SchemaManagerTests.headers)
        }
    }
}
