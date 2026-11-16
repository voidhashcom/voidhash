import Foundation

/// One-time move of the persisted state out of the pre-namespace layout.
///
/// Earlier releases wrote every key under a bare `voidhash:` prefix shared with the host app.
/// Simply switching to the ``CacheNamespace`` prefix would orphan the whole install: the device
/// would get a new anonymous distinct id, re-report `$app_installed`, forget which store
/// transactions it had already processed and re-fetch a schema it already had. The migration
/// copies the old entries across once, deletes them and writes a marker so it never runs again.
public enum CacheMigration {
    /// Prefix every pre-namespace release wrote under.
    public static let legacyKeyPrefix = "voidhash:"
    /// Marker written into the new namespace once the migration has run.
    public static let markerKey = "migrated-from:voidhash"

    /// Entries whose keys are known ahead of time, used when the adapter cannot be enumerated.
    ///
    /// Anything else the SDK wrote is discovered through the legacy `cache-keys` index.
    static let wellKnownKeys = [
        "distinctId",
        "voidhash:analytics:session",
        "voidhash:analytics:last-seen-app-release",
        CacheManager.cacheKeysKey,
    ]

    /// Runs the migration if it has not run yet.
    ///
    /// - Parameters:
    ///   - target: The namespaced adapter the SDK now writes through.
    ///   - legacy: An adapter over the old bare-prefix namespace.
    ///   - appVersion: Host app version, used to find the app-version-scoped schema entry.
    ///   - diagnostics: Receives a summary when entries were moved.
    /// - Returns: The keys that were copied across.
    @discardableResult
    public static func run(
        target: any CacheAdapter,
        legacy: any CacheAdapter,
        appVersion: String?,
        diagnostics: DiagnosticEmitter = DiagnosticEmitter(nil)
    ) async -> [String] {
        guard await target.get(markerKey) == nil else {
            return []
        }

        var migrated: [String] = []
        for key in await candidateKeys(legacy: legacy, appVersion: appVersion) {
            guard let value = await legacy.get(key) else {
                continue
            }
            // A value already written under the new namespace wins: the SDK has run since.
            if await target.get(key) == nil {
                await target.set(key, value: value)
                migrated.append(key)
            }
            await legacy.delete(key)
        }

        await target.set(markerKey, value: "1")
        if !migrated.isEmpty {
            diagnostics.emit(
                .cache, code: "CACHE_NAMESPACE_MIGRATED", operation: "cache.migrate",
                message: "Moved \(migrated.count) cached entries into the namespaced layout")
        }
        return migrated
    }

    private static func candidateKeys(legacy: any CacheAdapter, appVersion: String?) async
        -> [String]
    {
        var keys: [String] = []
        if let enumerable = legacy as? any EnumerableCacheAdapter {
            keys = await enumerable.keys()
        } else {
            keys = wellKnownKeys
            // The index is how a non-enumerable adapter finds `person:*` and
            // `processed-transaction:*`, whose keys are not known ahead of time.
            if let raw = await legacy.get(CacheManager.cacheKeysKey),
                let data = raw.data(using: .utf8),
                let indexed = try? JSONDecoder().decode([String].self, from: data)
            {
                keys.append(contentsOf: indexed)
            }
            if let appVersion {
                keys.append(SchemaManager.legacyCacheKey(appVersion: appVersion))
            }
        }

        var seen: Set<String> = []
        return keys.filter { $0 != markerKey && seen.insert($0).inserted }
    }
}
