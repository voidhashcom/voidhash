import Foundation

@_spi(VoidhashHost) import Voidhash
@_spi(VoidhashHost) import VoidhashCore

/// Carries what the React Native SDK's TypeScript core persisted over to the native client, once
/// per storage namespace, before that client first loads its state.
///
/// Both wrote to the same `UserDefaults` namespace and the same Application Support directory,
/// with the same envelope, so most cache entries are the native client's already: the identity,
/// the session, the last-seen release, person snapshots, the schema, paywall resolutions, known
/// placements, flow state, processed-transaction markers and the restored-series owners are kept
/// as they are. What differs is converted (the consent key, flag keys, a `null` person or
/// paywall, the TypeScript queues) or dropped (the store-product cache, the SDK-started markers).
///
/// Each store is imported on its own: the native write goes first, the TypeScript source is
/// deleted once it succeeded, and a marker records the store as done. A store that fails keeps
/// its source and is tried again on the next start; records are deduplicated, so a store
/// imported twice holds each record once.
struct VoidhashLegacyImporter: Sendable {
    /// The TypeScript core's queue files, next to the native ones.
    enum LegacyFile: String, CaseIterable, Sendable {
        case personWrites = "rn-person-writes"
        case transactionOutbox = "rn-transaction-outbox"
        case receiptLedger = "rn-receipt-ledger"
        case analyticsQueue = "rn-analytics-queue"
    }

    /// The native queue files the importer writes into.
    enum NativeFile: String, Sendable {
        case personWrites = "person-writes"
        case transactionOutbox = "transaction-outbox"
        case acceptedReceipts = "accepted-receipts"
        case analyticsQueue = "analytics-queue"
    }

    /// Prefix of the done markers, one per store.
    static let markerPrefix = "voidhash:rn-import:v1:"
    /// The newest events of the TypeScript queue that survive, as its compaction keeps them.
    static let maxImportedEvents = 1000
    /// Lifetime of the processed-transaction marker of a host-reported receipt, as the native
    /// client writes it.
    static let processedMarkerTtlMilliseconds = PurchaseOrchestrator.processedTransactionTtlMilliseconds
    /// Lifetime of the owner of a restored series, as the native client writes it.
    static let restoredOwnerTtlMilliseconds: Double = 1000 * 60 * 60 * 24 * 30

    let cache: CacheManager
    let store: @Sendable (String) -> (any RecordStore)?
    let protectedData: any ProtectedDataAvailability
    let now: @Sendable () -> Double

    init(
        cache: CacheManager,
        store: @escaping @Sendable (String) -> (any RecordStore)?,
        protectedData: any ProtectedDataAvailability = SystemProtectedDataAvailability(),
        now: @escaping @Sendable () -> Double = { Date().timeIntervalSince1970 * 1000 }
    ) {
        self.cache = cache
        self.store = store
        self.protectedData = protectedData
        self.now = now
    }

    /// Whether the native client's namespace for `configuration` is the one the TypeScript core
    /// derived, so its data can be imported there.
    static func namespaceMatches(_ configuration: NativeClientCoreConfiguration) -> Bool {
        return forConfiguration(configuration) != nil
    }

    /// The importer for the storage namespace of `configuration`'s publishable key and origin.
    ///
    /// The TypeScript core derived the namespace from the publishable key and the `baseUrl`
    /// string exactly as configured, as the native client does from the URL's absolute string,
    /// which keeps the string as written (a trailing slash included). Where the two would
    /// differ, nothing is imported and no store is marked done, rather than marking empty
    /// stores done in a namespace the legacy data never lived in.
    static func forConfiguration(_ configuration: NativeClientCoreConfiguration)
        -> VoidhashLegacyImporter?
    {
        guard let baseUrl = URL(string: configuration.baseUrl) else {
            return nil
        }
        let namespace = CacheNamespace.prefix(
            publishableKey: configuration.publishableKey, baseUrl: baseUrl)
        let legacyNamespace =
            "vh:\(CacheNamespace.schemaVersion):"
            + CacheNamespace.hash(configuration.publishableKey + "|" + configuration.baseUrl) + ":"
        guard legacyNamespace == namespace else {
            return nil
        }
        return VoidhashLegacyImporter(
            cache: CacheManager(adapter: UserDefaultsCacheAdapter(keyPrefix: namespace)),
            store: { name in FileRecordStore.applicationSupport(namespace: namespace, name: name) })
    }

    /// Imports every store not imported yet, in the order the native client depends on them:
    /// consent, person writes, receipts, analytics, then the caches. The identity needs nothing:
    /// both cores keep it under `distinctId` in the same envelope.
    func run() async {
        if !(await protectedData.isAvailable()) {
            await protectedData.waitUntilAvailable()
        }
        await once("consent") { await importConsent() }
        await once("person-writes") { await importPersonWrites() }
        await once("transaction-outbox") { await importTransactionOutbox() }
        await once("receipt-ledger") { await importReceiptLedger() }
        await once("analytics-queue") { await importAnalyticsQueue() }
        await once("caches") { await importCaches() }
    }

    /// How importing one store went.
    enum Outcome: Equatable {
        /// Its source was carried over and deleted.
        case imported
        /// There was nothing to import; the store is looked at again next time.
        case nothingToImport
        /// The native write could not be confirmed; the source stays for the next start.
        case failed
    }

    /// Runs `step` unless its store was imported before, and marks it done once it imported
    /// something. A store with no source is not marked, so data that only appears later (a
    /// namespace read for the first time) is still imported.
    private func once(_ store: String, _ step: () async -> Outcome) async {
        let marker = VoidhashLegacyImporter.markerPrefix + store
        if await cache.get(marker, as: Bool.self)?.value == true {
            return
        }
        if await step() == .imported {
            await cache.set(marker, value: true)
        }
    }

    // MARK: - Consent

    /// The end user's consent decision, under the key the iOS client reads it from. A decision
    /// the iOS client recorded already wins.
    private func importConsent() async -> Outcome {
        let legacyKey = "voidhash:consent:analytics"
        guard let legacy = await cache.envelopeJson(legacyKey) else {
            return .nothingToImport
        }
        if await cache.envelopeJson("consent:analytics") == nil {
            await cache.setEnvelopeJson("consent:analytics", legacy)
        }
        await cache.delete(legacyKey)
        return .imported
    }

    // MARK: - Person writes

    private struct LegacyPersonWrite: Decodable {
        let kind: String
        let distinctId: String
        let alias: String?
        let email: String?
        let name: String?
        let traits: [String: JSONValue]?
        let attempts: Int?
        let availableAt: Double?
    }

    /// Identify links and trait writes, in queue order. Traits for one person are merged, the
    /// newest value per key, as the native queue holds one traits write per person. The
    /// TypeScript `carriesSnapshot` flag has no native counterpart: a carried snapshot stays
    /// stale-flagged and is revalidated by the next read.
    private func importPersonWrites() async -> Outcome {
        guard let legacy = store(LegacyFile.personWrites.rawValue),
            let native = store(NativeFile.personWrites.rawValue)
        else {
            return .failed
        }
        let loaded = await legacy.load()
        let existing = await native.load()
        guard !loaded.readFailed, !existing.readFailed else {
            return .failed
        }
        guard !loaded.lines.isEmpty else {
            return .nothingToImport
        }
        let decoder = JSONDecoder()
        // Native lines this version cannot decode are kept as they are, in place.
        let queued = existing.lines.map { line in
            (line: line, write: try? decoder.decode(PersonWrite.self, from: Data(line.utf8)))
        }
        let nativeWrites = queued.compactMap(\.write)
        // Legacy writes are older than anything the native client queued: they order before it.
        let firstSequence = (nativeWrites.map(\.sequence).min() ?? 1) - loaded.lines.count
        var writes: [PersonWrite] = []
        var positions: [String: Int] = [:]
        for line in loaded.lines {
            guard let record = try? decoder.decode(LegacyPersonWrite.self, from: Data(line.utf8))
            else {
                continue
            }
            var write: PersonWrite
            switch record.kind {
            case "identify":
                guard let alias = record.alias else {
                    continue
                }
                write = .identify(
                    alias: alias, target: record.distinctId, email: record.email, name: record.name)
            case "traits":
                var traits = record.traits ?? [:]
                record.email.map { traits["email"] = .string($0) }
                record.name.map { traits["name"] = .string($0) }
                write = .traits(traits, for: record.distinctId)
            default:
                continue
            }
            write.attempts = record.attempts ?? 0
            write.availableAt = record.availableAt ?? 0
            let key = VoidhashLegacyImporter.mergeKey(write)
            if let position = positions[key] {
                var merged = write
                let older = writes[position]
                merged.traits = older.traits.merging(write.traits) { _, newest in newest }
                merged.email = write.email ?? older.email
                merged.name = write.name ?? older.name
                merged.sequence = older.sequence
                writes[position] = merged
            } else {
                write.sequence = firstSequence + writes.count
                positions[key] = writes.count
                writes.append(write)
            }
        }
        // A write already in the native queue with the same contents was imported by a start
        // that stopped before it deleted the source: it is not queued, and sent, twice. One the
        // native client queued for the same person since is newer: the legacy write is merged
        // into it as the older one, so the native values win, and the native queue's order
        // holds. The rest go first, in their own order, so an identify that native traits of its
        // person depend on is delivered before them; except a write about a person a native
        // identify links onto, which goes after that identify.
        let alreadyQueued = Set(nativeWrites.map(VoidhashLegacyImporter.contentKey))
        var lines = queued.map { [$0.line] }
        var front: [String] = []
        var changed = false
        let encoder = JSONEncoder()
        for write in writes where !alreadyQueued.contains(VoidhashLegacyImporter.contentKey(write)) {
            if let index = queued.firstIndex(where: {
                $0.write.map(VoidhashLegacyImporter.mergeKey) == VoidhashLegacyImporter.mergeKey(write)
            }), let newer = queued[index].write {
                let merged = VoidhashLegacyImporter.merge(write, into: newer)
                guard merged != newer, let encoded = try? encoder.encode(merged) else {
                    continue
                }
                lines[index][0] = String(decoding: encoded, as: UTF8.self)
            } else {
                guard let encoded = try? encoder.encode(write) else {
                    continue
                }
                let line = String(decoding: encoded, as: UTF8.self)
                if let identify = queued.lastIndex(where: {
                    $0.write?.kind == .identify && $0.write?.target == write.target
                }) {
                    lines[identify].append(line)
                } else {
                    front.append(line)
                }
            }
            changed = true
        }
        if changed, !(await native.replace(with: front + lines.flatMap { $0 })) {
            return .failed
        }
        await legacy.clear()
        return .imported
    }

    /// `newer` with what it leaves unset taken from `older`, as the native queue merges.
    private static func merge(_ older: PersonWrite, into newer: PersonWrite) -> PersonWrite {
        var merged = newer
        merged.traits = older.traits.merging(newer.traits) { _, newest in newest }
        merged.email = newer.email ?? older.email
        merged.name = newer.name ?? older.name
        return merged
    }

    /// The native queue's merge key: traits per person, an identify per alias and target.
    private static func mergeKey(_ write: PersonWrite) -> String {
        return "\(write.kind.rawValue)|\(write.alias ?? "")|\(write.target)"
    }

    /// What a write asks the backend for, whatever its retry state.
    private static func contentKey(_ write: PersonWrite) -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = .sortedKeys
        let traits =
            (try? encoder.encode(write.traits)).map { String(decoding: $0, as: UTF8.self) } ?? ""
        return [mergeKey(write), write.email ?? "", write.name ?? "", traits].joined(separator: "|")
    }

    // MARK: - Transactions

    private struct LegacyTransaction: Codable, Sendable {
        let transactionId: String?
        let originalTransactionId: String?
        let purchaseDate: Double?
        let revocationDate: Double?
        let platform: String?
        let externallyManaged: Bool?
    }

    private struct LegacyOutboxRecord: Codable, Sendable {
        let key: String
        let distinctId: String
        let restoreDistinctId: String?
        let attempts: Int?
        let availableAt: Double?
        let transaction: LegacyTransaction
    }

    /// Every App Store receipt still waiting for Voidhash, with its owner, its restore intent and
    /// its host-reported state. Records for other stores (a Google Play token) and development
    /// purchases cannot be sent by the iOS client and are left out.
    private func importTransactionOutbox() async -> Outcome {
        guard let legacy = store(LegacyFile.transactionOutbox.rawValue),
            let native = store(NativeFile.transactionOutbox.rawValue)
        else {
            return .failed
        }
        let loaded = await legacy.load()
        guard !loaded.readFailed else {
            return .failed
        }
        let decoder = JSONDecoder()
        var records: [LegacyOutboxRecord] = loaded.lines.compactMap {
            try? decoder.decode(LegacyOutboxRecord.self, from: Data($0.utf8))
        }
        let legacyKey = "transactions:outbox"
        let hasLegacyKey = await cache.envelopeJson(legacyKey) != nil
        if let cached = await cache.get(legacyKey, as: [LegacyOutboxRecord].self)?.value {
            records = cached + records
        }
        guard !loaded.lines.isEmpty || hasLegacyKey else {
            return .nothingToImport
        }
        let existing = await native.load()
        guard !existing.readFailed else {
            return .failed
        }
        var known = Set(
            existing.lines.compactMap {
                try? decoder.decode(OutboxRecord.self, from: Data($0.utf8)).transactionId
            })
        var lines: [String] = []
        var hostReported: [String] = []
        let encoder = JSONEncoder()
        for record in records {
            guard record.key.hasPrefix("ios:"),
                let transactionId = record.transaction.transactionId,
                !transactionId.isEmpty, !known.contains(transactionId)
            else {
                continue
            }
            known.insert(transactionId)
            let outboxRecord = OutboxRecord(
                transactionId: transactionId, distinctId: record.distinctId,
                body: SdkSyncTransactionBody(platform: "ios", transactionId: transactionId),
                attempts: record.attempts ?? 0, availableAt: record.availableAt ?? 0,
                restoreDistinctId: record.restoreDistinctId,
                receipt: ReceiptReference(
                    transactionId: transactionId,
                    originalTransactionId: record.transaction.originalTransactionId,
                    purchaseDate: record.transaction.purchaseDate,
                    isRevoked: record.transaction.revocationDate != nil),
                // The host's to finish for good, also once the marker below has lapsed.
                hostClaimed: record.transaction.externallyManaged == true)
            guard let data = try? encoder.encode(outboxRecord) else {
                return .failed
            }
            lines.append(String(decoding: data, as: UTF8.self))
            if record.transaction.externallyManaged == true {
                hostReported.append(transactionId)
            }
        }
        if !lines.isEmpty, !(await native.append(lines)) {
            return .failed
        }
        // Another integration finishes these; the marker keeps the native client from doing so.
        for transactionId in hostReported {
            let key = "processed-transaction:ios:\(transactionId)"
            if await cache.envelopeJson(key) == nil {
                await cache.set(
                    key,
                    value: ProcessedMarker(
                        backendAccepted: false, storeFinalized: false, externallyManaged: true),
                    ttl: VoidhashLegacyImporter.processedMarkerTtlMilliseconds)
            }
        }
        await legacy.clear()
        await cache.delete(legacyKey)
        return .imported
    }

    private struct ProcessedMarker: Codable, Sendable {
        let backendAccepted: Bool
        let storeFinalized: Bool
        let externallyManaged: Bool?
    }

    private struct LegacyLedgerEntry: Decodable {
        let key: String
        let owner: String?
        let acceptedId: String?
        let revoked: Bool?
    }

    /// Receipts Voidhash accepted, so they are not sent again, and their owners: an App Store
    /// series' owner becomes the identity its renewals are reported under, and an `account:`
    /// claim (a purchase the SDK started, keyed by its app account token) the owner the native
    /// client reads for a transaction carrying that token. An entry without an `acceptedId` only
    /// names an owner (claimed for a restore not delivered yet, or carried over from an earlier
    /// release): Voidhash has not accepted its series, so it is no acceptance here either.
    private func importReceiptLedger() async -> Outcome {
        guard let legacy = store(LegacyFile.receiptLedger.rawValue),
            let native = store(NativeFile.acceptedReceipts.rawValue)
        else {
            return .failed
        }
        let loaded = await legacy.load()
        guard !loaded.readFailed else {
            return .failed
        }
        guard !loaded.lines.isEmpty else {
            return .nothingToImport
        }
        let decoder = JSONDecoder()
        let entries = loaded.lines.compactMap {
            try? decoder.decode(LegacyLedgerEntry.self, from: Data($0.utf8))
        }
        var receipts: [ReceiptReference] = []
        for entry in entries where entry.key.hasPrefix("ios:") {
            guard let acceptedId = entry.acceptedId else {
                continue
            }
            let series = String(entry.key.dropFirst("ios:".count))
            receipts.append(
                ReceiptReference(
                    transactionId: acceptedId, originalTransactionId: series,
                    isRevoked: entry.revoked ?? false))
        }
        // Written once, and only trusted once written: the ledger refuses to rewrite a store it
        // could not read.
        let ledger = AcceptedReceiptLedger(store: native)
        let written = await ledger.recordAcceptances(receipts)
        await ledger.retire()
        guard written else {
            return .failed
        }
        for entry in entries {
            guard let owner = entry.owner else {
                continue
            }
            if entry.key.hasPrefix("ios:") {
                let series = String(entry.key.dropFirst("ios:".count))
                await setIfAbsent(
                    "restored-transaction-identity:ios:\(series)", owner,
                    ttl: VoidhashLegacyImporter.restoredOwnerTtlMilliseconds)
            } else if entry.key.hasPrefix("account:") {
                let token = entry.key.dropFirst("account:".count).lowercased()
                await setIfAbsent("transaction-identity:\(token)", owner, ttl: nil)
            }
        }
        await legacy.clear()
        return .imported
    }

    private func setIfAbsent(_ key: String, _ value: String, ttl: Double?) async {
        if await cache.envelopeJson(key) == nil {
            await cache.set(key, value: value, ttl: ttl)
        }
    }

    // MARK: - Analytics

    private struct LegacyEvent: Codable, Sendable {
        let id: String
        let eventName: String
        let properties: [String: JSONValue]?
        let distinctId: String?
        let sessionId: String?
        let eventTimestamp: String
        let attempts: Int?
        let availableAt: Double?
    }

    /// The events still waiting, the newest 1000, each once, sent with the properties the
    /// TypeScript core stamped at capture and never stamped again.
    private func importAnalyticsQueue() async -> Outcome {
        guard let legacy = store(LegacyFile.analyticsQueue.rawValue),
            let native = store(NativeFile.analyticsQueue.rawValue)
        else {
            return .failed
        }
        let loaded = await legacy.load()
        let existing = await native.load()
        guard !loaded.readFailed, !existing.readFailed else {
            return .failed
        }
        let hasLegacyKey = await cache.envelopeJson("analytics:queue") != nil
        guard !loaded.lines.isEmpty || hasLegacyKey else {
            return .nothingToImport
        }
        let decoder = JSONDecoder()
        var events: [LegacyEvent] = []
        let legacyKey = "analytics:queue"
        if let cached = await cache.get(legacyKey, as: [LegacyEvent].self)?.value {
            events = cached
        }
        events += loaded.lines.compactMap {
            try? decoder.decode(LegacyEvent.self, from: Data($0.utf8))
        }
        // The latest state of each event, at its first place.
        var unique: [LegacyEvent] = []
        var positions: [String: Int] = [:]
        for event in events {
            if let position = positions[event.id] {
                unique[position] = event
            } else {
                positions[event.id] = unique.count
                unique.append(event)
            }
        }
        let known = Set(
            existing.lines.compactMap { line -> String? in
                guard let object = try? JSONDecoder().decode(
                    [String: JSONValue].self, from: Data(line.utf8)),
                    case .string(let id)? = object["id"]
                else {
                    return nil
                }
                return id
            })
        let kept = unique.filter { !known.contains($0.id) }
            .suffix(VoidhashLegacyImporter.maxImportedEvents)
        let base = existing.lines.count
        let lines = kept.enumerated().compactMap { offset, event in
            AnalyticsClient.importedQueueLine(
                id: event.id, name: event.eventName, properties: event.properties ?? [:],
                timestamp: event.eventTimestamp, sessionId: event.sessionId ?? "",
                distinctId: event.distinctId ?? "", attempts: event.attempts ?? 0,
                availableAt: event.availableAt ?? 0, sequence: base + offset + 1)
        }
        if !lines.isEmpty, !(await native.append(lines)) {
            return .failed
        }
        await legacy.clear()
        await cache.delete(legacyKey)
        return .imported
    }

    // MARK: - Caches

    private struct RawEnvelope: Decodable {
        let value: JSONValue
        let createdAt: Double
        let expiresAt: Double?
        let staleAt: Double?
    }

    private struct LegacyFlags: Decodable {
        let flags: [SdkFeatureFlagResult]
    }

    /// Converts or drops the cache entries the native client does not read as they are.
    private func importCaches() async -> Outcome {
        for key in await cache.getCacheKeys() {
            if key.hasPrefix("feature-flags:") {
                await convertFlags(key)
            } else if key.hasPrefix("person:") {
                await convertNullEntry(key, nativeKey: "person-none:" + key.dropFirst("person:".count))
            } else if key.hasPrefix("paywall:"), key != "paywall:placements" {
                if await convertNullEntry(
                    key, nativeKey: "paywall-unassigned:" + key.dropFirst("paywall:".count)) == false
                {
                    await dropUnless(key, decodesAs: SdkResolvedPaywall.self)
                }
            } else if key == "schema:current" {
                await dropUnless(key, decodesAs: SchemaManager.StoredSchema.self)
            } else if key.hasPrefix("schema:") {
                // An older TypeScript build kept the schema per app version.
                await cache.delete(key)
            } else if key == "native-products" || key.hasPrefix("native-products:") {
                await cache.delete(key)
            } else if key.hasPrefix("sdk-started-purchase:") {
                // The iOS client finishes the purchases it started through StoreKit's
                // unfinished-transaction stream, and reads their owner from
                // `transaction-identity:`, so this marker has no counterpart.
                await cache.delete(key)
            } else if key.hasPrefix("transaction-identity:") {
                let token = String(key.dropFirst("transaction-identity:".count))
                if token != token.lowercased(), let envelope = await cache.envelopeJson(key) {
                    let lowered = "transaction-identity:" + token.lowercased()
                    if await cache.envelopeJson(lowered) == nil {
                        await cache.setEnvelopeJson(lowered, envelope)
                    }
                    await cache.delete(key)
                }
            }
        }
        // One full pass converts every entry; later starts skip the scan.
        return .imported
    }

    /// A `null` value carried to `nativeKey` as the native "nothing here" marker, with the same
    /// deadlines. Returns whether the entry was one.
    @discardableResult
    private func convertNullEntry(_ key: String, nativeKey: String) async -> Bool {
        guard let json = await cache.envelopeJson(key),
            let envelope = try? JSONDecoder().decode(RawEnvelope.self, from: Data(json.utf8)),
            envelope.value == .null
        else {
            return false
        }
        if await cache.envelopeJson(nativeKey) == nil {
            await cache.setEnvelopeJson(
                nativeKey, VoidhashLegacyImporter.envelopeJson(.bool(true), like: envelope))
        }
        await cache.delete(key)
        return true
    }

    /// `feature-flags:<id>:<signature>` carried to the native flag key, `<signature>` being `all`
    /// or the sorted requested keys as a JSON array.
    private func convertFlags(_ key: String) async {
        await carryFlags(key)
        await cache.delete(key)
    }

    private func carryFlags(_ key: String) async {
        let rest = key.dropFirst("feature-flags:".count)
        let signature: Substring
        let distinctId: Substring
        if rest.hasSuffix(":all") {
            signature = "all"
            distinctId = rest.dropLast(":all".count)
        } else if let range = rest.range(of: ":[", options: .backwards) {
            signature = rest[rest.index(after: range.lowerBound)...]
            distinctId = rest[..<range.lowerBound]
        } else {
            return
        }
        let keys: [String]?
        if signature == "all" {
            keys = nil
        } else if let parsed = try? JSONDecoder().decode([String].self, from: Data(signature.utf8)) {
            keys = parsed
        } else {
            return
        }
        guard let json = await cache.envelopeJson(key),
            let envelope = try? JSONDecoder().decode(RawEnvelope.self, from: Data(json.utf8)),
            let valueData = try? JSONEncoder().encode(envelope.value),
            let flags = try? JSONDecoder().decode(LegacyFlags.self, from: valueData),
            let converted = try? JSONDecoder().decode(
                JSONValue.self, from: JSONEncoder().encode(flags.flags))
        else {
            return
        }
        let nativeKey = VoidhashClient.hostFlagsCacheKey(distinctId: String(distinctId), keys: keys)
        if await cache.envelopeJson(nativeKey) == nil {
            await cache.setEnvelopeJson(
                nativeKey, VoidhashLegacyImporter.envelopeJson(converted, like: envelope))
        }
    }

    private func dropUnless<Value: Codable & Sendable>(_ key: String, decodesAs: Value.Type) async {
        if await cache.get(key, as: Value.self) == nil {
            await cache.delete(key)
        }
    }

    private static func envelopeJson(_ value: JSONValue, like envelope: RawEnvelope) -> String {
        let object: [String: JSONValue] = [
            "value": value, "createdAt": .number(envelope.createdAt),
            "expiresAt": envelope.expiresAt.map(JSONValue.number) ?? .null,
            "staleAt": envelope.staleAt.map(JSONValue.number) ?? .null,
        ]
        let data = (try? JSONEncoder().encode(JSONValue.object(object))) ?? Data()
        return String(decoding: data, as: UTF8.self)
    }
}
