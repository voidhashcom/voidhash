import Foundation
import Voidhash
import VoidhashCore

/// The Nitro-free heart of ``HybridVoidhashEngine``: owns the embedded bare-native client and
/// performs every data-plane operation on it.
///
/// Kept separate from the hybrid so the React Native Swift package can unit test the engine
/// without React Native or Nitro; the hybrid only wraps these calls into Nitro promises.
final class VoidhashEngineCore: @unchecked Sendable {
    /// Builds the embedded client; injected by tests to control the client's dependencies.
    typealias ClientFactory = @Sendable (_ publishableKey: String, _ options: VoidhashOptions) ->
        VoidhashClient

    struct EngineOptions: Decodable {
        var baseUrl: String?
        var ingestUrl: String?
        var debug: Bool?
        var enabled: Bool?
        var readOnly: Bool?
        var dev: Bool?
    }

    private struct IdentifyBody: Decodable {
        var distinctId: String
        var email: String?
        var name: String?
    }

    private struct AttributesBody: Decodable {
        var email: String?
        var name: String?
        var traits: [String: JSONValue]?
    }

    private struct SyncRequestEnvelope: Decodable {
        var distinctId: String
        var request: SdkSyncTransactionBody
    }

    private struct DevelopmentRequestEnvelope: Decodable {
        var distinctId: String
        var request: SdkDevelopmentPurchaseBody
    }

    static let notConfigured = VoidhashStoreError(
        code: "CONFIGURATION_MISSING", message: "VoidhashEngine is not configured")

    private let lock = NSLock()
    private let makeClient: ClientFactory
    private var client: VoidhashClient?

    init(
        makeClient: @escaping ClientFactory = { publishableKey, options in
            VoidhashClient(publishableKey: publishableKey, options: options)
        }
    ) {
        self.makeClient = makeClient
    }

    /// Maps the JSON the TypeScript client sends onto ``VoidhashOptions``. Absent keys keep the
    /// bare SDK's defaults, so a missing `readOnly` means observer mode.
    static func decodeOptions(_ optionsJson: String) throws -> VoidhashOptions {
        let options = try JSONDecoder().decode(EngineOptions.self, from: Data(optionsJson.utf8))
        var voidhashOptions = VoidhashOptions()
        if let baseUrl = options.baseUrl, let url = URL(string: baseUrl) {
            voidhashOptions.baseUrl = url
        }
        if let ingestUrl = options.ingestUrl {
            voidhashOptions.ingestUrl = URL(string: ingestUrl)
        }
        if let debug = options.debug {
            voidhashOptions.debug = debug
        }
        if let enabled = options.enabled {
            voidhashOptions.enabled = enabled
        }
        if let readOnly = options.readOnly {
            voidhashOptions.readOnly = readOnly
        }
        if let dev = options.dev {
            voidhashOptions.dev = dev
        }
        return voidhashOptions
    }

    /// Creates the embedded client. The client is never started: the engine is data-plane only
    /// and must not open a second store observer next to the one the JS layer owns.
    func configure(publishableKey: String, optionsJson: String) throws {
        let options = try Self.decodeOptions(optionsJson)
        let client = makeClient(publishableKey, options)
        lock.withLock { self.client = client }
    }

    var isConfigured: Bool {
        return lock.withLock { client != nil }
    }

    /// Whether the embedded client runs in observer mode; `nil` before ``configure``.
    var isReadOnly: Bool? {
        return lock.withLock { client }?.isReadOnly
    }

    /// Mirrors the JS observer-mode decision into the embedded client, which owns the flag the
    /// `x-observer-mode` header is built from.
    func setReadOnly(_ readOnly: Bool) throws {
        try requireClient().setReadOnly(readOnly)
    }

    func fetchSchema(distinctId: String) async throws -> String {
        let schema = try await requireClient().fetchSchema(distinctId: distinctId)
        return try Self.encode(schema)
    }

    func fetchPerson(distinctId: String) async throws -> String {
        guard let person = try await requireClient().fetchPerson(distinctId: distinctId) else {
            return "null"
        }
        return try Self.encode(person)
    }

    func identify(distinctId: String, bodyJson: String) async throws -> String {
        let body = try JSONDecoder().decode(IdentifyBody.self, from: Data(bodyJson.utf8))
        let person = try await requireClient().identifyPerson(
            distinctId: distinctId,
            externalUserId: body.distinctId,
            email: body.email,
            name: body.name
        )
        return try Self.encode(person)
    }

    func setPersonAttributes(distinctId: String, attributesJson: String) async throws -> String {
        let body = try JSONDecoder().decode(AttributesBody.self, from: Data(attributesJson.utf8))
        var traits: [String: JSONValue] = body.traits ?? [:]
        if let email = body.email {
            traits["email"] = .string(email)
        }
        if let name = body.name {
            traits["name"] = .string(name)
        }
        let person = try await requireClient().setPersonTraits(
            distinctId: distinctId, traits: traits)
        return try Self.encode(person)
    }

    func evaluateFlags(distinctId: String, flagKeysJson: String) async throws -> String {
        let keys = try JSONDecoder().decode([String].self, from: Data(flagKeysJson.utf8))
        let flags = try await requireClient().evaluateFeatureFlags(
            distinctId: distinctId, keys: keys.isEmpty ? nil : keys)
        return try Self.encode(flags)
    }

    func resolvePaywall(distinctId: String, locationSlug: String) async throws -> String {
        guard
            let paywall = try await requireClient().resolvePaywallConfig(
                distinctId: distinctId, locationSlug: locationSlug)
        else {
            return "null"
        }
        return try Self.encode(paywall)
    }

    func syncTransaction(distinctId: String, requestJson: String) async throws -> Bool {
        let envelope = try JSONDecoder().decode(
            SyncRequestEnvelope.self, from: Data(requestJson.utf8))
        return try await requireClient().syncStoreTransaction(
            envelope.request,
            distinctId: envelope.distinctId.isEmpty ? distinctId : envelope.distinctId
        )
    }

    func developmentPurchase(distinctId: String, requestJson: String) async throws -> Bool {
        let envelope = try JSONDecoder().decode(
            DevelopmentRequestEnvelope.self, from: Data(requestJson.utf8))
        try await requireClient().recordDevelopmentPurchase(
            envelope.request,
            distinctId: envelope.distinctId.isEmpty ? distinctId : envelope.distinctId
        )
        return true
    }

    func injectInternalSchema(schemaJson: String) async throws {
        let schema = try JSONDecoder().decode(RuntimeSchema.self, from: Data(schemaJson.utf8))
        try await requireClient().injectInternalSchema(schema)
    }

    private func requireClient() throws -> VoidhashClient {
        guard let client = lock.withLock({ client }) else {
            throw Self.notConfigured
        }
        return client
    }

    private static func encode<Value: Encodable>(_ value: Value) throws -> String {
        let data = try JSONEncoder().encode(value)
        return String(data: data, encoding: .utf8) ?? "null"
    }
}
