import Foundation
import NitroModules
import VoidhashCore

/// Runs a core operation, translating ``VoidhashStoreError`` into the `"CODE: message"` runtime
/// errors the TypeScript layer branches on.
private func mappingStoreErrors<T>(_ operation: () async throws -> T) async throws -> T {
    do {
        return try await operation()
    } catch let error as VoidhashStoreError {
        throw RuntimeError.error(withMessage: error.description)
    }
}

/// Runs a synchronous core operation with the same error translation.
private func mappingStoreErrors<T>(_ operation: () throws -> T) throws -> T {
    do {
        return try operation()
    } catch let error as VoidhashStoreError {
        throw RuntimeError.error(withMessage: error.description)
    }
}

/// Embeds the bare-native `VoidhashClient` as the React Native SDK's data-plane transport.
///
/// Every operation takes the distinct id explicitly — identity stays JS-owned, so both sides
/// can never diverge. Headers and environment mode are built by the native client exactly like
/// a pure-native integration. The behaviour lives in ``VoidhashEngineCore``; this class only
/// bridges it into Nitro.
final class HybridVoidhashEngine: HybridVoidhashEngineSpec {
    private let core = VoidhashEngineCore()

    func configure(publishableKey: String, optionsJson: String) throws -> Void {
        try core.configure(publishableKey: publishableKey, optionsJson: optionsJson)
    }

    func setReadOnly(readOnly: Bool) throws {
        try mappingStoreErrors {
            try core.setReadOnly(readOnly)
        }
    }

    func fetchSchema(distinctId: String) throws -> Promise<String> {
        return Promise.async {
            try await mappingStoreErrors {
                try await self.core.fetchSchema(distinctId: distinctId)
            }
        }
    }

    func fetchPerson(distinctId: String, forceFetch: Bool) throws -> Promise<String> {
        return Promise.async {
            // The embedded surface is stateless; forceFetch is always honored.
            try await mappingStoreErrors {
                try await self.core.fetchPerson(distinctId: distinctId)
            }
        }
    }

    func identify(distinctId: String, bodyJson: String) throws -> Promise<String> {
        return Promise.async {
            try await mappingStoreErrors {
                try await self.core.identify(distinctId: distinctId, bodyJson: bodyJson)
            }
        }
    }

    func setPersonAttributes(distinctId: String, attributesJson: String) throws -> Promise<String> {
        return Promise.async {
            try await mappingStoreErrors {
                try await self.core.setPersonAttributes(
                    distinctId: distinctId, attributesJson: attributesJson)
            }
        }
    }

    func evaluateFlags(distinctId: String, flagKeysJson: String) throws -> Promise<String> {
        return Promise.async {
            try await mappingStoreErrors {
                try await self.core.evaluateFlags(
                    distinctId: distinctId, flagKeysJson: flagKeysJson)
            }
        }
    }

    func resolvePaywall(distinctId: String, locationSlug: String) throws -> Promise<String> {
        return Promise.async {
            try await mappingStoreErrors {
                try await self.core.resolvePaywall(
                    distinctId: distinctId, locationSlug: locationSlug)
            }
        }
    }

    func syncTransaction(distinctId: String, requestJson: String) throws -> Promise<Bool> {
        return Promise.async {
            try await mappingStoreErrors {
                try await self.core.syncTransaction(
                    distinctId: distinctId, requestJson: requestJson)
            }
        }
    }

    func developmentPurchase(distinctId: String, requestJson: String) throws -> Promise<Bool> {
        return Promise.async {
            try await mappingStoreErrors {
                try await self.core.developmentPurchase(
                    distinctId: distinctId, requestJson: requestJson)
            }
        }
    }

    func injectInternalSchema(schemaJson: String) throws -> Promise<Void> {
        return Promise.async {
            try await mappingStoreErrors {
                try await self.core.injectInternalSchema(schemaJson: schemaJson)
            }
        }
    }
}
