import Foundation

/// Persisted distinct id used to scope every SDK request, and the groups the end user belongs to.
///
/// A missing distinct id lazily becomes an anonymous one. Reads use the current in-memory
/// identity while persistence finishes, and writes are serialized so an older write cannot
/// restore an identity that has already been replaced.
///
/// The groups live as long as the identity: stored next to it, and forgotten with it by
/// ``forgetDistinctId()`` and ``reset()``. ``groups`` reads them from any thread, so an event
/// can be stamped with them at the moment it is captured.
///
/// An id the API refuses (see ``invalidDistinctIdReason(_:)``) is never adopted: the backend
/// answers every request scoped to it with a validation error, so such a write keeps the current
/// identity and such a persisted value reads as absent.
public actor IdentityStore {
    /// Prefix marking a generated, not-yet-identified distinct id: `vh_anon_<uuid>`. It holds
    /// only letters, digits, `_` and `-`, so the id fits any payment provider's field.
    public static let anonymousDistinctIdPrefix = "vh_anon_"
    /// Prefix of the anonymous ids earlier SDK builds generated, which a stored id may still carry.
    public static let legacyAnonymousDistinctIdPrefix = "vh:anon:"
    /// Longest distinct id the API accepts, in Unicode code points.
    public static let maxDistinctIdLength = 255
    /// Cache key holding the current distinct id.
    public static let cacheKey = "distinctId"
    /// Cache key holding the groups the end user belongs to, by group type.
    public static let groupsCacheKey = "groups"
    /// Cache key holding, by group type, the digest ``recordGroupDigests(_:)`` recorded for the
    /// group held under ``groupsCacheKey``, and cleared with it.
    public static let groupDigestsCacheKey = "groupDigests"
    /// Longest group key the API keeps, in UTF-16 code units, as the API counts them.
    public static let maxGroupKeyLength = 256

    private var revision = 0
    private var currentDistinctId: String?
    private var pendingWrite: Task<Void, Never>?
    private let cacheManager: CacheManager
    private let generateAnonymousId: @Sendable () -> String
    private let currentGroups = GroupsBox()
    private var groupDigests: [String: String] = [:]

    /// - Parameters:
    ///   - cacheManager: Cache the distinct id is persisted in.
    ///   - generateAnonymousId: Anonymous id factory, injectable for tests.
    public init(
        cacheManager: CacheManager,
        generateAnonymousId: @escaping @Sendable () -> String = {
            IdentityStore.anonymousDistinctIdPrefix + UUID().uuidString.lowercased()
        }
    ) {
        self.cacheManager = cacheManager
        self.generateAnonymousId = generateAnonymousId
    }

    /// Returns the persisted distinct id, allocating and persisting an anonymous one when absent.
    public func getDistinctId() async -> String {
        if let currentDistinctId { return currentDistinctId }
        let expectedRevision = revision
        await pendingWrite?.value
        let cached = await getDistinctIdFromCache()
        if revision != expectedRevision { return await getDistinctId() }
        if let currentDistinctId { return currentDistinctId }
        if let cached {
            currentDistinctId = cached
            return cached
        }

        let anonymousDistinctId = generateAnonymousId()
        await setDistinctId(anonymousDistinctId)
        return anonymousDistinctId
    }

    /// Returns the persisted distinct id without allocating an anonymous one; `nil` when none,
    /// or only one the API refuses, was persisted.
    public func getDistinctIdFromCache() async -> String? {
        guard let cached = await cacheManager.get(IdentityStore.cacheKey, as: String.self)?.value,
            IdentityStore.invalidDistinctIdReason(cached) == nil
        else {
            return nil
        }
        return cached
    }

    /// Persists `distinctId` as the current identity. An id the API refuses is ignored.
    public func identify(distinctId: String) async {
        guard IdentityStore.invalidDistinctIdReason(distinctId) == nil else {
            return
        }
        await setDistinctId(distinctId)
    }

    /// Clears the cache, dropping the persisted identity, its groups and every cached response.
    public func reset() async {
        revision += 1
        currentDistinctId = nil
        currentGroups.value = [:]
        groupDigests = [:]
        let previous = pendingWrite
        let task = Task { [cacheManager] in
            await previous?.value
            await cacheManager.clear()
        }
        pendingWrite = task
        await task.value
    }

    /// Replaces the persisted identity with a fresh anonymous id, which belongs to no group.
    ///
    /// Everything that is not tied to a person — the schema, paywall configurations, the
    /// install marker — stays cached; the caller invalidates the entries of the identity being
    /// left behind.
    public func forgetDistinctId() async {
        currentGroups.value = [:]
        groupDigests = [:]
        await setDistinctId(generateAnonymousId())
        await persistGroups([:], digests: [:])
    }

    // MARK: - Groups

    /// The groups the end user belongs to, by group type: those ``loadGroups()`` read and every
    /// change since. Readable from any thread.
    public nonisolated var groups: [String: String] {
        return currentGroups.value
    }

    /// Reads the groups stored with the identity. A stored entry the API would refuse is left out.
    public func loadGroups() async {
        let stored =
            await cacheManager.get(IdentityStore.groupsCacheKey, as: [String: String].self)?.value
            ?? [:]
        let groups = stored.filter { type, key in
            IdentityStore.invalidGroupReason(type: type, key: key) == nil
        }
        currentGroups.value = groups
        groupDigests =
            (await cacheManager.get(
                IdentityStore.groupDigestsCacheKey, as: [String: String].self)?.value ?? [:]
            ).filter { type, _ in groups[type] != nil }
    }

    /// Puts the end user in group `key` of `type`, replacing their group of that type, and stores
    /// it with the identity. Returns whether their group of that type changed. A group the API
    /// refuses (see ``invalidGroupReason(type:key:)``) is ignored.
    ///
    /// Forgets the digest recorded for `type`: what the caller describes next is not what
    /// ``recordGroupDigests(_:)`` last recorded.
    public func setGroup(type: String, key: String) async -> Bool {
        guard IdentityStore.invalidGroupReason(type: type, key: key) == nil else {
            return false
        }
        let changed = currentGroups.value[type] != key
        let digests = groupDigests[type] == nil ? nil : groupDigests.filter { $0.key != type }
        guard changed || digests != nil else {
            return false
        }
        var groups = currentGroups.value
        groups[type] = key
        currentGroups.value = groups
        if let digests {
            groupDigests = digests
        }
        await persistGroups(changed ? groups : nil, digests: digests)
        return changed
    }

    /// Replaces every group the end user belongs to with `groups`, by group type, in one write.
    /// A group the API refuses (see ``invalidGroupReason(type:key:)``) is left out. The digests of
    /// types that left, or whose key changed, are forgotten.
    public func replaceGroups(_ groups: [String: String]) async {
        let previous = currentGroups.value
        let groups = groups.filter { type, key in
            IdentityStore.invalidGroupReason(type: type, key: key) == nil
        }
        let digests = groupDigests.filter { type, _ in
            groups[type] != nil && groups[type] == previous[type]
        }
        let digestsChanged = digests != groupDigests
        guard groups != previous || digestsChanged else {
            return
        }
        currentGroups.value = groups
        groupDigests = digests
        await persistGroups(
            groups != previous ? groups : nil, digests: digestsChanged ? digests : nil)
    }

    /// The digests ``recordGroupDigests(_:)`` recorded for the groups held now, by group type.
    public func sentGroupDigests() -> [String: String] {
        return groupDigests
    }

    /// Records `digests`, by group type, over the ones held, and stores them with the groups. A
    /// digest for a type the end user has no group of is left out.
    public func recordGroupDigests(_ digests: [String: String]) async {
        let groups = currentGroups.value
        let merged = groupDigests.merging(digests.filter { groups[$0.key] != nil }) { _, new in
            new
        }
        guard merged != groupDigests else {
            return
        }
        groupDigests = merged
        await persistGroups(nil, digests: merged)
    }

    /// Takes the end user out of every group.
    public func resetGroups() async {
        currentGroups.value = [:]
        groupDigests = [:]
        await persistGroups([:], digests: [:])
    }

    /// Why the API refuses `type` and `key` as a group, or `nil` when it accepts them: a type is a
    /// lower-case letter followed by up to 63 lower-case letters, digits or underscores, and a key
    /// holds 1 to ``maxGroupKeyLength`` characters.
    public static func invalidGroupReason(type: String, key: String) -> String? {
        let scalars = Array(type.unicodeScalars)
        let isTypeValid =
            (1...64).contains(scalars.count) && ("a"..."z").contains(scalars[0])
            && scalars.allSatisfy { scalar in
                ("a"..."z").contains(scalar) || ("0"..."9").contains(scalar) || scalar == "_"
            }
        if !isTypeValid {
            return "the group type must be a lower-case letter followed by up to 63 lower-case letters, digits or underscores, like company or team_1"
        }
        if !(1...maxGroupKeyLength).contains(key.utf16.count) {
            return "the group key must have 1 to \(maxGroupKeyLength) characters"
        }
        return nil
    }

    /// Whether `distinctId` was generated by the SDK, or an earlier build of it, rather than
    /// supplied by the host app.
    public static func isAnonymous(_ distinctId: String) -> Bool {
        return distinctId.hasPrefix(anonymousDistinctIdPrefix)
            || distinctId.hasPrefix(legacyAnonymousDistinctIdPrefix)
    }

    /// Whether `distinctId` is empty or whitespace only, which no request can be scoped to.
    public static func isBlank(_ distinctId: String) -> Bool {
        return distinctId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    /// Why the API refuses `distinctId` as an identity, or `nil` when it accepts it.
    ///
    /// The rule the backend applies to every distinct id: at least one non-whitespace character,
    /// at most ``maxDistinctIdLength`` code points and no NUL. An id is used exactly as given,
    /// never trimmed.
    public static func invalidDistinctIdReason(_ distinctId: String) -> String? {
        if isBlank(distinctId) {
            return "must contain at least one non-whitespace character"
        }
        if distinctId.unicodeScalars.count > maxDistinctIdLength {
            return "must be at most \(maxDistinctIdLength) characters long"
        }
        if distinctId.unicodeScalars.contains("\u{0}") {
            return "must not contain NUL characters"
        }
        return nil
    }

    /// Writes `groups` and `digests`, each unless `nil`, behind every earlier write, so a reset's
    /// clear cannot be overtaken by them.
    private func persistGroups(_ groups: [String: String]?, digests: [String: String]?) async {
        let previous = pendingWrite
        let task = Task { [cacheManager] in
            await previous?.value
            for (key, value) in [
                (IdentityStore.groupsCacheKey, groups),
                (IdentityStore.groupDigestsCacheKey, digests),
            ] {
                guard let value else {
                    continue
                }
                if value.isEmpty {
                    await cacheManager.delete(key)
                } else {
                    await cacheManager.set(key, value: value)
                }
            }
        }
        pendingWrite = task
        await task.value
    }

    private func setDistinctId(_ distinctId: String) async {
        revision += 1
        currentDistinctId = distinctId
        let previous = pendingWrite
        let task = Task { [cacheManager] in
            await previous?.value
            await cacheManager.set(IdentityStore.cacheKey, value: distinctId)
        }
        pendingWrite = task
        await task.value
    }
}

/// The groups of an ``IdentityStore``, read without reaching the actor.
private final class GroupsBox: @unchecked Sendable {
    private let lock = NSLock()
    private var groups: [String: String] = [:]

    var value: [String: String] {
        get { lock.withLock { groups } }
        set { lock.withLock { groups = newValue } }
    }
}
