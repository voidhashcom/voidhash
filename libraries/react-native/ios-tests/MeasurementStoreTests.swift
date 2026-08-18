import Foundation
import SQLite3
import XCTest
@testable import VoidhashPurchaseCoordinators

private final class LockedSequences: @unchecked Sendable {
    private let lock = NSLock()
    private var values: [Int64] = []

    func append(_ value: Int64) {
        lock.lock()
        values.append(value)
        lock.unlock()
    }

    func snapshot() -> [Int64] {
        lock.lock()
        defer { lock.unlock() }
        return values
    }
}

final class MeasurementStoreTests: XCTestCase {
    private func temporaryDatabase() throws -> (URL, MeasurementStore) {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("voidhash-measurement-tests-(UUID().uuidString)", isDirectory: true)
        let url = directory.appendingPathComponent("measurement.sqlite")
        return (directory, try MeasurementStore(databaseURL: url))
    }

    func testSequenceOrderingAndIdempotentAcknowledgement() throws {
        let (directory, store) = try temporaryDatabase()
        defer { try? FileManager.default.removeItem(at: directory) }
        let second = try store.enqueue(
            recordId: "normal", recordType: "analytics.capture.v1", occurredAt: "2026-01-01T00:00:00Z",
            priority: "normal", source: "javascript", publicPayload: "{}", protectedPayloadRef: nil
        )
        let first = try store.enqueue(
            recordId: "critical", recordType: "consent.changed.v1", occurredAt: "2026-01-01T00:00:01Z",
            priority: "critical", source: "javascript", publicPayload: "{}", protectedPayloadRef: nil
        )
        XCTAssertEqual([second, first], [1, 2])
        XCTAssertEqual(try store.peekEligible(limit: 10).map(\.recordId), ["critical", "normal"])
        XCTAssertTrue(try store.acknowledge(recordId: "critical"))
        XCTAssertFalse(try store.acknowledge(recordId: "critical"))
        XCTAssertEqual(try store.peekEligible(limit: 10).map(\.recordId), ["normal"])
    }

    func testConcurrentAllocationIsUniqueAndAtomic() throws {
        let (directory, store) = try temporaryDatabase()
        defer { try? FileManager.default.removeItem(at: directory) }
        let sequences = LockedSequences()
        DispatchQueue.concurrentPerform(iterations: 100) { index in
            let sequence = try! store.enqueue(
                recordId: "record-\(index)", recordType: "analytics.capture.v1",
                occurredAt: "2026-01-01T00:00:00Z", priority: "normal", source: "javascript",
                publicPayload: "{\"index\":\(index)}", protectedPayloadRef: nil
            )
            sequences.append(sequence)
        }
        XCTAssertEqual(Set(sequences.snapshot()).count, 100)
        XCTAssertEqual(try store.peekEligible(limit: 200).count, 100)
    }

    func testProtectedEvidenceIsEncryptedAndRotates() throws {
        let (directory, store) = try temporaryDatabase()
        defer { try? FileManager.default.removeItem(at: directory) }
        let secret = Data("raw-secret-value".utf8)
        let id = try store.putProtectedEvidence(
            blobId: "blob-1", purpose: "purchase-receipt", consentRevision: 3,
            retentionClass: "transaction", value: secret
        )
        XCTAssertEqual(try store.getProtectedEvidence(blobId: id)?.value, secret)
        XCTAssertFalse((try Data(contentsOf: store.databaseURL)).contains(secret))
        XCTAssertEqual(try store.rotateProtectedEvidenceKey(to: 2), 1)
        let rotated = try store.getProtectedEvidence(blobId: id)
        XCTAssertEqual(rotated?.value, secret)
        XCTAssertEqual(rotated?.encryptionKeyVersion, 2)
        let upload = try store.getProtectedUpload(blobId: id)
        XCTAssertEqual(upload?.uploadState, "pending")
        XCTAssertNotEqual(upload?.ciphertext, secret)
        XCTAssertTrue(try store.acknowledgeProtectedUpload(blobId: id))
        XCTAssertEqual(try store.getProtectedUpload(blobId: id)?.uploadState, "acknowledged")
    }

    func testDedupeAndInboxAreDurableAndIdempotent() throws {
        let (directory, store) = try temporaryDatabase()
        defer { try? FileManager.default.removeItem(at: directory) }
        XCTAssertTrue(try store.checkAndSetDedupe(namespace: "transaction", key: "tx-1", expiresAtMs: .max))
        XCTAssertFalse(try store.checkAndSetDedupe(namespace: "transaction", key: "tx-1", expiresAtMs: .max))
        XCTAssertTrue(try store.appendInbox(
            id: "inbox-1", kind: "link", source: "universalLink", appState: "cold",
            receivedAt: "2026-01-01T00:00:00Z", protectedPayloadRef: "blob-1"
        ))
        XCTAssertFalse(try store.appendInbox(
            id: "inbox-1", kind: "link", source: "universalLink", appState: "cold",
            receivedAt: "2026-01-01T00:00:00Z", protectedPayloadRef: "blob-1"
        ))
        XCTAssertEqual(try store.peekInbox(limit: 10).map(\.id), ["inbox-1"])
        XCTAssertTrue(try store.acknowledgeInbox(id: "inbox-1"))
        XCTAssertFalse(try store.acknowledgeInbox(id: "inbox-1"))
        XCTAssertTrue(try store.peekInbox(limit: 10).isEmpty)
    }

    func testProtectedDeletionPurgesValuesAndPersistsMarkerAtomically() throws {
        let (directory, store) = try temporaryDatabase()
        defer { try? FileManager.default.removeItem(at: directory) }
        _ = try store.putProtectedEvidence(
            blobId: "blob-delete", purpose: "email", consentRevision: 4,
            retentionClass: "installation", value: Data("protected@example.com".utf8)
        )
        XCTAssertTrue(try store.deleteProtectedData(requestId: "delete-1"))
        XCTAssertNil(try? store.getProtectedEvidence(blobId: "blob-delete"))

        var database: OpaquePointer?
        XCTAssertEqual(sqlite3_open_v2(store.databaseURL.path, &database, SQLITE_OPEN_READONLY, nil), SQLITE_OK)
        defer { sqlite3_close(database) }
        var statement: OpaquePointer?
        XCTAssertEqual(
            sqlite3_prepare_v2(database, "SELECT payload FROM state_revision WHERE kind = 'deletion'", -1, &statement, nil),
            SQLITE_OK
        )
        defer { sqlite3_finalize(statement) }
        XCTAssertEqual(sqlite3_step(statement), SQLITE_ROW)
        XCTAssertEqual(String(cString: sqlite3_column_text(statement, 0)), "delete-1")
    }

    func testPriorityEvictionRetainsProtectedRecordClasses() throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("voidhash-measurement-tests-(UUID().uuidString)", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = try MeasurementStore(
            maxOutboxRecords: 3,
            databaseURL: directory.appendingPathComponent("measurement.sqlite")
        )
        for (id, type, priority) in [
            ("install", "installation.created.v1", "critical"),
            ("consent", "consent.changed.v1", "critical"),
            ("analytics", "analytics.capture.v1", "low"),
            ("link", "link.received.v1", "high"),
        ] {
            _ = try store.enqueue(
                recordId: id, recordType: type, occurredAt: "2026-01-01T00:00:00Z",
                priority: priority, source: "native", publicPayload: "{}", protectedPayloadRef: nil
            )
        }
        XCTAssertEqual(Set(try store.peekEligible(limit: 10).map(\.recordId)), ["install", "consent", "link"])
    }

    func testSignedConfigurationVersionAndPayloadSurviveRestart() throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("voidhash-measurement-tests-(UUID().uuidString)", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let url = directory.appendingPathComponent("measurement.sqlite")
        let payload = Data("{\"keyId\":\"rotation-2\"}".utf8)
        do {
            let store = try MeasurementStore(databaseURL: url)
            XCTAssertTrue(try store.persistMeasurementConfiguration(version: 4, payload: payload))
            XCTAssertFalse(try store.persistMeasurementConfiguration(version: 3, payload: Data("{}".utf8)))
        }
        let reopened = try MeasurementStore(databaseURL: url)
        XCTAssertEqual(try reopened.measurementConfigurationState().version, 4)
        XCTAssertEqual(try reopened.measurementConfigurationState().payload, payload)
    }

    func testRemoteStorageLimitsApplyToExistingStore() throws {
        let (directory, store) = try temporaryDatabase()
        defer { try? FileManager.default.removeItem(at: directory) }
        try store.applyStorageLimits(
            maxOutboxRecords: 2,
            maxOutboxBytes: 1_000_000,
            maxProtectedBytes: 1_000_000
        )
        for index in 0 ..< 3 {
            _ = try store.enqueue(
                recordId: "analytics-\(index)", recordType: "analytics.capture.v1",
                occurredAt: "2026-01-01T00:00:00Z", priority: "low", source: "javascript",
                publicPayload: "{}", protectedPayloadRef: nil
            )
        }
        XCTAssertEqual(try store.peekEligible(limit: 10).map(\.recordId), ["analytics-1", "analytics-2"])
    }

    func testOpaquePushRegistrationPersistsAndClears() throws {
        let (directory, store) = try temporaryDatabase()
        defer { try? FileManager.default.removeItem(at: directory) }
        let payload = Data("{\"pushDeviceTokenId\":\"push_tok_1\"}".utf8)
        XCTAssertTrue(try store.persistPushRegistration(payload: payload))
        XCTAssertEqual(try store.pushRegistrationState().payload, payload)
        XCTAssertTrue(try store.clearPushRegistration())
        XCTAssertNil(try store.pushRegistrationState().payload)
        XCTAssertFalse(try store.clearPushRegistration())
    }
}
