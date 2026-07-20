import Foundation

enum AppleIdentifierKind: String, Sendable {
    case idfa
    case idfv
    case appleAdsToken
}

struct AppleIdentifierPolicy: Sendable {
    let advertisingIdentifiers: Bool
    let vendorIdentifiers: Bool
    let collectionOptOut: Bool
    let attStatus: String
    let strictNoIdfa: Bool

    func permits(_ kind: AppleIdentifierKind) -> Bool {
        guard !collectionOptOut else { return false }
        switch kind {
        case .idfa:
            return !strictNoIdfa && advertisingIdentifiers && attStatus == "authorized"
        case .idfv:
            return vendorIdentifiers
        case .appleAdsToken:
            return advertisingIdentifiers
        }
    }
}

struct AppleIdentifierObservation: Equatable, Sendable {
    let kind: AppleIdentifierKind
    let outcome: String
    let protectedReference: String?
}

final class AppleIdentifierCollector: @unchecked Sendable {
    typealias Provider = @Sendable () throws -> String?
    typealias Vault = @Sendable (_ kind: AppleIdentifierKind, _ value: String) throws -> String

    private let providers: [AppleIdentifierKind: Provider]
    private let vault: Vault

    init(providers: [AppleIdentifierKind: Provider], vault: @escaping Vault) {
        self.providers = providers
        self.vault = vault
    }

    func collect(_ kind: AppleIdentifierKind, policy: AppleIdentifierPolicy) -> AppleIdentifierObservation {
        guard policy.permits(kind) else {
            return AppleIdentifierObservation(kind: kind, outcome: "permissionDenied", protectedReference: nil)
        }
        guard let provider = providers[kind] else {
            return AppleIdentifierObservation(kind: kind, outcome: "notInstalled", protectedReference: nil)
        }
        do {
            guard let value = try provider(), !value.isEmpty else {
                return AppleIdentifierObservation(kind: kind, outcome: "unavailable", protectedReference: nil)
            }
            return AppleIdentifierObservation(
                kind: kind,
                outcome: "collected",
                protectedReference: try vault(kind, value)
            )
        } catch {
            return AppleIdentifierObservation(kind: kind, outcome: "error", protectedReference: nil)
        }
    }
}
