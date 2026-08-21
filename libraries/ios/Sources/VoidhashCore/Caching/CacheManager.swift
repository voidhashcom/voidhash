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

/// A non-expired cache entry plus its freshness flags.
public struct CacheHit<Value: Sendable>: Sendable {
    /// The decoded cached value.
    public let value: Value
    /// Millisecond epoch timestamp of when the entry was written.
    public let createdAt: Double
    /// Millisecond epoch timestamp after which the entry is considered stale, if any.
    public let staleAt: Double?
    /// Millisecond epoch timestamp after which the entry is dropped, if any.
    public let expiresAt: Double?
    /// Whether `staleAt` has elapsed.
    public let isStale: Bool
    /// Always `false` — expired entries are deleted and reported as a miss.
    public let isExpired: Bool
}

/// Envelope-based cache with a `cache-keys` index enabling ``clear()``.
///
/// Mirrors `src/core/caching/cache-manager.ts`: reads delete expired entries and return `nil`,
/// writes register the key in the index, and `clear()` deletes every indexed key.
public actor CacheManager {
    /// Index key holding the JSON array of every key written through this manager.
    public static let cacheKeysKey = "cache-keys"

    private let adapter: CacheAdapter
    private let now: @Sendable () -> Double

    /// - Parameters:
    ///   - adapter: Backing string storage.
    ///   - now: Millisecond epoch clock, injectable for tests.
    public init(
        adapter: CacheAdapter,
        now: @escaping @Sendable () -> Double = { Date().timeIntervalSince1970 * 1000 }
    ) {
        self.adapter = adapter
        self.now = now
    }

    /// Reads and decodes a cached value, deleting and reporting a miss when it has expired.
    public func get<Value: Codable & Sendable>(_ key: String, as type: Value.Type = Value.self)
        async -> CacheHit<Value>?
    {
        guard let raw = await adapter.get(key), let data = raw.data(using: .utf8) else {
            return nil
        }
        guard let envelope = try? JSONDecoder().decode(CacheEnvelope<Value>.self, from: data) else {
            return nil
        }

        // A `0` timestamp is falsy in the TypeScript implementation, so it reads as "never" here
        // too rather than as "expired at the epoch".
        let timestamp = now()
        let isExpired = CacheManager.hasElapsed(envelope.expiresAt, at: timestamp)
        let isStale = CacheManager.hasElapsed(envelope.staleAt, at: timestamp)

        if isExpired {
            await adapter.delete(key)
            return nil
        }

        return CacheHit(
            value: envelope.value,
            createdAt: envelope.createdAt,
            staleAt: envelope.staleAt,
            expiresAt: envelope.expiresAt,
            isStale: isStale,
            isExpired: false
        )
    }

    /// Writes a value and registers its key in the `cache-keys` index.
    ///
    /// - Parameters:
    ///   - ttl: Lifetime in milliseconds after which the entry is dropped on read. `nil` or `0`
    ///     writes a `null` deadline: the entry never expires.
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

    /// Removes a single entry. The key stays in the index, as it does in the TypeScript SDK.
    public func delete(_ key: String) async {
        await adapter.delete(key)
    }

    /// Deletes every indexed key and the index itself.
    public func clear() async {
        for key in await getCacheKeys() {
            await adapter.delete(key)
        }
        await adapter.delete(CacheManager.cacheKeysKey)
    }

    /// Returns the keys registered in the `cache-keys` index.
    public func getCacheKeys() async -> [String] {
        guard let raw = await adapter.get(CacheManager.cacheKeysKey),
            let data = raw.data(using: .utf8),
            let keys = try? JSONDecoder().decode([String].self, from: data)
        else {
            return []
        }
        return keys
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

    private func storeCacheKey(_ key: String) async {
        var keys = await getCacheKeys()
        keys.append(key)
        guard let data = try? JSONEncoder().encode(keys),
            let json = String(data: data, encoding: .utf8)
        else {
            return
        }
        await adapter.set(CacheManager.cacheKeysKey, value: json)
    }
}
