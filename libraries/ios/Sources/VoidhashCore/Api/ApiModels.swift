import Foundation

/// Entitlement grant attached to a person snapshot.
public struct SdkEntitlementGrant: Codable, Sendable, Equatable {
    public let expiresAt: String?
    public let perkId: String
    public let source: String
    public let sourceId: String?
    public let sourcePersonId: String
    public let status: String
}

/// Purchase history entry attached to a person snapshot.
public struct SdkPurchaseHistoryEntry: Codable, Sendable, Equatable {
    public let createdAt: String
    public let productId: String?
    public let providerKey: String
    public let purchaseId: String
    public let sourcePersonId: String
    public let type: String
}

/// The person's currently active subscription, if any.
public struct SdkCurrentSubscription: Codable, Sendable, Equatable {
    public let expiresAt: String?
    public let productId: String?
    public let status: String
    public let subscriptionId: String?
}

/// Subscription history entry attached to a person snapshot.
public struct SdkSubscriptionHistoryEntry: Codable, Sendable, Equatable {
    public let canceledAt: String?
    public let expiresAt: String?
    public let isTrial: Bool
    public let productId: String?
    public let sourcePersonId: String
    public let startsAt: String
    public let status: String
    public let subscriptionId: String
}

/// Person snapshot returned by `/api/v1/sdk/person`, `/identify` and `/person/traits`.
public struct SdkPerson: Codable, Sendable, Equatable {
    public struct Entitlements: Codable, Sendable, Equatable {
        public let grants: [SdkEntitlementGrant]
    }

    public struct Purchases: Codable, Sendable, Equatable {
        public let history: [SdkPurchaseHistoryEntry]
    }

    public struct SnapshotContext: Codable, Sendable, Equatable {
        public let includedPersonIds: [String]
        public let migrationJobId: String?
        public let mode: String
    }

    public struct Subscriptions: Codable, Sendable, Equatable {
        public let current: SdkCurrentSubscription?
        public let history: [SdkSubscriptionHistoryEntry]
    }

    public let distinctId: String
    public let email: String?
    public let entitlements: Entitlements
    public let name: String?
    public let personId: String
    public let purchases: Purchases
    public let snapshotContext: SnapshotContext
    public let subscriptions: Subscriptions
}

/// Body of `POST /api/v1/sdk/identify`.
public struct SdkIdentifyBody: Codable, Sendable, Equatable {
    public let distinctId: String
    public let email: String?
    public let name: String?
    public let traits: [String: JSONValue]?

    public init(
        distinctId: String,
        email: String? = nil,
        name: String? = nil,
        traits: [String: JSONValue]? = nil
    ) {
        self.distinctId = distinctId
        self.email = email
        self.name = name
        self.traits = traits
    }
}

/// Body of `POST /api/v1/sdk/person/traits`.
public struct SdkPersonTraitsBody: Codable, Sendable, Equatable {
    public let email: String?
    public let name: String?
    public let traits: [String: JSONValue]?
    public let setOnce: [String: JSONValue]?
    public let clientEventId: String?

    public init(
        email: String? = nil,
        name: String? = nil,
        traits: [String: JSONValue]? = nil,
        setOnce: [String: JSONValue]? = nil,
        clientEventId: String? = nil
    ) {
        self.email = email
        self.name = name
        self.traits = traits
        self.setOnce = setOnce
        self.clientEventId = clientEventId
    }
}

/// Body of `POST /api/v1/sdk/evaluate-flags`.
public struct SdkEvaluateFlagsBody: Codable, Sendable, Equatable {
    public let flagKeys: [String]?

    public init(flagKeys: [String]? = nil) {
        self.flagKeys = flagKeys
    }
}

/// A single evaluated feature flag.
public struct SdkFeatureFlagResult: Codable, Sendable, Equatable {
    public let enabled: Bool
    public let key: String
    public let variantKey: String?
}

/// Response of `POST /api/v1/sdk/evaluate-flags`.
public struct SdkFeatureFlagsResponse: Codable, Sendable, Equatable {
    public let flags: [SdkFeatureFlagResult]
}

/// Body of `POST /api/v1/sdk/resolve-paywall`.
public struct SdkResolvePaywallBody: Codable, Sendable, Equatable {
    public let locationSlug: String

    public init(locationSlug: String) {
        self.locationSlug = locationSlug
    }
}

/// The paywall a location currently resolves to.
public struct SdkResolvedPaywall: Codable, Sendable, Equatable {
    public struct Location: Codable, Sendable, Equatable {
        public let id: String
        public let name: String
        public let slug: String
    }

    public struct Paywall: Codable, Sendable, Equatable {
        public let id: String
        public let name: String
        public let slug: String
    }

    public struct Runtime: Codable, Sendable, Equatable {
        public let contentHash: String
        public let productSlugs: [String]
        public let variables: [String: JSONValue]
    }

    public struct Release: Codable, Sendable, Equatable {
        public let htmlUrl: String
        public let publishedAt: String?
        public let releaseId: String
        public let runtime: Runtime?
        public let version: Double
    }

    public struct Showing: Codable, Sendable, Equatable {
        public let id: String
        public let paywall: Paywall?
        public let paywallId: String?
        public let paywallRelease: Release?
        public let paywallReleaseId: String?
        public let startedAt: String
        public let type: String
    }

    public let location: Location
    public let showing: Showing
}

/// Body of `POST /api/v1/sdk/sync-transaction`.
public struct SdkSyncTransactionBody: Codable, Sendable, Equatable {
    public let appAccountToken: String?
    public let platform: String
    public let providerProductId: String?
    public let productSlug: String
    public let purchaseDate: Double
    public let purchaseToken: String?
    public let quantity: Double
    public let receipt: String?
    public let transactionId: String

    public init(
        appAccountToken: String? = nil,
        platform: String,
        providerProductId: String? = nil,
        productSlug: String,
        purchaseDate: Double,
        purchaseToken: String? = nil,
        quantity: Double,
        receipt: String? = nil,
        transactionId: String
    ) {
        self.appAccountToken = appAccountToken
        self.platform = platform
        self.providerProductId = providerProductId
        self.productSlug = productSlug
        self.purchaseDate = purchaseDate
        self.purchaseToken = purchaseToken
        self.quantity = quantity
        self.receipt = receipt
        self.transactionId = transactionId
    }
}

/// Response of `POST /api/v1/sdk/sync-transaction`.
public struct SdkSyncTransactionResponse: Codable, Sendable, Equatable {
    /// Whether the backend recorded the transaction. A response that omits the field predates the
    /// flag and counts as accepted.
    public let accepted: Bool

    public init(accepted: Bool = true) {
        self.accepted = accepted
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        accepted = try container.decodeIfPresent(Bool.self, forKey: .accepted) ?? true
    }
}

/// Body of `POST /api/v1/sdk/development/purchase`.
public struct SdkDevelopmentPurchaseBody: Codable, Sendable, Equatable {
    /// Client-generated UUID identifying this simulated purchase.
    public let devTransactionId: String
    public let productSlug: String
    /// Millisecond epoch timestamp of the simulated purchase.
    public let purchaseDate: Double
    public let quantity: Double

    public init(
        devTransactionId: String,
        productSlug: String,
        purchaseDate: Double,
        quantity: Double
    ) {
        self.devTransactionId = devTransactionId
        self.productSlug = productSlug
        self.purchaseDate = purchaseDate
        self.quantity = quantity
    }
}
