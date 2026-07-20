import CryptoKit
import Foundation
import Security
import SQLite3

struct MeasurementStoredOutboxRecord {
    let recordId: String
    let recordType: String
    let sequence: Int64
    let priority: String
    let publicPayload: String
    let protectedPayloadRef: String?
    let attemptCount: Int
}

struct MeasurementStoredInboxEntry {
    let id: String
    let kind: String
    let source: String
    let appState: String
    let receivedAt: String
    let protectedPayloadRef: String
}

struct MeasurementStoreSnapshotValue {
    let installationId: String
    let firstOpenedAt: String
    let sequence: Int64
    let counts: [String: Int]
    let oldestQueuedAtMs: Int64?
}

struct MeasurementStoredProtectedEvidence {
    let blobId: String
    let purpose: String
    let consentRevision: Int64
    let retentionClass: String
    let encryptionKeyVersion: Int
    let deletionState: String
    let value: Data
}

struct MeasurementStoredProtectedUpload {
    let blobId: String
    let purpose: String
    let consentRevision: Int64
    let retentionClass: String
    let encryptionKeyVersion: Int
    let deletionState: String
    let ciphertext: Data?
    let uploadState: String
    let attemptCount: Int
    let eligibleAtMs: Int64
}

struct MeasurementStoredConfigurationState {
    let version: Int64
    let payload: Data?
}

final class MeasurementStore: @unchecked Sendable {
    private let lock = NSRecursiveLock()
    private var database: OpaquePointer?
    private let crypto = MeasurementVaultCrypto()
    private var maxOutboxRecords: Int64
    private var maxOutboxBytes: Int64
    private var maxProtectedBytes: Int64
    private let maxDedupeRecords: Int64
    private let maxInboxRecords: Int64

    let databaseURL: URL

    init(
        maxOutboxRecords: Int64 = 10_000,
        maxOutboxBytes: Int64 = 20 * 1024 * 1024,
        maxProtectedBytes: Int64 = 20 * 1024 * 1024,
        maxDedupeRecords: Int64 = 25_000,
        maxInboxRecords: Int64 = 1_000,
        databaseURL overrideDatabaseURL: URL? = nil
    ) throws {
        self.maxOutboxRecords = maxOutboxRecords
        self.maxOutboxBytes = maxOutboxBytes
        self.maxProtectedBytes = maxProtectedBytes
        self.maxDedupeRecords = maxDedupeRecords
        self.maxInboxRecords = maxInboxRecords

        let base = overrideDatabaseURL?.deletingLastPathComponent()
            ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
                .appendingPathComponent("voidhash-measurement", isDirectory: true)
        try FileManager.default.createDirectory(at: base, withIntermediateDirectories: true)
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        var excluded = base
        try excluded.setResourceValues(values)
        databaseURL = overrideDatabaseURL ?? base.appendingPathComponent("measurement.sqlite")
        if sqlite3_open_v2(
            databaseURL.path,
            &database,
            SQLITE_OPEN_CREATE | SQLITE_OPEN_READWRITE | SQLITE_OPEN_FULLMUTEX,
            nil
        ) != SQLITE_OK {
            throw failure("MEASUREMENT_STORE_OPEN_FAILED")
        }
        try execute("PRAGMA journal_mode=WAL")
        try execute("PRAGMA synchronous=FULL")
        try migrate()
        try ensureInstallation()
    }

    deinit {
        sqlite3_close(database)
    }

    func snapshot() throws -> MeasurementStoreSnapshotValue {
        try locked {
            try ensureInstallation()
            let installation = try query(
                "SELECT installation_id, first_opened_at, sequence FROM installation WHERE singleton = 1"
            ) { statement in
                (
                    text(statement, 0),
                    text(statement, 1),
                    sqlite3_column_int64(statement, 2)
                )
            }.first
            guard let installation else { throw failure("MEASUREMENT_INSTALLATION_MISSING") }
            var counts: [String: Int] = [:]
            for (priority, count) in try query(
                "SELECT priority, COUNT(*) FROM outbox WHERE acknowledgement_state = 'pending' GROUP BY priority"
            , row: { (text($0, 0), Int(sqlite3_column_int64($0, 1))) }) {
                counts[priority] = count
            }
            let oldest = try query(
                "SELECT MIN(queued_at_ms) FROM outbox WHERE acknowledgement_state = 'pending'"
            ) { statement -> Int64? in
                sqlite3_column_type(statement, 0) == SQLITE_NULL ? nil : sqlite3_column_int64(statement, 0)
            }.first ?? nil
            return MeasurementStoreSnapshotValue(
                installationId: installation.0,
                firstOpenedAt: installation.1,
                sequence: installation.2,
                counts: counts,
                oldestQueuedAtMs: oldest
            )
        }
    }

    func enqueue(
        recordId: String,
        recordType: String,
        occurredAt: String,
        priority: String,
        source: String,
        publicPayload: String,
        protectedPayloadRef: String?,
        queuedAtMs: Int64 = Int64(Date().timeIntervalSince1970 * 1_000)
    ) throws -> Int64 {
        try locked {
            try transaction {
                try ensureInstallation()
                if let existing = try scalarInt64(
                    "SELECT installation_sequence FROM outbox WHERE record_id = ?",
                    bindings: [.text(recordId)]
                ) {
                    return existing
                }
                let bytes = Int64(publicPayload.utf8.count)
                try evictFor(additionalBytes: bytes)
                try execute("UPDATE installation SET sequence = sequence + 1 WHERE singleton = 1")
                guard let sequence = try scalarInt64("SELECT sequence FROM installation WHERE singleton = 1") else {
                    throw failure("MEASUREMENT_SEQUENCE_MISSING")
                }
                try execute(
                    """
                    INSERT INTO outbox (
                      record_id, record_type, installation_sequence, occurred_at, queued_at_ms,
                      priority, source, public_payload, public_payload_bytes, protected_payload_ref,
                      attempt_count, eligible_at_ms, acknowledgement_state
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'pending')
                    """,
                    bindings: [
                        .text(recordId), .text(recordType), .int(sequence), .text(occurredAt),
                        .int(queuedAtMs), .text(priority.lowercased()), .text(source.lowercased()),
                        .text(publicPayload), .int(bytes), protectedPayloadRef.map(SQLiteBinding.text) ?? .null,
                        .int(queuedAtMs),
                    ]
                )
                return sequence
            }
        }
    }

    func peekEligible(limit: Int, nowMs: Int64 = Int64(Date().timeIntervalSince1970 * 1_000)) throws -> [MeasurementStoredOutboxRecord] {
        try locked {
            try query(
                """
                SELECT record_id, record_type, installation_sequence, priority, public_payload,
                       protected_payload_ref, attempt_count
                FROM outbox
                WHERE acknowledgement_state = 'pending' AND eligible_at_ms <= ?
                ORDER BY CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
                         installation_sequence ASC
                LIMIT ?
                """,
                bindings: [.int(nowMs), .int(Int64(max(0, limit)))]
            ) { statement in
                MeasurementStoredOutboxRecord(
                    recordId: text(statement, 0),
                    recordType: text(statement, 1),
                    sequence: sqlite3_column_int64(statement, 2),
                    priority: text(statement, 3),
                    publicPayload: text(statement, 4),
                    protectedPayloadRef: optionalText(statement, 5),
                    attemptCount: Int(sqlite3_column_int(statement, 6))
                )
            }
        }
    }

    @discardableResult
    func acknowledge(recordId: String) throws -> Bool {
        try locked {
            try execute(
                "UPDATE outbox SET acknowledgement_state = 'acknowledged' WHERE record_id = ? AND acknowledgement_state != 'acknowledged'",
                bindings: [.text(recordId)]
            )
            return sqlite3_changes(database) > 0
        }
    }

    @discardableResult
    func scheduleRetry(recordId: String, eligibleAtMs: Int64) throws -> Bool {
        try locked {
            try execute(
                "UPDATE outbox SET attempt_count = attempt_count + 1, eligible_at_ms = ? WHERE record_id = ? AND acknowledgement_state = 'pending'",
                bindings: [.int(eligibleAtMs), .text(recordId)]
            )
            return sqlite3_changes(database) > 0
        }
    }

    @discardableResult
    func reject(recordId: String, reason: String, quarantine: Bool = false) throws -> Bool {
        try locked {
            try transaction {
                try writeDiagnostic(
                    recordId: recordId,
                    outcome: quarantine ? "quarantined" : "rejected",
                    reason: reason
                )
                try execute(
                    "UPDATE outbox SET acknowledgement_state = ? WHERE record_id = ? AND acknowledgement_state = 'pending'",
                    bindings: [.text(quarantine ? "quarantined" : "rejected"), .text(recordId)]
                )
                return sqlite3_changes(database) > 0
            }
        }
    }

    func putProtectedEvidence(
        blobId: String = "blob_\(UUID().uuidString.lowercased())",
        purpose: String,
        consentRevision: Int64,
        retentionClass: String,
        value: Data,
        keyVersion: Int? = nil
    ) throws -> String {
        try locked {
            let version = keyVersion ?? crypto.currentVersion
            let encrypted = try crypto.encrypt(value, version: version)
            let current = try scalarInt64(
                "SELECT COALESCE(SUM(LENGTH(ciphertext)), 0) FROM protected_evidence WHERE deletion_state = 'active'"
            ) ?? 0
            guard current + Int64(encrypted.count) <= maxProtectedBytes else {
                throw failure("MEASUREMENT_PROTECTED_VAULT_BOUND")
            }
            try execute(
                """
                INSERT OR IGNORE INTO protected_evidence (
                  blob_id, purpose, consent_revision, retention_class, encryption_key_version,
                  deletion_state, ciphertext, created_at_ms
                ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
                """,
                bindings: [
                    .text(blobId), .text(purpose), .int(consentRevision), .text(retentionClass),
                    .int(Int64(version)), .blob(encrypted),
                    .int(Int64(Date().timeIntervalSince1970 * 1_000)),
                ]
            )
            return blobId
        }
    }

    func getProtectedEvidence(blobId: String) throws -> MeasurementStoredProtectedEvidence? {
        try locked {
            try query(
                "SELECT purpose, consent_revision, retention_class, encryption_key_version, deletion_state, ciphertext FROM protected_evidence WHERE blob_id = ?",
                bindings: [.text(blobId)]
            ) { statement in
                let version = Int(sqlite3_column_int(statement, 3))
                return MeasurementStoredProtectedEvidence(
                    blobId: blobId,
                    purpose: text(statement, 0),
                    consentRevision: sqlite3_column_int64(statement, 1),
                    retentionClass: text(statement, 2),
                    encryptionKeyVersion: version,
                    deletionState: text(statement, 4),
                    value: try crypto.decrypt(blob(statement, 5), version: version)
                )
            }.first
        }
    }

    @discardableResult
    func deleteProtectedEvidence(blobId: String) throws -> Bool {
        try locked {
            try execute(
                "UPDATE protected_evidence SET deletion_state = 'deleted', ciphertext = NULL WHERE blob_id = ? AND deletion_state != 'deleted'",
                bindings: [.text(blobId)]
            )
            return sqlite3_changes(database) > 0
        }
    }

    func deleteProtectedData(requestId: String) throws -> Bool {
        try locked {
            try transaction {
                try execute(
                    "UPDATE protected_evidence SET deletion_state = 'deleted', ciphertext = NULL, upload_state = 'rejected' WHERE deletion_state != 'deleted'"
                )
                try execute(
                    "INSERT INTO state_revision (kind, revision, payload) VALUES ('deletion', 1, ?) ON CONFLICT(kind) DO UPDATE SET revision = state_revision.revision + 1, payload = excluded.payload",
                    bindings: [.text(requestId)]
                )
                return true
            }
        }
    }

    func measurementConfigurationState() throws -> MeasurementStoredConfigurationState {
        try locked {
            let row = try query(
                "SELECT revision, payload FROM state_revision WHERE kind = 'measurement_configuration'"
            ) { statement in
                MeasurementStoredConfigurationState(
                    version: sqlite3_column_int64(statement, 0),
                    payload: optionalText(statement, 1)?.data(using: .utf8)
                )
            }.first
            return row ?? MeasurementStoredConfigurationState(version: 0, payload: nil)
        }
    }

    @discardableResult
    func persistMeasurementConfiguration(version: Int64, payload: Data) throws -> Bool {
        try locked {
            try execute(
                "INSERT INTO state_revision (kind, revision, payload) VALUES ('measurement_configuration', ?, ?) ON CONFLICT(kind) DO UPDATE SET revision = excluded.revision, payload = excluded.payload WHERE excluded.revision > state_revision.revision",
                bindings: [.int(version), .text(String(decoding: payload, as: UTF8.self))]
            )
            return sqlite3_changes(database) > 0
        }
    }

    func pushRegistrationState() throws -> MeasurementStoredConfigurationState {
        try locked {
            let row = try query(
                "SELECT revision, payload FROM state_revision WHERE kind = 'push_registration'"
            ) { statement in
                MeasurementStoredConfigurationState(
                    version: sqlite3_column_int64(statement, 0),
                    payload: optionalText(statement, 1)?.data(using: .utf8)
                )
            }.first
            return row ?? MeasurementStoredConfigurationState(version: 0, payload: nil)
        }
    }

    @discardableResult
    func persistPushRegistration(payload: Data) throws -> Bool {
        try locked {
            try execute(
                "INSERT INTO state_revision (kind, revision, payload) VALUES ('push_registration', 1, ?) ON CONFLICT(kind) DO UPDATE SET revision = state_revision.revision + 1, payload = excluded.payload",
                bindings: [.text(String(decoding: payload, as: UTF8.self))]
            )
            return sqlite3_changes(database) > 0
        }
    }

    @discardableResult
    func clearPushRegistration() throws -> Bool {
        try locked {
            try execute("DELETE FROM state_revision WHERE kind = 'push_registration'")
            return sqlite3_changes(database) > 0
        }
    }

    func testDeviceState() throws -> Bool {
        try locked {
            try query("SELECT payload FROM state_revision WHERE kind = 'test_device'") {
                optionalText($0, 0) == "true"
            }.first ?? false
        }
    }

    @discardableResult
    func persistTestDeviceState(_ enabled: Bool) throws -> Bool {
        try locked {
            try execute(
                "INSERT INTO state_revision (kind, revision, payload) VALUES ('test_device', 1, ?) ON CONFLICT(kind) DO UPDATE SET payload = excluded.payload",
                bindings: [.text(enabled ? "true" : "false")]
            )
            return sqlite3_changes(database) > 0
        }
    }

    func applyStorageLimits(
        maxOutboxRecords: Int64,
        maxOutboxBytes: Int64,
        maxProtectedBytes: Int64
    ) throws {
        try locked {
            guard maxOutboxRecords > 0, maxOutboxBytes > 0, maxProtectedBytes > 0 else {
                throw failure("MEASUREMENT_INVALID_STORAGE_LIMITS")
            }
            self.maxOutboxRecords = maxOutboxRecords
            self.maxOutboxBytes = maxOutboxBytes
            self.maxProtectedBytes = maxProtectedBytes
            try evictFor(additionalBytes: 0)
        }
    }

    func getProtectedUpload(blobId: String) throws -> MeasurementStoredProtectedUpload? {
        try locked {
            try query(
                "SELECT purpose, consent_revision, retention_class, encryption_key_version, deletion_state, ciphertext, upload_state, upload_attempt_count, upload_eligible_at_ms FROM protected_evidence WHERE blob_id = ?",
                bindings: [.text(blobId)]
            ) { statement in
                MeasurementStoredProtectedUpload(
                    blobId: blobId,
                    purpose: text(statement, 0),
                    consentRevision: sqlite3_column_int64(statement, 1),
                    retentionClass: text(statement, 2),
                    encryptionKeyVersion: Int(sqlite3_column_int(statement, 3)),
                    deletionState: text(statement, 4),
                    ciphertext: sqlite3_column_type(statement, 5) == SQLITE_NULL ? nil : blob(statement, 5),
                    uploadState: text(statement, 6),
                    attemptCount: Int(sqlite3_column_int(statement, 7)),
                    eligibleAtMs: sqlite3_column_int64(statement, 8)
                )
            }.first
        }
    }

    @discardableResult
    func acknowledgeProtectedUpload(blobId: String) throws -> Bool {
        try locked {
            try execute(
                "UPDATE protected_evidence SET upload_state = 'acknowledged' WHERE blob_id = ? AND upload_state != 'acknowledged'",
                bindings: [.text(blobId)]
            )
            return sqlite3_changes(database) > 0
        }
    }

    @discardableResult
    func scheduleProtectedUpload(blobId: String, eligibleAtMs: Int64) throws -> Bool {
        try locked {
            try execute(
                "UPDATE protected_evidence SET upload_attempt_count = upload_attempt_count + 1, upload_eligible_at_ms = ? WHERE blob_id = ? AND upload_state = 'pending'",
                bindings: [.int(eligibleAtMs), .text(blobId)]
            )
            return sqlite3_changes(database) > 0
        }
    }

    @discardableResult
    func rejectProtectedUpload(blobId: String) throws -> Bool {
        try locked {
            try execute(
                "UPDATE protected_evidence SET upload_state = 'rejected' WHERE blob_id = ? AND upload_state = 'pending'",
                bindings: [.text(blobId)]
            )
            return sqlite3_changes(database) > 0
        }
    }

    func rotateProtectedEvidenceKey(to version: Int) throws -> Int {
        try locked {
            guard version > 0 else { throw failure("MEASUREMENT_INVALID_KEY_VERSION") }
            let rows = try query(
                "SELECT blob_id, encryption_key_version, ciphertext FROM protected_evidence WHERE deletion_state = 'active'"
            ) { statement in
                (
                    text(statement, 0),
                    Int(sqlite3_column_int(statement, 1)),
                    blob(statement, 2)
                )
            }
            try transaction {
                for (blobId, oldVersion, ciphertext) in rows {
                    let plaintext = try crypto.decrypt(ciphertext, version: oldVersion)
                    try execute(
                        "UPDATE protected_evidence SET encryption_key_version = ?, ciphertext = ? WHERE blob_id = ?",
                        bindings: [.int(Int64(version)), .blob(try crypto.encrypt(plaintext, version: version)), .text(blobId)]
                    )
                }
            }
            crypto.currentVersion = version
            return rows.count
        }
    }

    func checkAndSetDedupe(namespace: String, key: String, expiresAtMs: Int64) throws -> Bool {
        try locked {
            try execute(
                "DELETE FROM dedupe WHERE expires_at_ms <= ?",
                bindings: [.int(Int64(Date().timeIntervalSince1970 * 1_000))]
            )
            try execute(
                "INSERT OR IGNORE INTO dedupe (namespace, dedupe_key, created_at_ms, expires_at_ms) VALUES (?, ?, ?, ?)",
                bindings: [
                    .text(namespace), .text(key), .int(Int64(Date().timeIntervalSince1970 * 1_000)),
                    .int(expiresAtMs),
                ]
            )
            let inserted = sqlite3_changes(database) > 0
            try trim(table: "dedupe", maximum: maxDedupeRecords, orderBy: "created_at_ms")
            return inserted
        }
    }

    func hasDedupe(namespace: String, key: String) throws -> Bool {
        try locked {
            try execute(
                "DELETE FROM dedupe WHERE expires_at_ms <= ?",
                bindings: [.int(Int64(Date().timeIntervalSince1970 * 1_000))]
            )
            return try scalarInt64(
                "SELECT 1 FROM dedupe WHERE namespace = ? AND dedupe_key = ? LIMIT 1",
                bindings: [.text(namespace), .text(key)]
            ) != nil
        }
    }

    func appendInbox(
        id: String,
        kind: String,
        source: String,
        appState: String,
        receivedAt: String,
        protectedPayloadRef: String
    ) throws -> Bool {
        try locked {
            try execute(
                "INSERT OR IGNORE INTO inbox (entry_id, kind, source, app_state, received_at, protected_payload_ref, acknowledged) VALUES (?, ?, ?, ?, ?, ?, 0)",
                bindings: [
                    .text(id), .text(kind), .text(source), .text(appState), .text(receivedAt),
                    .text(protectedPayloadRef),
                ]
            )
            let inserted = sqlite3_changes(database) > 0
            try trim(table: "inbox", maximum: maxInboxRecords, orderBy: "rowid", where: "acknowledged = 1")
            return inserted
        }
    }

    func peekInbox(limit: Int) throws -> [MeasurementStoredInboxEntry] {
        try locked {
            try query(
                "SELECT entry_id, kind, source, app_state, received_at, protected_payload_ref FROM inbox WHERE acknowledged = 0 ORDER BY rowid ASC LIMIT ?",
                bindings: [.int(Int64(max(0, limit)))]
            ) { statement in
                MeasurementStoredInboxEntry(
                    id: text(statement, 0),
                    kind: text(statement, 1),
                    source: text(statement, 2),
                    appState: text(statement, 3),
                    receivedAt: text(statement, 4),
                    protectedPayloadRef: text(statement, 5)
                )
            }
        }
    }

    @discardableResult
    func acknowledgeInbox(id: String) throws -> Bool {
        try locked {
            try execute(
                "UPDATE inbox SET acknowledged = 1 WHERE entry_id = ? AND acknowledged = 0",
                bindings: [.text(id)]
            )
            return sqlite3_changes(database) > 0
        }
    }

    private func migrate() throws {
        let version = Int(try scalarInt64("PRAGMA user_version") ?? 0)
        if version < 1 {
            try transaction {
                try execute("CREATE TABLE IF NOT EXISTS installation (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), installation_id TEXT NOT NULL, first_opened_at TEXT NOT NULL, sequence INTEGER NOT NULL DEFAULT 0, first_release TEXT, last_release TEXT)")
                try execute("CREATE TABLE IF NOT EXISTS session (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), session_id TEXT, sequence INTEGER NOT NULL DEFAULT 0, started_at TEXT, last_foreground_monotonic_ms INTEGER, last_background_monotonic_ms INTEGER)")
                try execute("CREATE TABLE IF NOT EXISTS state_revision (kind TEXT PRIMARY KEY, revision INTEGER NOT NULL, payload TEXT)")
                try execute("CREATE TABLE IF NOT EXISTS outbox (record_id TEXT PRIMARY KEY, record_type TEXT NOT NULL, installation_sequence INTEGER NOT NULL, occurred_at TEXT NOT NULL, queued_at_ms INTEGER NOT NULL, priority TEXT NOT NULL, source TEXT NOT NULL, public_payload TEXT NOT NULL, public_payload_bytes INTEGER NOT NULL, protected_payload_ref TEXT, attempt_count INTEGER NOT NULL DEFAULT 0, eligible_at_ms INTEGER NOT NULL, acknowledgement_state TEXT NOT NULL DEFAULT 'pending')")
                try execute("CREATE INDEX IF NOT EXISTS outbox_eligible_idx ON outbox (acknowledgement_state, priority, eligible_at_ms, installation_sequence)")
                try execute("CREATE TABLE IF NOT EXISTS protected_evidence (blob_id TEXT PRIMARY KEY, purpose TEXT NOT NULL, consent_revision INTEGER NOT NULL, retention_class TEXT NOT NULL, encryption_key_version INTEGER NOT NULL, deletion_state TEXT NOT NULL, ciphertext BLOB, created_at_ms INTEGER NOT NULL)")
                try execute("CREATE TABLE IF NOT EXISTS dedupe (namespace TEXT NOT NULL, dedupe_key TEXT NOT NULL, created_at_ms INTEGER NOT NULL, expires_at_ms INTEGER NOT NULL, PRIMARY KEY (namespace, dedupe_key))")
                try execute("PRAGMA user_version = 1")
            }
        }
        if version < 2 {
            try transaction {
                try execute("CREATE TABLE IF NOT EXISTS inbox (entry_id TEXT PRIMARY KEY, kind TEXT NOT NULL, source TEXT NOT NULL, app_state TEXT NOT NULL, received_at TEXT NOT NULL, protected_payload_ref TEXT NOT NULL, acknowledged INTEGER NOT NULL DEFAULT 0)")
                try execute("CREATE TABLE IF NOT EXISTS delivery_diagnostic (diagnostic_id TEXT PRIMARY KEY, record_id TEXT NOT NULL, outcome TEXT NOT NULL, reason TEXT NOT NULL, occurred_at_ms INTEGER NOT NULL)")
                try execute("PRAGMA user_version = 2")
            }
        }
        if version < 3 {
            try transaction {
                try execute("ALTER TABLE protected_evidence ADD COLUMN upload_state TEXT NOT NULL DEFAULT 'pending'")
                try execute("ALTER TABLE protected_evidence ADD COLUMN upload_attempt_count INTEGER NOT NULL DEFAULT 0")
                try execute("ALTER TABLE protected_evidence ADD COLUMN upload_eligible_at_ms INTEGER NOT NULL DEFAULT 0")
                try execute("CREATE INDEX IF NOT EXISTS protected_evidence_upload_idx ON protected_evidence (upload_state, upload_eligible_at_ms)")
                try execute("PRAGMA user_version = 3")
            }
        }
    }

    private func ensureInstallation() throws {
        try execute(
            "INSERT OR IGNORE INTO installation (singleton, installation_id, first_opened_at, sequence) VALUES (1, ?, ?, 0)",
            bindings: [
                .text("install_\(UUID().uuidString.lowercased())"),
                .text(ISO8601DateFormatter().string(from: Date())),
            ]
        )
    }

    private func evictFor(additionalBytes: Int64) throws {
        while try isOutboxOverBound(additionalBytes: additionalBytes) {
            let candidate = try scalarText(
                """
                SELECT record_id FROM outbox
                WHERE acknowledgement_state = 'pending'
                  AND priority IN ('low', 'normal')
                  AND record_type NOT LIKE 'installation.%'
                  AND record_type NOT LIKE 'consent.%'
                  AND record_type NOT LIKE 'link.%'
                  AND record_type NOT LIKE 'referrer.%'
                  AND record_type NOT LIKE 'purchase.%'
                ORDER BY CASE priority WHEN 'low' THEN 0 ELSE 1 END, installation_sequence ASC LIMIT 1
                """
            )
            guard let candidate else { throw failure("MEASUREMENT_OUTBOX_PROTECTED_BOUND") }
            try writeDiagnostic(recordId: candidate, outcome: "evicted", reason: "storage_bound")
            try execute("DELETE FROM outbox WHERE record_id = ?", bindings: [.text(candidate)])
        }
    }

    private func isOutboxOverBound(additionalBytes: Int64) throws -> Bool {
        let count = try scalarInt64(
            "SELECT COUNT(*) FROM outbox WHERE acknowledgement_state = 'pending'"
        ) ?? 0
        let bytes = try scalarInt64(
            "SELECT COALESCE(SUM(public_payload_bytes), 0) FROM outbox WHERE acknowledgement_state = 'pending'"
        ) ?? 0
        return count >= maxOutboxRecords || bytes + additionalBytes > maxOutboxBytes
    }

    private func writeDiagnostic(recordId: String, outcome: String, reason: String) throws {
        try execute(
            "INSERT INTO delivery_diagnostic (diagnostic_id, record_id, outcome, reason, occurred_at_ms) VALUES (?, ?, ?, ?, ?)",
            bindings: [
                .text("diag_\(UUID().uuidString.lowercased())"), .text(recordId), .text(outcome),
                .text(String(reason.prefix(128))), .int(Int64(Date().timeIntervalSince1970 * 1_000)),
            ]
        )
    }

    private func trim(table: String, maximum: Int64, orderBy: String, where predicate: String? = nil) throws {
        let clause = predicate.map { " WHERE \($0)" } ?? ""
        let count = try scalarInt64("SELECT COUNT(*) FROM \(table)\(clause)") ?? 0
        guard count > maximum else { return }
        try execute(
            "DELETE FROM \(table) WHERE rowid IN (SELECT rowid FROM \(table)\(clause) ORDER BY \(orderBy) ASC LIMIT ?)",
            bindings: [.int(count - maximum)]
        )
    }

    private func transaction<T>(_ operation: () throws -> T) throws -> T {
        try execute("BEGIN IMMEDIATE TRANSACTION")
        do {
            let result = try operation()
            try execute("COMMIT")
            return result
        } catch {
            try? execute("ROLLBACK")
            throw error
        }
    }

    private func locked<T>(_ operation: () throws -> T) rethrows -> T {
        lock.lock()
        defer { lock.unlock() }
        return try operation()
    }

    private func execute(_ sql: String, bindings: [SQLiteBinding] = []) throws {
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(database, sql, -1, &statement, nil) == SQLITE_OK else {
            throw failure("MEASUREMENT_STORE_PREPARE_FAILED")
        }
        defer { sqlite3_finalize(statement) }
        try bind(bindings, to: statement)
        guard sqlite3_step(statement) == SQLITE_DONE || sql.hasPrefix("PRAGMA journal_mode") else {
            throw failure("MEASUREMENT_STORE_EXECUTE_FAILED")
        }
    }

    private func query<T>(
        _ sql: String,
        bindings: [SQLiteBinding] = [],
        row: (OpaquePointer) throws -> T
    ) throws -> [T] {
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(database, sql, -1, &statement, nil) == SQLITE_OK,
              let statement else { throw failure("MEASUREMENT_STORE_PREPARE_FAILED") }
        defer { sqlite3_finalize(statement) }
        try bind(bindings, to: statement)
        var rows: [T] = []
        while sqlite3_step(statement) == SQLITE_ROW {
            rows.append(try row(statement))
        }
        return rows
    }

    private func bind(_ bindings: [SQLiteBinding], to statement: OpaquePointer?) throws {
        for (offset, binding) in bindings.enumerated() {
            let index = Int32(offset + 1)
            let status: Int32
            switch binding {
            case .text(let value):
                status = sqlite3_bind_text(statement, index, value, -1, SQLITE_TRANSIENT)
            case .int(let value):
                status = sqlite3_bind_int64(statement, index, value)
            case .blob(let value):
                status = value.withUnsafeBytes { pointer in
                    sqlite3_bind_blob(statement, index, pointer.baseAddress, Int32(value.count), SQLITE_TRANSIENT)
                }
            case .null:
                status = sqlite3_bind_null(statement, index)
            }
            guard status == SQLITE_OK else { throw failure("MEASUREMENT_STORE_BIND_FAILED") }
        }
    }

    private func scalarInt64(_ sql: String, bindings: [SQLiteBinding] = []) throws -> Int64? {
        try query(sql, bindings: bindings) { statement -> Int64? in
            sqlite3_column_type(statement, 0) == SQLITE_NULL ? nil : sqlite3_column_int64(statement, 0)
        }.first ?? nil
    }

    private func scalarText(_ sql: String, bindings: [SQLiteBinding] = []) throws -> String? {
        try query(sql, bindings: bindings) { statement -> String? in optionalText(statement, 0) }.first ?? nil
    }

    private func failure(_ fallback: String) -> NSError {
        let message = database.flatMap(sqlite3_errmsg).map(String.init(cString:)) ?? fallback
        return NSError(domain: "com.voidhash.measurement.store", code: Int(sqlite3_errcode(database)), userInfo: [NSLocalizedDescriptionKey: message])
    }
}

private enum SQLiteBinding {
    case text(String)
    case int(Int64)
    case blob(Data)
    case null
}

private func text(_ statement: OpaquePointer, _ index: Int32) -> String {
    guard let value = sqlite3_column_text(statement, index) else { return "" }
    return String(cString: value)
}

private func optionalText(_ statement: OpaquePointer, _ index: Int32) -> String? {
    sqlite3_column_type(statement, index) == SQLITE_NULL ? nil : text(statement, index)
}

private func blob(_ statement: OpaquePointer, _ index: Int32) -> Data {
    guard let bytes = sqlite3_column_blob(statement, index) else { return Data() }
    return Data(bytes: bytes, count: Int(sqlite3_column_bytes(statement, index)))
}

private let SQLITE_TRANSIENT = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

private final class MeasurementVaultCrypto {
    var currentVersion = 1

    func encrypt(_ value: Data, version: Int) throws -> Data {
        let sealed = try AES.GCM.seal(value, using: try key(version: version))
        guard let combined = sealed.combined else {
            throw NSError(domain: "com.voidhash.measurement.crypto", code: 1)
        }
        return combined
    }

    func decrypt(_ value: Data, version: Int) throws -> Data {
        try AES.GCM.open(AES.GCM.SealedBox(combined: value), using: try key(version: version))
    }

    private func key(version: Int) throws -> SymmetricKey {
        let account = "voidhash-measurement-vault-v\(version)"
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "com.voidhash.measurement",
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecSuccess, let data = result as? Data {
            return SymmetricKey(data: data)
        }
        guard status == errSecItemNotFound else {
            throw NSError(domain: NSOSStatusErrorDomain, code: Int(status))
        }
        let data = SymmetricKey(size: .bits256).withUnsafeBytes { Data($0) }
        let insert: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "com.voidhash.measurement",
            kSecAttrAccount as String: account,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
            kSecValueData as String: data,
        ]
        let insertStatus = SecItemAdd(insert as CFDictionary, nil)
        guard insertStatus == errSecSuccess || insertStatus == errSecDuplicateItem else {
            throw NSError(domain: NSOSStatusErrorDomain, code: Int(insertStatus))
        }
        return SymmetricKey(data: data)
    }
}
