import Foundation

/// Source of runtime schemas, implemented by ``VoidhashApiClient`` and by test doubles.
public protocol SchemaFetching: Sendable {
    /// Fetches the current runtime schema.
    func fetchSchema(headers: [String: String]) async throws -> RuntimeSchema
}

/// Raised when the schema cannot be fetched and no usable cache entry exists.
public struct FailedToFetchSchemaError: Error, Sendable, CustomStringConvertible, LocalizedError {
    /// Stable error code.
    public let code = "FAILED_TO_FETCH_SCHEMA"
    /// Human readable message.
    public let message: String
    /// The transport or decoding failure that caused this error.
    public let underlying: any Error

    public init(message: String = "Failed to fetch schema at init", underlying: any Error) {
        self.message = message
        self.underlying = underlying
    }

    public var description: String {
        return "\(code): \(message)"
    }

    public var errorDescription: String? {
        return description
    }

    public var localizedDescription: String {
        return description
    }
}

/// Resolves the runtime schema with a stale-while-revalidate cache keyed by the app version.
///
/// Mirrors `src/core/schema/schema-manager.ts`: a cache hit is served immediately and refreshed
/// in the background, a cold cache fetches synchronously and a failure there is fatal, and a
/// missing app version skips the cache entirely because a newer build may reference products the
/// cached schema does not know about.
public actor SchemaManager {
    /// 30 days. Covers long offline gaps while bounding staleness; the unconditional background
    /// refresh on cache hits keeps the next session up to date.
    public static let cacheTtlMilliseconds: Double = 1000 * 60 * 60 * 24 * 30

    private let apiClient: any SchemaFetching
    private let cacheManager: CacheManager
    private let appVersion: String?
    private let onSchemaUpdated: (@Sendable (RuntimeSchema) -> Void)?

    /// The in-flight background refresh, exposed so callers (and tests) can await it.
    public private(set) var backgroundRefreshTask: Task<Void, Never>?

    /// - Parameters:
    ///   - apiClient: Schema source.
    ///   - cacheManager: Cache the schema is persisted in.
    ///   - appVersion: Host app version; `nil` disables caching.
    ///   - onSchemaUpdated: Called whenever a schema is resolved or refreshed.
    public init(
        apiClient: any SchemaFetching,
        cacheManager: CacheManager,
        appVersion: String?,
        onSchemaUpdated: (@Sendable (RuntimeSchema) -> Void)? = nil
    ) {
        self.apiClient = apiClient
        self.cacheManager = cacheManager
        self.appVersion = appVersion
        self.onSchemaUpdated = onSchemaUpdated
    }

    /// Cache key for a given app version.
    public static func cacheKey(appVersion: String) -> String {
        return "schema:\(appVersion)"
    }

    /// Resolves the schema, serving from cache when possible.
    ///
    /// - Throws: ``FailedToFetchSchemaError`` when there is no cached schema and the fetch fails.
    public func resolveSchema(headers: [String: String]) async throws -> RuntimeSchema {
        guard let appVersion else {
            let schema = try await fetchFromServer(headers: headers)
            onSchemaUpdated?(schema)
            return schema
        }

        let key = SchemaManager.cacheKey(appVersion: appVersion)

        // `CacheManager.get` already drops expired entries, so any hit is fresh enough to serve.
        if let cached = await cacheManager.get(key, as: RuntimeSchema.self) {
            onSchemaUpdated?(cached.value)
            scheduleBackgroundRefresh(cacheKey: key, headers: headers)
            return cached.value
        }

        let schema = try await fetchFromServer(headers: headers)
        await cacheAndPublish(cacheKey: key, schema: schema)
        return schema
    }

    private func fetchFromServer(headers: [String: String]) async throws -> RuntimeSchema {
        do {
            return try await apiClient.fetchSchema(headers: headers)
        } catch {
            throw FailedToFetchSchemaError(underlying: error)
        }
    }

    private func cacheAndPublish(cacheKey: String, schema: RuntimeSchema) async {
        await cacheManager.set(cacheKey, value: schema, ttl: SchemaManager.cacheTtlMilliseconds)
        onSchemaUpdated?(schema)
    }

    private func scheduleBackgroundRefresh(cacheKey: String, headers: [String: String]) {
        backgroundRefreshTask = Task { [weak self] in
            guard let self else {
                return
            }
            guard let schema = try? await self.apiClient.fetchSchema(headers: headers) else {
                return
            }
            await self.cacheAndPublish(cacheKey: cacheKey, schema: schema)
        }
    }
}
