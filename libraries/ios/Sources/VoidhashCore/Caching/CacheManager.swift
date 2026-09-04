import Foundation

/// JSON envelope persisted for every cached value.
///
/// The shape is a cross-platform contract: `{value, createdAt, staleAt, expiresAt}` with
/// millisecond epoch timestamps, matching `src/core/caching/cache-manager.ts`.
struct CacheEnvelope<Value: Codable & Sendable>: Codable, Sendable {
    let value: Value
    let expiresAt: Double?
    let createdAt: Double
    let staleAt: Double?

    private enum CodingKeys: String, CodingKey {
        case createdAt
        case expiresAt
        case staleAt
        case value
    }

    init(value: Value, createdAt: Double, expiresAt: Double?, staleAt: Double?) {
        self.value = value
        self.createdAt = createdAt
        self.expiresAt = expiresAt
        self.staleAt = staleAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        value = try container.decode(Value.self, forKey: .value)
        createdAt = try container.decode(Double.self, forKey: .createdAt)
        expiresAt = try container.decodeIfPresent(Double.self, forKey: .expiresAt)
        staleAt = try container.decodeIfPresent(Double.self, forKey: .staleAt)
    }

    // The TypeScript implementation writes explicit `null`s rather than omitting the keys;
    // encodeIfPresent would drop them and break byte-level parity of the persisted envelope.
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(createdAt, forKey: .createdAt)
        if let expiresAt {
            try container.encode(expiresAt, forKey: .expiresAt)
        } else {
            try container.encodeNil(forKey: .expiresAt)
        }
        if let staleAt {
            try container.encode(staleAt, forKey: .staleAt)
        } else {
            try container.encodeNil(forKey: .staleAt)
        }
        try container.encode(value, forKey: .value)
    }
}

/// A cache entry plus its freshness flags.
public struct CacheHit<Value: Sendable>: Sendable {
    /// The decoded cached value.
    public let value: Value
    /// Millisecond epoch timestamp of when the entry was written.
    public let createdAt: Double
    /// Millisecond epoch timestamp after which the entry is considered stale, if any.
    public let staleAt: Double?
    /// Millisecond epoch timestamp after which the entry is considered expired, if any.
    public let expiresAt: Double?
    /// Whether `staleAt` or `expiresAt` has elapsed.
    public let isStale: Bool
    /// Whether `expiresAt` has elapsed. Expired entries are still returned: TTL drives how
    /// urgently the SDK refreshes, never whether a value is available offline.
    public let isExpired: Bool
}

/// A value paired with the freshness of the cache entry it came from.
///
/// Returned by the `…State` read accessors so callers can decide how much to trust a value that
/// was served offline, without changing the signature of the plain accessors.
public struct Stale<Value: Sendable>: Sendable {
    /// The value, cached or freshly fetched.
    public let value: Value
    /// Whether the cached entry had passed its stale deadline.
    public let isStale: Bool
    /// Whether the cached entry had passed its expiry deadline.
    public let isExpired: Bool

    public init(value: Value, isStale: Bool = false, isExpired: Bool = false) {
        self.value = value
        self.isStale = isStale
        self.isExpired = isExpired
    }

    /// Maps the wrapped value, keeping the freshness flags.
    public func map<Mapped: Sendable>(_ transform: (Value) -> Mapped) -> Stale<Mapped> {
        return Stale<Mapped>(
            value: transform(value), isStale: isStale, isExpired: isExpired)
    }
}

/// Envelope-based cache with a `cache-keys` index enabling ``clear()``.
///
/// Expired reads do not delete: an expired entry comes back with `isExpired == true` so an offline
/// device keeps serving the last known state. Entries are removed by an overwrite, an explicit
/// delete/clear, or when a corrupt envelope is discarded. Writes register the key in a
/// deduplicated index.
public actor CacheManager {
    /// Index key holding the JSON array of every key written through this manager.
    public static let cacheKeysKey = "cache-keys"

    private let adapter: CacheAdapter
    private let now: @Sendable () -> Double
    private let diagnostics: DiagnosticEmitter
    /// The `cache-keys` index, read from the adapter once and mutated in memory from then on.
    ///
    /// Every adapter call suspends the actor, so two writers reading the index back on each
    /// write could interleave: both would read the same list, and the second write would drop
    /// the first's key. An entry missing from the index is invisible to `clear` and
    /// `deleteByPrefix`, so it would outlive the identity it belongs to.
    private var indexedKeys: [String]?

    /// - Parameters:
    ///   - adapter: Backing string storage.
    ///   - now: Millisecond epoch clock, injectable for tests.
    ///   - diagnostics: Receives `CACHE_READ_FAILED` for corrupt entries.
    public init(
        adapter: CacheAdapter,
        now: @escaping @Sendable () -> Double = { Date().timeIntervalSince1970 * 1000 },
        diagnostics: DiagnosticEmitter = DiagnosticEmitter(nil)
    ) {
        self.adapter = adapter
        self.now = now
        self.diagnostics = diagnostics
    }

    /// Reads and decodes a cached value.
    ///
    /// An expired entry is returned with `isExpired == true` rather than deleted; a corrupt one
    /// is deleted and reported as a miss with a `CACHE_READ_FAILED` diagnostic.
    public func get<Value: Codable & Sendable>(_ key: String, as type: Value.Type = Value.self)
        async -> CacheHit<Value>?
    {
        guard let raw = await adapter.get(key), let data = raw.data(using: .utf8) else {
            return nil
        }
        guard let envelope = try? JSONDecoder().decode(CacheEnvelope<Value>.self, from: data) else {
            diagnostics.emit(
                .cache, code: "CACHE_READ_FAILED", operation: "cache.get",
                message: "Discarding the undecodable cache entry \"\(key)\"")
            await delete(key)
            return nil
        }

        // A `0` timestamp is falsy in the TypeScript implementation, so it reads as "never" here
        // too rather than as "expired at the epoch".
        let timestamp = now()
        let isExpired = CacheManager.hasElapsed(envelope.expiresAt, at: timestamp)
        let isStale = isExpired || CacheManager.hasElapsed(envelope.staleAt, at: timestamp)

        return CacheHit(
            value: envelope.value,
            createdAt: envelope.createdAt,
            staleAt: envelope.staleAt,
            expiresAt: envelope.expiresAt,
            isStale: isStale,
            isExpired: isExpired
        )
    }

    /// Writes a value and registers its key in the `cache-keys` index.
    ///
    /// - Parameters:
    ///   - ttl: Lifetime in milliseconds after which the entry is flagged expired and should be
    ///     refreshed. The value remains available offline. `nil` or `0` writes a `null` deadline:
    ///     the entry never expires.
    ///   - staleTime: Milliseconds after which the entry is still served but flagged stale. `nil`
    ///     or `0` writes a `null` deadline: the entry is never stale.
    public func set<Value: Codable & Sendable>(
        _ key: String,
        value: Value,
        ttl: Double? = nil,
        staleTime: Double? = nil
    ) async {
        let timestamp = now()
        let envelope = CacheEnvelope(
            value: value,
            createdAt: timestamp,
            expiresAt: CacheManager.deadline(after: ttl, at: timestamp),
            staleAt: CacheManager.deadline(after: staleTime, at: timestamp)
        )

        guard let data = try? JSONEncoder().encode(envelope),
            let json = String(data: data, encoding: .utf8)
        else {
            return
        }

        await adapter.set(key, value: json)
        await storeCacheKey(key)
    }

    /// Removes a single entry and drops it from the key index.
    public func delete(_ key: String) async {
        await adapter.delete(key)
        guard key != CacheManager.cacheKeysKey else {
            return
        }
        let keys = await getCacheKeys()
        if keys.contains(key) {
            await writeCacheKeys(keys.filter { $0 != key })
        }
    }

    /// Deletes every indexed key and the index itself.
    public func clear() async {
        let keys = await getCacheKeys()
        indexedKeys = []
        for key in keys {
            await adapter.delete(key)
        }
        await adapter.delete(CacheManager.cacheKeysKey)
    }

    /// Returns the keys registered in the `cache-keys` index, deduplicated in write order.
    public func getCacheKeys() async -> [String] {
        if let indexedKeys {
            return indexedKeys
        }
        let loaded = await loadCacheKeys()
        // A write that landed while the read was suspended already owns the index.
        if let indexedKeys {
            return indexedKeys
        }
        indexedKeys = loaded
        return loaded
    }

    /// Deletes every key whose name starts with `prefix` and drops them from the index.
    ///
    /// Used by `identify` and `reset` to invalidate the per-person entries of the identity being
    /// left behind.
    public func deleteByPrefix(_ prefix: String) async {
        let keys = await getCacheKeys()
        let matched = keys.filter { $0.hasPrefix(prefix) }
        guard !matched.isEmpty else {
            return
        }
        await writeCacheKeys(keys.filter { !$0.hasPrefix(prefix) })
        for key in matched {
            await adapter.delete(key)
        }
    }

    private func loadCacheKeys() async -> [String] {
        guard let raw = await adapter.get(CacheManager.cacheKeysKey),
            let data = raw.data(using: .utf8),
            let keys = try? JSONDecoder().decode([String].self, from: data)
        else {
            return []
        }
        var seen: Set<String> = []
        return keys.filter { seen.insert($0).inserted }
    }

    // `options?.ttl ? Date.now() + options.ttl : null` in the TypeScript SDK: a zero duration is
    // falsy there and means "no deadline", not "already elapsed".
    private static func deadline(after duration: Double?, at timestamp: Double) -> Double? {
        guard let duration, duration != 0 else {
            return nil
        }
        return timestamp + duration
    }

    private static func hasElapsed(_ deadline: Double?, at timestamp: Double) -> Bool {
        guard let deadline, deadline != 0 else {
            return false
        }
        return deadline < timestamp
    }

    // The index is a set: keys rewritten on every capture (the analytics session) must not grow
    // it with each write. Reads compact any duplicates a previous SDK version left behind.
    private func storeCacheKey(_ key: String) async {
        var keys = await getCacheKeys()
        guard !keys.contains(key) else {
            return
        }
        keys.append(key)
        await writeCacheKeys(keys)
    }

    // The in-memory index is updated before the write suspends, so a concurrent writer that
    // reads it next already sees this change and its own write carries both.
    private func writeCacheKeys(_ keys: [String]) async {
        indexedKeys = keys
        guard let data = try? JSONEncoder().encode(keys),
            let json = String(data: data, encoding: .utf8)
        else {
            return
        }
        await adapter.set(CacheManager.cacheKeysKey, value: json)
    }
}
