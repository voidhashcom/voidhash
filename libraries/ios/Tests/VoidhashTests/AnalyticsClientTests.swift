import Foundation
import Testing
import VoidhashCore

@testable import Voidhash

extension StubbedNetworkSuite {
    @Suite("Analytics client")
    struct AnalyticsClientTests {
        private static let ingestUrl = URL(string: "https://ingest.example.com")!

        private func makeClient(
            responses: [StubResponse],
            clock: MutableClock = MutableClock(),
            sleeps: SleepRecorder = SleepRecorder(),
            standardProperties: [String: JSONValue] = [:],
            warnings: WarningRecorder = WarningRecorder()
        ) -> AnalyticsClient {
            return AnalyticsClient(
                publishableKey: "pk_test",
                ingestUrl: AnalyticsClientTests.ingestUrl,
                session: StubURLProtocol.makeSession(responses: responses),
                distinctIdProvider: { "user-123" },
                standardProperties: standardProperties,
                now: { clock.value },
                sleep: { milliseconds in sleeps.record(milliseconds) },
                makeEventId: { "event-id" },
                warn: warnings.handler
            )
        }

        @Test("a flush posts the batch body to the ingest endpoint")
        func flushPostsBatchBody() async throws {
            let client = makeClient(responses: [StubResponse()])
            await client.capture("checkout_started", properties: ["plan": .string("pro")])
            await client.flush()

            let recorded = StubURLProtocol.recordedRequests()
            #expect(recorded.count == 1)
            let request = try #require(recorded.first)
            #expect(request.method == "POST")
            #expect(request.path == "/i/v1/batch")
            // The ingest endpoint authenticates on the body token, not on headers.
            #expect(request.header("x-publishable-key") == nil)

            let body = try #require(request.jsonBody())
            #expect(body["token"] as? String == "pk_test")
            #expect(body["sent_at"] is String)
            let events = try #require(body["events"] as? [[String: Any]])
            #expect(events.count == 1)
            #expect(events[0]["event"] as? String == "checkout_started")
            #expect(events[0]["distinct_id"] as? String == "user-123")
            #expect(events[0]["uuid"] as? String == "event-id")
            #expect(events[0]["context"] as? [String: Any] != nil)
            #expect(events[0]["timestamp"] is String)
            #expect((events[0]["properties"] as? [String: Any])?["plan"] as? String == "pro")
            #expect(await client.queueLength() == 0)
        }

        @Test("events are sent in batches of 20")
        func batchesOfTwenty() async throws {
            let client = makeClient(responses: [StubResponse(), StubResponse()])
            for index in 0..<25 {
                await client.capture("event_\(index)")
            }
            await client.flush()

            let recorded = StubURLProtocol.recordedRequests()
            #expect(recorded.count == 2)
            #expect((recorded[0].jsonBody()?["events"] as? [[String: Any]])?.count == 20)
            #expect((recorded[1].jsonBody()?["events"] as? [[String: Any]])?.count == 5)
        }

        @Test("empty event names are ignored")
        func emptyEventNamesAreIgnored() async throws {
            let client = makeClient(responses: [StubResponse()])
            await client.capture("   ")
            #expect(await client.queueLength() == 0)
        }

        @Test("a retryable failure is retried inline with exponential backoff")
        func retriesRetryableFailures() async throws {
            let sleeps = SleepRecorder()
            let client = makeClient(
                responses: [
                    StubResponse(statusCode: 500), StubResponse(statusCode: 503), StubResponse(),
                ],
                sleeps: sleeps
            )
            await client.capture("event")
            await client.flush()

            #expect(StubURLProtocol.recordedRequests().count == 3)
            #expect(sleeps.values == [1000, 2000])
            #expect(await client.queueLength() == 0)
        }

        @Test("a batch failing every inline attempt is postponed in the queue")
        func exhaustedRetriesArePostponed() async throws {
            let clock = MutableClock()
            let client = makeClient(
                responses: [
                    StubResponse(statusCode: 500), StubResponse(statusCode: 500),
                    StubResponse(statusCode: 500), StubResponse(),
                ],
                clock: clock
            )
            await client.capture("event")
            await client.flush()

            #expect(StubURLProtocol.recordedRequests().count == 3)
            #expect(await client.queueLength() == 1)

            // Still cooling down.
            await client.flush()
            #expect(StubURLProtocol.recordedRequests().count == 3)

            clock.value += 2000
            await client.flush()
            #expect(StubURLProtocol.recordedRequests().count == 4)
            #expect(await client.queueLength() == 0)
        }

        @Test("Retry-After postpones the batch instead of retrying inline")
        func honorsRetryAfter() async throws {
            let clock = MutableClock()
            let sleeps = SleepRecorder()
            let client = makeClient(
                responses: [
                    StubResponse(statusCode: 429, headers: ["retry-after": "30"]), StubResponse(),
                ],
                clock: clock,
                sleeps: sleeps
            )
            await client.capture("event")
            await client.flush()

            #expect(StubURLProtocol.recordedRequests().count == 1)
            #expect(sleeps.values.isEmpty)
            #expect(await client.queueLength() == 1)

            clock.value += 29_000
            await client.flush()
            #expect(StubURLProtocol.recordedRequests().count == 1)

            clock.value += 2000
            await client.flush()
            #expect(StubURLProtocol.recordedRequests().count == 2)
            #expect(await client.queueLength() == 0)
        }

        @Test("a 413 splits the batch in half")
        func splitsBatchOnPayloadTooLarge() async throws {
            let client = makeClient(
                responses: [StubResponse(statusCode: 413), StubResponse(), StubResponse()])
            for index in 0..<4 {
                await client.capture("event_\(index)")
            }
            await client.flush()

            let recorded = StubURLProtocol.recordedRequests()
            #expect(recorded.count == 3)
            #expect(
                recorded.map { ($0.jsonBody()?["events"] as? [[String: Any]])?.count ?? 0 } == [4, 2, 2]
            )
            #expect(await client.queueLength() == 0)
        }

        @Test("a single event rejected with 413 is dropped with a warning")
        func dropsSingleEventOnPayloadTooLarge() async throws {
            let warnings = WarningRecorder()
            let client = makeClient(responses: [StubResponse(statusCode: 413)], warnings: warnings)
            await client.capture("event")
            await client.flush()

            #expect(StubURLProtocol.recordedRequests().count == 1)
            #expect(await client.queueLength() == 0)
            #expect(warnings.contains("413"))
        }

        @Test("a non-retryable failure drops the batch with a warning")
        func dropsNonRetryableFailures() async throws {
            let warnings = WarningRecorder()
            let client = makeClient(responses: [StubResponse(statusCode: 401)], warnings: warnings)
            await client.capture("event")
            await client.flush()

            #expect(StubURLProtocol.recordedRequests().count == 1)
            #expect(await client.queueLength() == 0)
            // The warning is not gated behind `debug`: the TypeScript SDK logs it unconditionally.
            #expect(warnings.contains("non-retryable response: 401"))
        }

        @Test("the standardized properties are merged over every event's own")
        func mergesStandardizedProperties() async throws {
            let client = makeClient(
                responses: [StubResponse()],
                standardProperties: [
                    "$platform": .string("ios"), "$sdk_version": .string("0.0.1-alpha.1"),
                ]
            )
            await client.capture(
                "checkout_started",
                properties: ["plan": .string("pro"), "$platform": .string("spoofed")]
            )
            await client.flush()

            let body = try #require(StubURLProtocol.recordedRequests().first?.jsonBody())
            let events = try #require(body["events"] as? [[String: Any]])
            let properties = try #require(events[0]["properties"] as? [String: Any])
            #expect(properties["plan"] as? String == "pro")
            #expect(properties["$platform"] as? String == "ios")
            #expect(properties["$sdk_version"] as? String == "0.0.1-alpha.1")
        }

        @Test("the standardized properties mirror the TypeScript key set")
        func standardPropertiesKeySet() {
            let properties = AnalyticsClient.standardProperties(
                device: SdkDeviceInfo(
                    bundleId: "com.example.app",
                    appBuild: "42",
                    appName: "Example",
                    appVersion: "1.2.3",
                    systemVersion: "17.0",
                    deviceBrand: "Apple",
                    deviceName: "iPhone15,2",
                    locales: ["de-DE", "en-US"]
                ),
                sdkVersion: "0.0.1-alpha.1"
            )

            #expect(
                properties.keys.sorted() == [
                    "$app_build", "$app_name", "$app_version", "$bundle_id", "$device_brand",
                    "$device_name", "$locale", "$platform", "$platform_version", "$sdk",
                    "$sdk_version",
                ])
            #expect(properties["$app_build"] == .string("42"))
            #expect(properties["$app_name"] == .string("Example"))
            #expect(properties["$bundle_id"] == .string("com.example.app"))
            #expect(properties["$device_name"] == .string("iPhone15,2"))
            #expect(properties["$locale"] == .string("de-DE"))
            #expect(properties["$platform"] == .string("ios"))
            #expect(properties["$platform_version"] == .string("17.0"))
            #expect(properties["$sdk"] == .string("ios"))
            #expect(properties["$sdk_version"] == .string("0.0.1-alpha.1"))
        }

        @Test("missing app metadata reports null, and the app name falls back to the bundle id")
        func standardPropertiesFallBackToNull() {
            let properties = AnalyticsClient.standardProperties(
                device: SdkDeviceInfo(bundleId: "com.example.app"), sdkVersion: "0.0.1-alpha.1")

            #expect(properties["$app_build"] == .null)
            #expect(properties["$app_version"] == .null)
            #expect(properties["$locale"] == .null)
            #expect(properties["$app_name"] == .string("com.example.app"))
        }

        @Test("a non-finite property is sent as null with a warning instead of poisoning the batch")
        func replacesNonFiniteNumbers() async throws {
            let warnings = WarningRecorder()
            let client = makeClient(responses: [StubResponse()], warnings: warnings)
            await client.capture(
                "checkout_started",
                properties: [
                    "ratio": .number(Double.nan),
                    "nested": .object(["depth": .number(Double.infinity)]),
                    "plan": .string("pro"),
                ]
            )
            await client.flush()

            let request = try #require(StubURLProtocol.recordedRequests().first)
            let body = try #require(request.jsonBody())
            let events = try #require(body["events"] as? [[String: Any]])
            let properties = try #require(events[0]["properties"] as? [String: Any])
            #expect(properties["ratio"] is NSNull)
            #expect((properties["nested"] as? [String: Any])?["depth"] is NSNull)
            #expect(properties["plan"] as? String == "pro")
            #expect(await client.queueLength() == 0)
            #expect(warnings.contains("non-finite analytics property \"ratio\""))
            #expect(warnings.contains("non-finite analytics property \"nested.depth\""))
        }

        @Test("a body that cannot be represented as JSON is rejected before it is encoded")
        func rejectsUnencodableBodies() {
            #expect(AnalyticsClient.encodedBody(["token": "pk_test"]) != nil)
            // `JSONSerialization.data` would raise an uncatchable exception for these.
            #expect(AnalyticsClient.encodedBody(["ratio": Double.nan]) == nil)
            #expect(AnalyticsClient.encodedBody(["events": [Date()]]) == nil)
        }

        @Test("Retry-After accepts an HTTP date")
        func parsesRetryAfterDate() {
            let now: Double = 1_700_000_000_000
            let date = "Tue, 14 Nov 2023 22:13:40 GMT"  // now + 20s
            #expect(AnalyticsClient.parseRetryAfterMilliseconds(date, now: now) == 20_000)
            #expect(AnalyticsClient.parseRetryAfterMilliseconds("nonsense", now: now) == nil)
            #expect(AnalyticsClient.parseRetryAfterMilliseconds(nil, now: now) == nil)
        }

        @Test("the retry delay grows exponentially and is capped")
        func retryDelayIsCapped() {
            #expect(AnalyticsClient.retryDelayMilliseconds(attempts: 1) == 1000)
            #expect(AnalyticsClient.retryDelayMilliseconds(attempts: 2) == 2000)
            #expect(AnalyticsClient.retryDelayMilliseconds(attempts: 3) == 4000)
            #expect(AnalyticsClient.retryDelayMilliseconds(attempts: 20) == 30_000)
        }
    }
}

/// Millisecond clock the tests move forward by hand.
final class MutableClock: @unchecked Sendable {
    private let lock = NSLock()
    private var storage: Double = 1_700_000_000_000

    var value: Double {
        get { lock.withLock { storage } }
        set { lock.withLock { storage = newValue } }
    }
}

/// Records the durations the analytics client would have slept for.
final class SleepRecorder: @unchecked Sendable {
    private let lock = NSLock()
    private var storage: [Double] = []

    var values: [Double] {
        return lock.withLock { storage }
    }

    func record(_ milliseconds: Double) {
        lock.withLock { storage.append(milliseconds) }
    }
}
