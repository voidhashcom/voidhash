import Foundation

/// Source of runtime schemas, implemented by ``VoidhashApiClient`` and by test doubles.
public protocol SchemaFetching: Sendable {
    /// Fetches the current runtime schema.
    func fetchSchema(headers: [String: String]) async throws -> RuntimeSchema
}

/// Raised when the schema cannot be fetched and no usable cache entry exists.
///
/// No longer thrown out of ``SchemaManager/resolveSchemaTolerant(headers:)`` or out of client
/// initialization; it survives for the embedded data-plane surface, whose host does want to see
/// a failed fetch.
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

/// Resolves the runtime schema from a single version-independent cache entry.
///
/// The entry is served whatever its age — a launch with no connectivity runs on the last schema
/// the device saw — and every hit schedules a background refresh. The app version lives inside
/// the envelope instead of in the key, so an app update reuses the previous schema until the
/// refresh lands rather than blocking on the network.
public actor SchemaManager {
    /// 30 days. Bounds how stale a schema can get before the refresh is treated as urgent; the
    /// entry itself stays readable past it.
    public static let cacheTtlMilliseconds: Double = 1000 * 60 * 60 * 24 * 30
    /// 24 hours. Past this the cached schema is served but flagged for refresh.
    public static let cacheStaleTimeMilliseconds: Double = 1000 * 60 * 60 * 24
    /// Version-independent cache key.
    public static let cacheKey = "schema:current"

    /// Persisted envelope value: the schema plus the app version it was fetched for.
    public struct StoredSchema: Codable, Sendable {
        /// App version the schema was last fetched for; `nil` when the host reports none.
        public let appVersion: String?
        /// The schema itself.
        public let schema: RuntimeSchema

        public init(appVersion: String?, schema: RuntimeSchema) {
            self.appVersion = appVersion
            self.schema = schema
        }
    }

    private let apiClient: any SchemaFetching
    private let cacheManager: CacheManager
    private let appVersion: String?
    private let diagnostics: DiagnosticEmitter
    private let onSchemaUpdated: (@Sendable (RuntimeSchema) -> Void)?

    /// The in-flight background refresh, exposed so callers (and tests) can await it.
    public private(set) var backgroundRefreshTask: Task<Void, Never>?
    private var inFlightRefresh: Task<RuntimeSchema?, Never>?

    /// - Parameters:
    ///   - apiClient: Schema source.
    ///   - cacheManager: Cache the schema is persisted in.
    ///   - appVersion: Host app version, recorded inside the envelope.
    ///   - diagnostics: Receives a diagnostic for every refresh failure the caller never sees.
    ///   - onSchemaUpdated: Called whenever a schema is resolved or refreshed.
    public init(
        apiClient: any SchemaFetching,
        cacheManager: CacheManager,
        appVersion: String?,
        diagnostics: DiagnosticEmitter = DiagnosticEmitter(nil),
        onSchemaUpdated: (@Sendable (RuntimeSchema) -> Void)? = nil
    ) {
        self.apiClient = apiClient
        self.cacheManager = cacheManager
        self.appVersion = appVersion
        self.diagnostics = diagnostics
        self.onSchemaUpdated = onSchemaUpdated
    }

    /// Cache key written by SDK versions that scoped the schema by app version.
    ///
    /// Read once as a migration source; never written to again.
    public static func legacyCacheKey(appVersion: String) -> String {
        return "schema:\(appVersion)"
    }

    /// Resolves the schema, serving from cache when possible.
    ///
    /// - Throws: ``FailedToFetchSchemaError`` when there is no cached schema and the fetch fails.
    public func resolveSchema(headers: [String: String]) async throws -> RuntimeSchema {
        if let cached = await readCachedSchema() {
            onSchemaUpdated?(cached.schema)
            scheduleBackgroundRefresh(headers: headers, isStale: cached.isStale)
            return cached.schema
        }

        let schema = try await fetchFromServer(headers: headers)
        await cacheAndPublish(schema)
        return schema
    }

    /// Resolves the schema without ever failing on transport.
    ///
    /// Returns the cached schema when one exists, otherwise the freshly fetched one, otherwise
    /// ``RuntimeSchema/empty`` with a background refresh scheduled. This is what client
    /// initialization uses, so a cold-cache offline launch still brings up analytics, identity
    /// and flags.
    public func resolveSchemaTolerant(headers: [String: String]) async -> RuntimeSchema {
        if let cached = await readCachedSchema() {
            onSchemaUpdated?(cached.schema)
            scheduleBackgroundRefresh(headers: headers, isStale: cached.isStale)
            return cached.schema
        }

        if let schema = await refresh(headers: headers) {
            return schema
        }

        scheduleBackgroundRefresh(headers: headers, isStale: true)
        return RuntimeSchema.empty
    }

    /// Fetches and caches the schema, returning `nil` on any failure. Used by refresh triggers.
    ///
    /// Single-flighted: a boot resolve, a foreground trigger and a connectivity trigger arriving
    /// together issue one request between them.
    @discardableResult
    public func refresh(headers: [String: String]) async -> RuntimeSchema? {
        if let inFlightRefresh {
            return await inFlightRefresh.value
        }
        let task = Task { await self.performRefresh(headers: headers) }
        inFlightRefresh = task
        defer { inFlightRefresh = nil }
        return await task.value
    }

    private func performRefresh(headers: [String: String]) async -> RuntimeSchema? {
        do {
            let schema = try await apiClient.fetchSchema(headers: headers)
            await cacheAndPublish(schema)
            return schema
        } catch {
            let apiError = error as? VoidhashApiError
            diagnostics.emit(
                .transport, code: apiError?.code ?? "SCHEMA_REFRESH_FAILED",
                operation: "schema.refresh", retryable: apiError?.isRetryable ?? true,
                httpStatus: apiError?.statusCode, message: String(describing: error))
            return nil
        }
    }

    /// Awaits the running background refresh, if any.
    public func awaitBackgroundRefresh() async {
        await backgroundRefreshTask?.value
    }

    // Reads `schema:current`, falling back once to the app-version-scoped key written by earlier
    // SDK versions and promoting it so the legacy key is never consulted again.
    private func readCachedSchema() async -> (schema: RuntimeSchema, isStale: Bool)? {
        if let hit = await cacheManager.get(SchemaManager.cacheKey, as: StoredSchema.self) {
            // An app update is a reason to refresh promptly, even inside the stale window: the
            // new build may reference products the cached schema has never heard of.
            let isStale = hit.isStale || hit.value.appVersion != appVersion
            return (hit.value.schema, isStale)
        }
        guard let appVersion,
            let legacy = await cacheManager.get(
                SchemaManager.legacyCacheKey(appVersion: appVersion), as: RuntimeSchema.self)
        else {
            return nil
        }
        await writeCache(legacy.value)
        await cacheManager.delete(SchemaManager.legacyCacheKey(appVersion: appVersion))
        return (legacy.value, true)
    }

    private func fetchFromServer(headers: [String: String]) async throws -> RuntimeSchema {
        do {
            return try await apiClient.fetchSchema(headers: headers)
        } catch {
            throw FailedToFetchSchemaError(underlying: error)
        }
    }

    private func writeCache(_ schema: RuntimeSchema) async {
        await cacheManager.set(
            SchemaManager.cacheKey,
            value: StoredSchema(appVersion: appVersion, schema: schema),
            ttl: SchemaManager.cacheTtlMilliseconds,
            staleTime: SchemaManager.cacheStaleTimeMilliseconds
        )
    }

    private func cacheAndPublish(_ schema: RuntimeSchema) async {
        await writeCache(schema)
        onSchemaUpdated?(schema)
    }

    // A fresh entry is left alone: re-fetching an unchanged schema on every launch is a request
    // per cold start for nothing.
    private func scheduleBackgroundRefresh(headers: [String: String], isStale: Bool) {
        guard isStale else {
            backgroundRefreshTask = nil
            return
        }
        backgroundRefreshTask = Task { [weak self] in
            await self?.refresh(headers: headers)
        }
    }
}
