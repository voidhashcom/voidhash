import Foundation
import XCTest
@testable import VoidhashPurchaseCoordinators

final class LinkCollectorTests: XCTestCase {
    func testLinksAreEncryptedOrderedAndDuplicateCallbacksAreSuppressed() throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let database = directory.appendingPathComponent("measurement.sqlite")
        let store = try MeasurementStore(databaseURL: database)
        let now = Date()

        XCTAssertTrue(try VoidhashLinkCollector.capture(
            store: store,
            raw: "https://links.example/one?secret=value",
            source: "universalLink",
            appState: "cold",
            now: now
        ))
        XCTAssertFalse(try VoidhashLinkCollector.capture(
            store: store,
            raw: "https://links.example/one?secret=value",
            source: "universalLink",
            appState: "cold",
            now: now.addingTimeInterval(0.001)
        ))
        XCTAssertTrue(try VoidhashLinkCollector.capture(
            store: store,
            raw: "voidhash://open/two",
            source: "customScheme",
            appState: "foreground",
            now: now.addingTimeInterval(0.002)
        ))

        let entries = try store.peekInbox(limit: 10)
        XCTAssertEqual(entries.map(\.source), ["universalLink", "customScheme"])
        XCTAssertEqual(
            String(data: try XCTUnwrap(store.getProtectedEvidence(blobId: entries[0].protectedPayloadRef)?.value), encoding: .utf8),
            "https://links.example/one?secret=value"
        )
        XCTAssertFalse(String(decoding: try Data(contentsOf: database), as: UTF8.self).contains("secret=value"))
    }
}
