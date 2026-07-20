import Foundation
import XCTest
@testable import VoidhashPurchaseCoordinators

private final class LockedURLHandler: @unchecked Sendable {
    typealias Handler = @Sendable (URLRequest) throws -> (Int, [String: String], Data)
    private let lock = NSLock()
    private var handler: Handler?

    func set(_ value: @escaping Handler) {
        lock.lock()
        handler = value
        lock.unlock()
    }

    func get() -> Handler? {
        lock.lock()
        defer { lock.unlock() }
        return handler
    }
}

private final class MeasurementURLProtocol: URLProtocol {
    static let state = LockedURLHandler()

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        do {
            guard let handler = Self.state.get(), let url = request.url else { throw URLError(.badURL) }
            let (status, headers, data) = try handler(request)
            let response = HTTPURLResponse(url: url, statusCode: status, httpVersion: "HTTP/1.1", headerFields: headers)!
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}

private func requestBody(_ request: URLRequest) -> Data? {
    if let body = request.httpBody { return body }
    guard let stream = request.httpBodyStream else { return nil }
    stream.open()
    defer { stream.close() }
    var result = Data()
    var buffer = [UInt8](repeating: 0, count: 4_096)
    while true {
        let count = stream.read(&buffer, maxLength: buffer.count)
        if count <= 0 { break }
        result.append(buffer, count: count)
    }
    return result
}

final class MeasurementDeliveryTests: XCTestCase {
    private func fixture() throws -> (URL, MeasurementStore, URLSession) {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("voidhash-delivery-tests-\(UUID().uuidString)", isDirectory: true)
        let store = try MeasurementStore(databaseURL: directory.appendingPathComponent("measurement.sqlite"))
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [MeasurementURLProtocol.self]
        return (directory, store, URLSession(configuration: configuration))
    }

    private func enqueue(_ ids: [String], store: MeasurementStore) throws {
        for id in ids {
            _ = try store.enqueue(
                recordId: id,
                recordType: "analytics.capture.v1",
                occurredAt: "2026-01-01T00:00:00.000Z",
                priority: "normal",
                source: "javascript",
                publicPayload: "{\"installationId\":\"install-1\",\"identity\":{\"distinctId\":\"person-1\"},\"consent\":{\"revision\":1},\"publicPayload\":{}}",
                protectedPayloadRef: nil
            )
        }
    }

    func testPayloadTooLargeRecursivelySplitsAndQuarantinesOnlyTheOversizedRecord() async throws {
        let (directory, store, session) = try fixture()
        defer { try? FileManager.default.removeItem(at: directory) }
        try enqueue(["accepted-1", "oversized", "accepted-2"], store: store)
        MeasurementURLProtocol.state.set { request in
            let body = try XCTUnwrap(requestBody(request))
            let object = try XCTUnwrap(JSONSerialization.jsonObject(with: body) as? [String: Any])
            let events = try XCTUnwrap(object["events"] as? [[String: Any]])
            let ids = events.compactMap { $0["uuid"] as? String }
            if ids.count > 1 || ids == ["oversized"] { return (413, [:], Data()) }
            return (200, [:], try JSONSerialization.data(withJSONObject: ["accepted": ids, "rejected": []]))
        }
        let result = await MeasurementDelivery(
            store: store,
            publishableKey: "pk_test",
            ingestOrigin: URL(string: "https://ingest.example")!,
            session: session
        ).flush()
        XCTAssertEqual(result.accepted, 2)
        XCTAssertEqual(result.quarantined, 1)
        XCTAssertEqual(result.scheduled, 0)
        XCTAssertTrue(try store.peekEligible(limit: 10).isEmpty)
    }

    func testRateLimitHonorsRetryAfterAndDoesNotAcknowledge() async throws {
        let (directory, store, session) = try fixture()
        defer { try? FileManager.default.removeItem(at: directory) }
        try enqueue(["retry-me"], store: store)
        MeasurementURLProtocol.state.set { _ in (429, ["retry-after": "120"], Data()) }
        let result = await MeasurementDelivery(
            store: store,
            publishableKey: "pk_test",
            ingestOrigin: URL(string: "https://ingest.example")!,
            session: session
        ).flush()
        XCTAssertEqual(result.scheduled, 1)
        XCTAssertEqual(result.accepted, 0)
        XCTAssertTrue(try store.peekEligible(limit: 10).isEmpty)
    }

    func testPartialAcknowledgementQuarantinesRejectedAndSchedulesMissingRecords() async throws {
        let (directory, store, session) = try fixture()
        defer { try? FileManager.default.removeItem(at: directory) }
        try enqueue(["accepted", "rejected", "missing"], store: store)
        MeasurementURLProtocol.state.set { _ in
            let response: [String: Any] = [
                "accepted": ["accepted"],
                "rejected": [["recordId": "rejected", "reason": "invalid_record"]],
            ]
            return (200, [:], try JSONSerialization.data(withJSONObject: response))
        }
        let result = await MeasurementDelivery(
            store: store,
            publishableKey: "pk_test",
            ingestOrigin: URL(string: "https://ingest.example")!,
            session: session
        ).flush()
        XCTAssertEqual(result.accepted, 1)
        XCTAssertEqual(result.quarantined, 1)
        XCTAssertEqual(result.scheduled, 1)
        XCTAssertTrue(try store.peekEligible(limit: 10).isEmpty)
    }
}
