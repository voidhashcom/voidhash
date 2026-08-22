import Foundation
import NitroModules
import VoidhashCore
import Voidhash

/// Embeds the bare-native `VoidhashClient` as the React Native SDK's data-plane transport.
///
/// Every operation takes the distinct id explicitly — identity stays JS-owned, so both sides
/// can never diverge. Headers and environment mode are built by the native client exactly like
/// a pure-native integration.
final class HybridVoidhashEngine: HybridVoidhashEngineSpec {
    private struct EngineOptions: Decodable {
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

        private enum CodingKeys: String, CodingKey {
            case email
            case name
            case traits
        }

        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            email = try container.decodeIfPresent(String.self, forKey: .email)
            name = try container.decodeIfPresent(String.self, forKey: .name)
            traits = try container.decodeIfPresent([String: JSONValue].self, forKey: .traits)
        }
    }

    private struct SyncRequestEnvelope: Decodable {
        var distinctId: String
        var request: SdkSyncTransactionBody
    }

    private struct DevelopmentRequestEnvelope: Decodable {
        var distinctId: String
        var request: SdkDevelopmentPurchaseBody
    }

    private let lock = NSLock()
    private var client: VoidhashClient?

    private func withClient<T>(_ body: (VoidhashClient) async throws -> T) async throws -> T {
        guard let currentClient = lock.withLock({ client }) else {
            throw RuntimeError.error(
                withMessage: "CONFIGURATION_MISSING: VoidhashEngine is not configured")
        }
        return try await body(currentClient)
    }

    func configure(publishableKey: String, optionsJson: String) throws -> Void {
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

        lock.withLock {
            client = VoidhashClient(publishableKey: publishableKey, options: voidhashOptions)
        }
    }

    func fetchSchema(distinctId: String) throws -> Promise<String> {
        return Promise.async {
            let schema = try await self.withClient { engine in
                try await engine.fetchSchema(distinctId: distinctId)
            }
            return try Self.encode(schema)
        }
    }

    func fetchPerson(distinctId: String, forceFetch: Bool) throws -> Promise<String> {
        return Promise.async {
            // The embedded surface is stateless; forceFetch is always honored.
            guard let person = try await self.withClient({ engine in
                try await engine.fetchPerson(distinctId: distinctId)
            }) else {
                return "null"
            }
            return try Self.encode(person)
        }
    }

    func identify(distinctId: String, bodyJson: String) throws -> Promise<String> {
        return Promise.async {
            let body = try JSONDecoder().decode(IdentifyBody.self, from: Data(bodyJson.utf8))
            let person = try await self.withClient { engine in
                try await engine.identifyPerson(
                    distinctId: distinctId,
                    externalUserId: body.distinctId,
                    email: body.email,
                    name: body.name
                )
            }
            return try Self.encode(person)
        }
    }

    func setPersonAttributes(distinctId: String, attributesJson: String) throws -> Promise<String> {
        return Promise.async {
            let body = try JSONDecoder()
                .decode(AttributesBody.self, from: Data(attributesJson.utf8))
            var traits: [String: JSONValue] = body.traits ?? [:]
            if let email = body.email {
                traits["email"] = .string(email)
            }
            if let name = body.name {
                traits["name"] = .string(name)
            }
            let person = try await self.withClient { engine in
                try await engine.setPersonTraits(distinctId: distinctId, traits: traits)
            }
            return try Self.encode(person)
        }
    }

    func evaluateFlags(distinctId: String, flagKeysJson: String) throws -> Promise<String> {
        return Promise.async {
            let raw = try JSONDecoder().decode([String].self, from: Data(flagKeysJson.utf8))
            let flags = try await self.withClient({ engine in
                try await engine.evaluateFeatureFlags(
                    distinctId: distinctId, keys: raw.isEmpty ? nil : raw)
            })
            return try Self.encode(flags)
        }
    }

    func resolvePaywall(distinctId: String, locationSlug: String) throws -> Promise<String> {
        return Promise.async {
            guard let paywall = try await self.withClient({ engine in
                try await engine.resolvePaywallConfig(
                    distinctId: distinctId,
                    locationSlug: locationSlug
                )
            }) else {
                return "null"
            }
            return try Self.encode(paywall)
        }
    }

    func syncTransaction(distinctId: String, requestJson: String) throws -> Promise<Bool> {
        return Promise.async {
            let envelope = try JSONDecoder()
                .decode(SyncRequestEnvelope.self, from: Data(requestJson.utf8))
            return try await self.withClient { engine in
                try await engine.syncStoreTransaction(
                    envelope.request,
                    distinctId: envelope.distinctId.isEmpty ? distinctId : envelope.distinctId
                )
            }
        }
    }

    func developmentPurchase(distinctId: String, requestJson: String) throws -> Promise<Bool> {
        return Promise.async {
            let envelope = try JSONDecoder()
                .decode(DevelopmentRequestEnvelope.self, from: Data(requestJson.utf8))
            try await self.withClient { engine in
                try await engine.recordDevelopmentPurchase(
                    envelope.request,
                    distinctId: envelope.distinctId.isEmpty ? distinctId : envelope.distinctId
                )
            }
            return true
        }
    }

    func injectInternalSchema(schemaJson: String) throws -> Promise<Void> {
        let schema = try JSONDecoder().decode(RuntimeSchema.self, from: Data(schemaJson.utf8))
        return Promise.async {
            try await self.withClient { engine in
                await engine.injectInternalSchema(schema)
            }
        }
    }

    private static func encode<Value: Encodable>(_ value: Value) throws -> String {
        let data = try JSONEncoder().encode(value)
        return String(data: data, encoding: .utf8) ?? "null"
    }
}
