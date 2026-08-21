import Foundation
import Testing

@testable import VoidhashCore

@Suite("Voidhash API client", .serialized)
struct VoidhashApiClientTests {
    static let personJson = """
        {
          "distinctId": "user-123",
          "email": "a@b.com",
          "entitlements": { "grants": [
            {
              "expiresAt": null,
              "perkId": "pro",
              "source": "subscription",
              "sourceId": "sub_1",
              "sourcePersonId": "person_1",
              "status": "active"
            }
          ] },
          "name": null,
          "personId": "person_1",
          "purchases": { "history": [] },
          "snapshotContext": {
            "includedPersonIds": ["person_1"],
            "migrationJobId": null,
            "mode": "persisted"
          },
          "subscriptions": {
            "current": {
              "expiresAt": "2026-01-01T00:00:00.000Z",
              "productId": "prod_1",
              "status": "active",
              "subscriptionId": "sub_1"
            },
            "history": []
          }
        }
        """

    static let headers = ["x-publishable-key": "pk_test", "x-distinct-id": "user-123"]

    private func makeClient(_ responses: [StubResponse]) -> VoidhashApiClient {
        return VoidhashApiClient(
            baseUrl: URL(string: "https://api.example.com")!,
            session: StubURLProtocol.makeSession(responses: responses)
        )
    }

    @Test("getSchema issues a GET with the common headers")
    func getSchema() async throws {
        let client = makeClient([
            StubResponse(
                body: """
                    {
                      "version": "abc123",
                      "products": {
                        "pro-monthly": {
                          "slug": "pro-monthly",
                          "type": "subscription",
                          "duration": "monthly",
                          "properties": { "name": "Pro Monthly" },
                          "configuration": {
                            "providers": { "appleAppStore": { "productId": "com.voidhash.pro.monthly" } },
                            "perks": { "pro": true }
                          }
                        }
                      },
                      "locations": {
                        "onboarding": { "slug": "onboarding", "name": "Onboarding", "description": null }
                      },
                      "perks": { "pro": { "slug": "pro", "name": "Pro" } }
                    }
                    """)
        ])

        let schema = try await client.getSchema(headers: VoidhashApiClientTests.headers)
        let recorded = try #require(StubURLProtocol.recordedRequests().first)

        #expect(recorded.method == "GET")
        #expect(recorded.path == "/api/v1/sdk/schema")
        #expect(recorded.headers["x-publishable-key"] == "pk_test")
        #expect(recorded.headers["x-distinct-id"] == "user-123")
        #expect(schema.version == "abc123")
        #expect(schema.appleProductId(forSlug: "pro-monthly") == "com.voidhash.pro.monthly")
        #expect(schema.products["pro-monthly"]?.configuration.perks["pro"] == true)
        #expect(schema.locations["onboarding"]?.name == "Onboarding")
    }

    @Test("getPerson decodes the person snapshot")
    func getPerson() async throws {
        let client = makeClient([StubResponse(body: VoidhashApiClientTests.personJson)])

        let person = try #require(await client.getPerson(headers: VoidhashApiClientTests.headers))
        let recorded = try #require(StubURLProtocol.recordedRequests().first)

        #expect(recorded.method == "GET")
        #expect(recorded.path == "/api/v1/sdk/person")
        #expect(person.distinctId == "user-123")
        #expect(person.entitlements.grants.first?.perkId == "pro")
        #expect(person.subscriptions.current?.status == "active")
        #expect(person.name == nil)
    }

    @Test("a person 404 maps to nil rather than an error")
    func personNotFound() async throws {
        let client = makeClient([
            StubResponse(
                statusCode: 404,
                body: """
                    {"_tag":"Api/SdkPersonNotFoundError","message":"Person not found"}
                    """)
        ])

        #expect(try await client.getPerson(headers: VoidhashApiClientTests.headers) == nil)
    }

    @Test("identify posts the identify body")
    func identify() async throws {
        let client = makeClient([StubResponse(body: VoidhashApiClientTests.personJson)])

        _ = try await client.identify(
            headers: VoidhashApiClientTests.headers,
            body: SdkIdentifyBody(
                distinctId: "user-123", email: "a@b.com", name: "Ada",
                traits: ["plan": .string("pro"), "seats": .number(3)])
        )

        let recorded = try #require(StubURLProtocol.recordedRequests().first)
        let body = try #require(recorded.jsonBody())

        #expect(recorded.method == "POST")
        #expect(recorded.path == "/api/v1/sdk/identify")
        #expect(recorded.header("content-type") == "application/json")
        #expect(body["distinctId"] as? String == "user-123")
        #expect(body["email"] as? String == "a@b.com")
        #expect(body["name"] as? String == "Ada")
        #expect((body["traits"] as? [String: Any])?["plan"] as? String == "pro")
    }

    @Test("setPersonTraits posts to the traits endpoint")
    func setPersonTraits() async throws {
        let client = makeClient([StubResponse(body: VoidhashApiClientTests.personJson)])

        _ = try await client.setPersonTraits(
            headers: VoidhashApiClientTests.headers,
            body: SdkPersonTraitsBody(traits: ["plan": .string("pro")])
        )

        let recorded = try #require(StubURLProtocol.recordedRequests().first)

        #expect(recorded.method == "POST")
        #expect(recorded.path == "/api/v1/sdk/person/traits")
        #expect((recorded.jsonBody()?["traits"] as? [String: Any])?["plan"] as? String == "pro")
    }

    @Test("evaluateFlags posts the requested keys and decodes the results")
    func evaluateFlags() async throws {
        let client = makeClient([
            StubResponse(
                body: """
                    {"flags":[{"enabled":true,"key":"new-paywall","variantKey":"b"}]}
                    """)
        ])

        let response = try await client.evaluateFlags(
            headers: VoidhashApiClientTests.headers, flagKeys: ["new-paywall"])
        let recorded = try #require(StubURLProtocol.recordedRequests().first)

        #expect(recorded.path == "/api/v1/sdk/evaluate-flags")
        #expect(recorded.jsonBody()?["flagKeys"] as? [String] == ["new-paywall"])
        #expect(response.flags.first?.key == "new-paywall")
        #expect(response.flags.first?.enabled == true)
        #expect(response.flags.first?.variantKey == "b")
    }

    @Test("resolvePaywall decodes a showing")
    func resolvePaywall() async throws {
        let client = makeClient([
            StubResponse(
                body: """
                    {
                      "location": { "id": "loc_1", "name": "Onboarding", "slug": "onboarding" },
                      "showing": {
                        "id": "showing_1",
                        "paywall": { "id": "pw_1", "name": "Main", "slug": "main" },
                        "paywallId": "pw_1",
                        "paywallRelease": {
                          "htmlUrl": "https://cdn.voidhash.com/pw_1.html",
                          "publishedAt": "2026-01-01T00:00:00.000Z",
                          "releaseId": "rel_1",
                          "runtime": {
                            "contentHash": "hash",
                            "productSlugs": ["pro-monthly"],
                            "variables": { "headline": "Go Pro" }
                          },
                          "version": 3
                        },
                        "paywallReleaseId": "rel_1",
                        "startedAt": "2026-01-01T00:00:00.000Z",
                        "type": "paywall_release"
                      }
                    }
                    """)
        ])

        let resolved = try #require(
            await client.resolvePaywall(
                headers: VoidhashApiClientTests.headers, locationSlug: "onboarding"))
        let recorded = try #require(StubURLProtocol.recordedRequests().first)

        #expect(recorded.method == "POST")
        #expect(recorded.path == "/api/v1/sdk/resolve-paywall")
        #expect(recorded.jsonBody()?["locationSlug"] as? String == "onboarding")
        #expect(resolved.showing.paywallRelease?.htmlUrl == "https://cdn.voidhash.com/pw_1.html")
        #expect(resolved.showing.paywallRelease?.version == 3)
        #expect(
            resolved.showing.paywallRelease?.runtime?.variables["headline"] == .string("Go Pro"))
    }

    @Test("resolvePaywall maps a null body to nil")
    func resolvePaywallNull() async throws {
        let client = makeClient([StubResponse(body: "null")])

        #expect(
            try await client.resolvePaywall(
                headers: VoidhashApiClientTests.headers, locationSlug: "onboarding") == nil)
    }

    @Test("syncTransaction posts the iOS transaction payload")
    func syncTransaction() async throws {
        let client = makeClient([StubResponse(body: #"{"accepted":true}"#)])

        let response = try await client.syncTransaction(
            headers: VoidhashApiClientTests.headers,
            body: SdkSyncTransactionBody(
                appAccountToken: "3501e751-7582-58f9-9c1d-533c7466049f",
                platform: "ios",
                providerProductId: "com.voidhash.pro.monthly",
                productSlug: "pro-monthly",
                purchaseDate: 1_700_000_000_000,
                quantity: 1,
                transactionId: "2000000000000001"
            )
        )

        let recorded = try #require(StubURLProtocol.recordedRequests().first)
        let body = try #require(recorded.jsonBody())

        #expect(recorded.path == "/api/v1/sdk/sync-transaction")
        #expect(response.accepted == true)
        #expect(body["platform"] as? String == "ios")
        #expect(body["productSlug"] as? String == "pro-monthly")
        #expect(body["transactionId"] as? String == "2000000000000001")
        #expect(body["appAccountToken"] as? String == "3501e751-7582-58f9-9c1d-533c7466049f")
        #expect(body["purchaseDate"] as? Double == 1_700_000_000_000)
        #expect(body["purchaseToken"] == nil)
    }

    @Test("a 401 maps to AUTHENTICATION_FAILED with the server message")
    func unauthorized() async {
        let client = makeClient([
            StubResponse(
                statusCode: 401,
                body: #"{"_tag":"Api/NotAuthenticatedError","message":"Invalid publishable key"}"#)
        ])

        do {
            _ = try await client.getSchema(headers: VoidhashApiClientTests.headers)
            Issue.record("expected the request to fail")
        } catch let error as VoidhashApiError {
            #expect(error.code == "AUTHENTICATION_FAILED")
            #expect(error.message == "Invalid publishable key")
            #expect(error.statusCode == 401)
            #expect(error.tag == "Api/NotAuthenticatedError")
            #expect(error.description == "AUTHENTICATION_FAILED: Invalid publishable key")
        } catch {
            Issue.record("unexpected error: \(error)")
        }
    }

    @Test("http statuses map onto the documented error codes")
    func documentedErrorCodes() {
        func code(_ statusCode: Int) -> String {
            return VoidhashApiError.http(statusCode: statusCode, tag: nil, message: nil).code
        }

        // The spellings are the ones in `libraries/react-native/ERROR_HANDLING.md`.
        #expect(code(400) == "INVALID_REQUEST")
        #expect(code(401) == "AUTHENTICATION_FAILED")
        #expect(code(403) == "AUTHENTICATION_FAILED")
        #expect(code(404) == "NOT_FOUND")
        #expect(code(409) == "ALREADY_IDENTIFIED")
        #expect(code(429) == "RATE_LIMIT_EXCEEDED")
        #expect(code(500) == "API_ERROR")
    }

    @Test("a 500 falls back to API_ERROR and the server cause")
    func serverError() async {
        let client = makeClient([
            StubResponse(
                statusCode: 500, body: #"{"_tag":"Api/SdkServiceError","cause":"boom"}"#)
        ])

        do {
            _ = try await client.getSchema(headers: VoidhashApiClientTests.headers)
            Issue.record("expected the request to fail")
        } catch let error as VoidhashApiError {
            #expect(error.code == "API_ERROR")
            #expect(error.message == "boom")
            #expect(error.statusCode == 500)
        } catch {
            Issue.record("unexpected error: \(error)")
        }
    }

    @Test("an unparsable error body still produces a status message")
    func opaqueError() async {
        let client = makeClient([StubResponse(statusCode: 503, body: "<html>nope</html>")])

        do {
            _ = try await client.getSchema(headers: VoidhashApiClientTests.headers)
            Issue.record("expected the request to fail")
        } catch let error as VoidhashApiError {
            #expect(error.code == "API_ERROR")
            #expect(error.message == "Request failed with status 503")
            #expect(error.tag == nil)
        } catch {
            Issue.record("unexpected error: \(error)")
        }
    }

    @Test("a malformed success body maps to INVALID_RESPONSE")
    func malformedSuccess() async {
        let client = makeClient([StubResponse(body: #"{"unexpected":true}"#)])

        do {
            _ = try await client.getSchema(headers: VoidhashApiClientTests.headers)
            Issue.record("expected the request to fail")
        } catch let error as VoidhashApiError {
            #expect(error.code == "INVALID_RESPONSE")
        } catch {
            Issue.record("unexpected error: \(error)")
        }
    }

    @Test("a transport failure maps to NETWORK_ERROR")
    func transportFailure() async {
        let client = VoidhashApiClient(
            baseUrl: URL(string: "https://api.example.com")!,
            session: StubURLProtocol.makeSession(
                responses: [],
                failure: URLError(.notConnectedToInternet)
            )
        )

        do {
            _ = try await client.getSchema(headers: VoidhashApiClientTests.headers)
            Issue.record("expected the request to fail")
        } catch let error as VoidhashApiError {
            #expect(error.code == "NETWORK_ERROR")
            #expect(error.statusCode == nil)
        } catch {
            Issue.record("unexpected error: \(error)")
        }
    }
}
