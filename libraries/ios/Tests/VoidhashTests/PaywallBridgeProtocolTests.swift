import Foundation
import Testing
import VoidhashCore

@testable import Voidhash

@Suite("Paywall bridge protocol")
struct PaywallBridgeProtocolTests {
    private func decode(_ raw: String) throws -> [String: Any] {
        let object = try JSONSerialization.jsonObject(with: Data(raw.utf8))
        return try #require(object as? [String: Any])
    }

    @Test("a purchase envelope parses into its payload")
    func parsesPurchaseEnvelope() throws {
        let envelope = try PaywallBridgeProtocol.parse(
            #"{"version":1,"type":"purchase","requestId":"req-1","payload":{"productId":"pro-monthly"}}"#
        )

        #expect(envelope.type == .purchase)
        #expect(envelope.requestId == "req-1")
        #expect(envelope.string("productId") == "pro-monthly")
    }

    @Test("payload-less envelopes are allowed for ready, close and restore")
    func parsesPayloadLessEnvelopes() throws {
        for type in ["ready", "close", "restore"] {
            let envelope = try PaywallBridgeProtocol.parse(#"{"version":1,"type":"\#(type)"}"#)
            #expect(envelope.type.rawValue == type)
            #expect(envelope.payload == nil)
        }
    }

    @Test("malformed envelopes are rejected with the contract error codes")
    func rejectsMalformedEnvelopes() {
        let cases: [(String, String)] = [
            ("not json", "INVALID_JSON"),
            ("[1]", "INVALID_ENVELOPE"),
            (#"{"version":2,"type":"ready"}"#, "UNSUPPORTED_VERSION"),
            (#"{"version":1,"type":"configure"}"#, "UNSUPPORTED_TYPE"),
            (#"{"version":1,"type":"ready","requestId":""}"#, "INVALID_ENVELOPE"),
            (#"{"version":1,"type":"purchase"}"#, "INVALID_PAYLOAD"),
            (#"{"version":1,"type":"purchase","payload":{"productId":""}}"#, "INVALID_PAYLOAD"),
            (#"{"version":1,"type":"openExternal","payload":{}}"#, "INVALID_PAYLOAD"),
            (#"{"version":1,"type":"event","payload":{"name":"x","properties":1}}"#,
                "INVALID_PAYLOAD"),
            (#"{"version":1,"type":"log","payload":{"level":"trace","message":"x"}}"#,
                "INVALID_PAYLOAD"),
        ]

        for (raw, expectedCode) in cases {
            #expect(throws: PaywallBridgeParseError.self) {
                try PaywallBridgeProtocol.parse(raw)
            }
            do {
                _ = try PaywallBridgeProtocol.parse(raw)
            } catch let error as PaywallBridgeParseError {
                #expect(error.code == expectedCode)
            } catch {
                Issue.record("unexpected error \(error)")
            }
        }
    }

    @Test("a status message carries the status, product id and request id")
    func serializesStatusMessage() throws {
        let message = try decode(
            PaywallBridgeProtocol.statusMessage(
                .purchasing, requestId: "req-1", productId: "pro-monthly"))

        #expect(message["version"] as? Int == 1)
        #expect(message["type"] as? String == "status")
        #expect(message["requestId"] as? String == "req-1")
        let payload = try #require(message["payload"] as? [String: Any])
        #expect(payload["status"] as? String == "purchasing")
        #expect(payload["productId"] as? String == "pro-monthly")
        #expect(payload["error"] == nil)
    }

    @Test("a request-id-less status message omits the key")
    func omitsAbsentRequestId() throws {
        let message = try decode(PaywallBridgeProtocol.statusMessage(.restoring))
        #expect(message["requestId"] == nil)
    }

    @Test("responses carry the action and either data or an error")
    func serializesResponses() throws {
        let success = try decode(
            PaywallBridgeProtocol.successResponse(
                .purchase, requestId: "req-1", data: ["productId": "pro-monthly"]))
        let successPayload = try #require(success["payload"] as? [String: Any])
        #expect(success["type"] as? String == "response")
        #expect(successPayload["action"] as? String == "purchase")
        #expect(successPayload["status"] as? String == "success")
        #expect((successPayload["data"] as? [String: Any])?["productId"] as? String
            == "pro-monthly")

        let failure = try decode(
            PaywallBridgeProtocol.errorResponse(
                .restore, code: "ACTION_FAILED", message: "boom", requestId: "req-2"))
        let failurePayload = try #require(failure["payload"] as? [String: Any])
        #expect(failurePayload["status"] as? String == "error")
        let error = try #require(failurePayload["error"] as? [String: Any])
        #expect(error["code"] as? String == "ACTION_FAILED")
        #expect(error["message"] as? String == "boom")
    }

    @Test("a configure message survives the ASCII-safe delivery encoding")
    func configureMessageSurvivesDelivery() throws {
        let config = PaywallRuntimeConfigBuilder.build(
            runtime: PaywallRuntimeConfigTests.runtime(productSlugs: ["pro-monthly"]),
            productsBySlug: ["pro-monthly": TestFixtures.product()],
            platform: "ios",
            locale: "de-DE"
        )
        let message = PaywallBridgeProtocol.configureMessage(config, requestId: "req-1")

        // The presenter escapes non-ASCII code units and base64-encodes before delivery; decoding
        // the script payload has to yield the same localized price back.
        let script = PaywallBridge.inboundScript(json: message)
        let encoded = try #require(
            script.components(separatedBy: "atob('").last?.components(separatedBy: "')").first)
        let decoded = try #require(Data(base64Encoded: encoded))
        let escaped = String(decoding: decoded, as: UTF8.self)
        #expect(escaped.allSatisfy { $0.isASCII })

        let roundTripped = try decode(escaped)
        let payload = try #require(roundTripped["payload"] as? [String: Any])
        let products = try #require(payload["products"] as? [[String: Any]])
        #expect(products[0]["priceString"] as? String == "59,99 €")
        #expect(roundTripped["type"] as? String == "configure")
        #expect(roundTripped["requestId"] as? String == "req-1")
    }

    @Test("an unencodable configure message degrades to the variables and warns")
    func degradedConfigureMessage() throws {
        let warnings = WarningRecorder()
        // A non-finite price cannot be represented in JSON, so encoding the full config fails.
        let config = PaywallRuntimeConfig(
            products: [
                PaywallRuntimeConfigProduct(
                    id: "com.example.pro.monthly",
                    slug: "pro-monthly",
                    displayName: "Pro Monthly",
                    price: Double.infinity,
                    priceString: "59,99 €"
                )
            ],
            variables: ["headline": .string("Go Pro")],
            locale: "de-DE",
            platform: "ios"
        )

        let message = try decode(
            PaywallBridgeProtocol.configureMessage(
                config, requestId: "req-1", warn: warnings.handler))

        #expect(message["type"] as? String == "configure")
        #expect(message["requestId"] as? String == "req-1")
        let payload = try #require(message["payload"] as? [String: Any])
        #expect((payload["products"] as? [[String: Any]])?.isEmpty == true)
        #expect((payload["variables"] as? [String: Any])?["headline"] as? String == "Go Pro")
        #expect(warnings.contains("degraded config"))
    }
}
