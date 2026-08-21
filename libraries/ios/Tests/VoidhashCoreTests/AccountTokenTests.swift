import Testing

@testable import VoidhashCore

@Suite("Account token derivation")
struct AccountTokenTests {
    static let dnsNamespace = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"

    @Test("reproduces the RFC 4122 UUIDv5 sanity anchor")
    func rfcAnchor() {
        #expect(
            AccountToken.uuidV5(namespaceUuid: AccountTokenTests.dnsNamespace, name: "www.example.com")
                == "2ed6657d-e927-568b-95e1-2665a8aea6a2")
    }

    @Test("pins the shared namespace")
    func sharedNamespace() {
        #expect(
            AccountToken.uuidV5(
                namespaceUuid: AccountTokenTests.dnsNamespace,
                name: "appaccounttoken.voidhash.com") == AccountToken.namespace)
    }

    @Test(
        "matches the backend vectors",
        arguments: [
            ("user-123", "3501e751-7582-58f9-9c1d-533c7466049f"),
            ("USER-123", "c6eb5cb5-739d-52a9-9a32-6a0fb4be71cc"),
            ("vh:anon:k2j4h5g6f7", "22c4cde2-2c40-5266-9699-35f7d271e1a8"),
            ("naïve@exämple.com", "84080bfc-8e5a-5daf-9ec4-c2221ea8d948"),
        ])
    func backendVectors(distinctId: String, expected: String) {
        #expect(AccountToken.derive(distinctId: distinctId) == expected)
    }

    @Test("is deterministic and lowercase for long inputs")
    func longInputs() {
        let distinctId = String(repeating: "person:", count: 200)
        let first = AccountToken.derive(distinctId: distinctId)

        #expect(AccountToken.derive(distinctId: distinctId) == first)
        #expect(first == first.lowercased())
        #expect(first.count == 36)
        #expect(Array(first)[14] == "5")
        #expect("89ab".contains(Array(first)[19]))
    }

    @Test("rejects a malformed namespace")
    func malformedNamespace() {
        #expect(AccountToken.uuidV5(namespaceUuid: "not-a-uuid", name: "user-123") == nil)
    }
}
