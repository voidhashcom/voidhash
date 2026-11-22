import Foundation

// The response models below encode a field the API declares nullable as `null` when it has no
// value, rather than leaving the key out as synthesized `Encodable` does. A host SDK re-encodes
// them for a layer whose types are generated from the API contract, where the key is always
// there. Fields the contract declares optional are left out. Decoding accepts both forms, so
// cache entries written either way read back the same.

/// Entitlement grant attached to a person snapshot.
public struct SdkEntitlementGrant: Codable, Sendable, Equatable {
    public let expiresAt: String?
    /// The perk's internal id, which is not the slug set in Studio.
    public let perkId: String
    /// The perk's slug as set in Studio; `nil` in snapshots cached before the backend reported
    /// it, and for a perk that was deleted.
    public let perkSlug: String?
    public let source: String
    public let sourceId: String?
    public let sourcePersonId: String
    public let status: String

    /// Whether the grant entitles its person: the backend reported it `active`.
    ///
    /// `expiresAt` is not consulted. The backend keeps a subscription's grant active through the
    /// store's billing retry and grace period, past the end of the period it names, and moves
    /// it only when a renewal reaches Voidhash; its next snapshot is what ends the grant. Judged
    /// on the device clock, a paying customer in grace, or one whose renewal is still queued
    /// while Voidhash is unreachable, would lose access at the period boundary, as would anyone
    /// whose clock runs ahead.
    public var isActive: Bool {
        return status == "active"
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(expiresAt, forKey: .expiresAt)
        try container.encode(perkId, forKey: .perkId)
        try container.encodeIfPresent(perkSlug, forKey: .perkSlug)
        try container.encode(source, forKey: .source)
        try container.encode(sourceId, forKey: .sourceId)
        try container.encode(sourcePersonId, forKey: .sourcePersonId)
        try container.encode(status, forKey: .status)
    }
}

/// A string the backend sends from a fixed set, decoded into an enum that keeps a value this SDK
/// version does not know as `unknown`, and encodes back to the exact string it came from: the
/// cache and a host SDK re-encoding a snapshot must see what the backend sent.
public protocol WireEnum: Codable, Sendable, Hashable {
    /// The case `wireValue` stands for, or `unknown` with it.
    init(wireValue: String)
    /// The string the backend sends for this case.
    var wireValue: String { get }
}

extension WireEnum {
    public init(from decoder: Decoder) throws {
        self.init(wireValue: try decoder.singleValueContainer().decode(String.self))
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(wireValue)
    }
}

/// The store a subscription or purchase was made in.
public enum SdkStore: WireEnum {
    case appStore
    case googlePlay
    case stripe
    case other
    /// A store this SDK version does not know, with the value the backend sent.
    case unknown(String)

    public init(wireValue: String) {
        switch wireValue {
        case "app_store": self = .appStore
        case "google_play": self = .googlePlay
        case "stripe": self = .stripe
        case "other": self = .other
        default: self = .unknown(wireValue)
        }
    }

    public var wireValue: String {
        switch self {
        case .appStore: return "app_store"
        case .googlePlay: return "google_play"
        case .stripe: return "stripe"
        case .other: return "other"
        case .unknown(let value): return value
        }
    }
}

/// Purchase history entry attached to a person snapshot.
public struct SdkPurchaseHistoryEntry: Codable, Sendable, Equatable {
    public enum PurchaseType: WireEnum {
        /// A product bought once.
        case oneTime
        /// A product bought again and again.
        case consumable
        /// A subscription's purchase.
        case subscription
        /// A type this SDK version does not know, with the value the backend sent.
        case unknown(String)

        public init(wireValue: String) {
            switch wireValue {
            case "one_time": self = .oneTime
            case "consumable": self = .consumable
            case "subscription": self = .subscription
            default: self = .unknown(wireValue)
            }
        }

        public var wireValue: String {
            switch self {
            case .oneTime: return "one_time"
            case .consumable: return "consumable"
            case .subscription: return "subscription"
            case .unknown(let value): return value
            }
        }
    }

    public let createdAt: String
    public let productId: String?
    /// The slug of the product bought; `nil` when its store product is not linked to one, and
    /// from servers that predate it.
    public let productSlug: String?
    public let providerKey: String
    public let purchaseId: String
    public let sourcePersonId: String
    public let type: PurchaseType
    /// When the store refunded the purchase, as an ISO 8601 timestamp.
    public let refundedAt: String?
    /// When the store took the purchase back, as an ISO 8601 timestamp.
    public let revokedAt: String?

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(createdAt, forKey: .createdAt)
        try container.encode(productId, forKey: .productId)
        try container.encode(productSlug, forKey: .productSlug)
        try container.encode(providerKey, forKey: .providerKey)
        try container.encode(purchaseId, forKey: .purchaseId)
        try container.encode(sourcePersonId, forKey: .sourcePersonId)
        try container.encode(type, forKey: .type)
        try container.encode(refundedAt, forKey: .refundedAt)
        try container.encode(revokedAt, forKey: .revokedAt)
    }
}

/// A subscription that has not ended, as the backend sees it across stores and devices.
///
/// Access comes from the person's entitlements, never from subscriptions: a subscription in a
/// billing retry may or may not still grant its perks, and the entitlements say which.
///
/// Fields the backend added later decode to a neutral value when absent (`nil`, `false`, an
/// `unknown` case), so a snapshot from an older server or cache still decodes.
public struct SdkSubscription: Codable, Sendable, Equatable {
    public enum Environment: WireEnum {
        case production
        case sandbox
        /// A test purchase, such as one made in development mode.
        case development
        /// An environment this SDK version does not know, with the value the backend sent.
        case unknown(String)

        public init(wireValue: String) {
            switch wireValue {
            case "production": self = .production
            case "sandbox": self = .sandbox
            case "test": self = .development
            default: self = .unknown(wireValue)
            }
        }

        public var wireValue: String {
            switch self {
            case .production: return "production"
            case .sandbox: return "sandbox"
            case .development: return "test"
            case .unknown(let value): return value
            }
        }
    }

    public enum Status: WireEnum {
        case active
        case trialing
        /// The renewal payment failed and the store still grants access while it retries.
        case inGracePeriod
        /// The renewal payment failed and the store retries it.
        case inBillingRetry
        /// Google Play holds the subscription until the user fixes their payment method.
        case onHold
        case paused
        case expired
        case revoked
        /// A status this SDK version does not know, with the value the backend sent.
        case unknown(String)

        public init(wireValue: String) {
            switch wireValue {
            case "active": self = .active
            case "trialing": self = .trialing
            case "in_grace_period": self = .inGracePeriod
            case "in_billing_retry": self = .inBillingRetry
            case "on_hold": self = .onHold
            case "paused": self = .paused
            case "expired": self = .expired
            case "revoked": self = .revoked
            default: self = .unknown(wireValue)
            }
        }

        public var wireValue: String {
            switch self {
            case .active: return "active"
            case .trialing: return "trialing"
            case .inGracePeriod: return "in_grace_period"
            case .inBillingRetry: return "in_billing_retry"
            case .onHold: return "on_hold"
            case .paused: return "paused"
            case .expired: return "expired"
            case .revoked: return "revoked"
            case .unknown(let value): return value
            }
        }
    }

    public enum PeriodType: WireEnum {
        /// A free trial.
        case trial
        /// An introductory price.
        case intro
        case regular
        /// A period type this SDK version does not know, with the value the backend sent.
        case unknown(String)

        public init(wireValue: String) {
            switch wireValue {
            case "trial": self = .trial
            case "intro": self = .intro
            case "regular": self = .regular
            default: self = .unknown(wireValue)
            }
        }

        public var wireValue: String {
            switch self {
            case .trial: return "trial"
            case .intro: return "intro"
            case .regular: return "regular"
            case .unknown(let value): return value
            }
        }
    }

    /// A price change the store announced for the next renewals.
    public struct PendingPrice: Codable, Sendable, Equatable {
        public enum Consent: WireEnum {
            /// The user has not agreed to the new price yet.
            case pending
            case accepted
            /// A consent state this SDK version does not know, with the value the backend sent.
            case unknown(String)

            public init(wireValue: String) {
                switch wireValue {
                case "pending": self = .pending
                case "accepted": self = .accepted
                default: self = .unknown(wireValue)
                }
            }

            public var wireValue: String {
                switch self {
                case .pending: return "pending"
                case .accepted: return "accepted"
                case .unknown(let value): return value
                }
            }
        }

        /// The new price in millionths of the currency unit.
        public let amountMicros: Int64
        /// ISO 4217 currency code.
        public let currency: String
        /// When the new price applies, as an ISO 8601 timestamp.
        public let effectiveAt: String?
        /// Whether the user agreed; `nil` when the store needs no consent.
        public let consent: Consent?

        public func encode(to encoder: any Encoder) throws {
            var container = encoder.container(keyedBy: CodingKeys.self)
            try container.encode(amountMicros, forKey: .amountMicros)
            try container.encode(currency, forKey: .currency)
            try container.encode(effectiveAt, forKey: .effectiveAt)
            try container.encode(consent, forKey: .consent)
        }
    }

    public let subscriptionId: String
    /// The Voidhash product id; `nil` when its store product is not linked to a product.
    public let productId: String?
    public let productSlug: String?
    public let store: SdkStore
    public let environment: Environment
    public let status: Status
    public let periodType: PeriodType
    /// ISO 8601 timestamp.
    public let startsAt: String?
    /// When the current period ends, as an ISO 8601 timestamp.
    public let expiresAt: String?
    /// Whether the subscription renews at the end of the current period.
    public let willRenew: Bool
    /// When the user turned auto-renew off or canceled, as an ISO 8601 timestamp.
    public let canceledAt: String?
    /// The product a pending downgrade or crossgrade switches to at the next renewal.
    public let renewsToProductSlug: String?
    public let gracePeriodExpiresAt: String?
    public let billingIssueDetectedAt: String?
    /// When a paused Google Play subscription resumes.
    public let resumesAt: String?
    public let pendingPrice: PendingPrice?
    /// The store offer the current period was bought with.
    public let offerId: String?
    public let isFamilyShared: Bool
    public let refundedAt: String?
    public let revokedAt: String?

    private enum CodingKeys: String, CodingKey {
        case subscriptionId, productId, productSlug, store, environment, status, periodType
        case startsAt, expiresAt, willRenew, canceledAt, renewsToProductSlug
        case gracePeriodExpiresAt, billingIssueDetectedAt, resumesAt, pendingPrice, offerId
        case isFamilyShared, refundedAt, revokedAt
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        subscriptionId =
            try container.decodeIfPresent(String.self, forKey: .subscriptionId) ?? ""
        productId = try container.decodeIfPresent(String.self, forKey: .productId)
        productSlug = try container.decodeIfPresent(String.self, forKey: .productSlug)
        store =
            try container.decodeIfPresent(SdkStore.self, forKey: .store) ?? .unknown("")
        environment =
            try container.decodeIfPresent(Environment.self, forKey: .environment)
            ?? .unknown("")
        status = try container.decode(Status.self, forKey: .status)
        periodType =
            try container.decodeIfPresent(PeriodType.self, forKey: .periodType) ?? .unknown("")
        startsAt = try container.decodeIfPresent(String.self, forKey: .startsAt)
        expiresAt = try container.decodeIfPresent(String.self, forKey: .expiresAt)
        willRenew = try container.decodeIfPresent(Bool.self, forKey: .willRenew) ?? false
        canceledAt = try container.decodeIfPresent(String.self, forKey: .canceledAt)
        renewsToProductSlug = try container.decodeIfPresent(
            String.self, forKey: .renewsToProductSlug)
        gracePeriodExpiresAt = try container.decodeIfPresent(
            String.self, forKey: .gracePeriodExpiresAt)
        billingIssueDetectedAt = try container.decodeIfPresent(
            String.self, forKey: .billingIssueDetectedAt)
        resumesAt = try container.decodeIfPresent(String.self, forKey: .resumesAt)
        pendingPrice = try container.decodeIfPresent(PendingPrice.self, forKey: .pendingPrice)
        offerId = try container.decodeIfPresent(String.self, forKey: .offerId)
        isFamilyShared =
            try container.decodeIfPresent(Bool.self, forKey: .isFamilyShared) ?? false
        refundedAt = try container.decodeIfPresent(String.self, forKey: .refundedAt)
        revokedAt = try container.decodeIfPresent(String.self, forKey: .revokedAt)
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(subscriptionId, forKey: .subscriptionId)
        try container.encode(productId, forKey: .productId)
        try container.encode(productSlug, forKey: .productSlug)
        try container.encode(store, forKey: .store)
        try container.encode(environment, forKey: .environment)
        try container.encode(status, forKey: .status)
        try container.encode(periodType, forKey: .periodType)
        try container.encode(startsAt, forKey: .startsAt)
        try container.encode(expiresAt, forKey: .expiresAt)
        try container.encode(willRenew, forKey: .willRenew)
        try container.encode(canceledAt, forKey: .canceledAt)
        try container.encode(renewsToProductSlug, forKey: .renewsToProductSlug)
        try container.encode(gracePeriodExpiresAt, forKey: .gracePeriodExpiresAt)
        try container.encode(billingIssueDetectedAt, forKey: .billingIssueDetectedAt)
        try container.encode(resumesAt, forKey: .resumesAt)
        try container.encode(pendingPrice, forKey: .pendingPrice)
        try container.encode(offerId, forKey: .offerId)
        try container.encode(isFamilyShared, forKey: .isFamilyShared)
        try container.encode(refundedAt, forKey: .refundedAt)
        try container.encode(revokedAt, forKey: .revokedAt)
    }
}

/// Subscription history entry attached to a person snapshot.
public struct SdkSubscriptionHistoryEntry: Codable, Sendable, Equatable {
    public let canceledAt: String?
    public let expiresAt: String?
    public let isTrial: Bool
    public let productId: String?
    /// The slug of the subscription's product; `nil` when its store product is not linked to
    /// one, and from servers that predate it.
    public let productSlug: String?
    public let sourcePersonId: String
    public let startsAt: String
    /// Same statuses as current subscriptions; `unknown` keeps a value this SDK does not know.
    public let status: SdkSubscription.Status
    /// The store the subscription was bought in; `nil` from servers that predate it.
    public let store: SdkStore?
    public let subscriptionId: String
    /// When the store refunded the subscription, as an ISO 8601 timestamp.
    public let refundedAt: String?

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(canceledAt, forKey: .canceledAt)
        try container.encode(expiresAt, forKey: .expiresAt)
        try container.encode(isTrial, forKey: .isTrial)
        try container.encode(productId, forKey: .productId)
        try container.encode(productSlug, forKey: .productSlug)
        try container.encode(sourcePersonId, forKey: .sourcePersonId)
        try container.encode(startsAt, forKey: .startsAt)
        try container.encode(status, forKey: .status)
        try container.encode(store, forKey: .store)
        try container.encode(subscriptionId, forKey: .subscriptionId)
        try container.encode(refundedAt, forKey: .refundedAt)
    }
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

        public func encode(to encoder: any Encoder) throws {
            var container = encoder.container(keyedBy: CodingKeys.self)
            try container.encode(includedPersonIds, forKey: .includedPersonIds)
            try container.encode(migrationJobId, forKey: .migrationJobId)
            try container.encode(mode, forKey: .mode)
        }
    }

    public struct Subscriptions: Codable, Sendable, Equatable {
        /// The subscription that matters most right now, ranked active, trialing, in a grace
        /// period, in billing retry, on hold, paused; `nil` when none has not ended.
        public let current: SdkSubscription?
        /// Every subscription that has not ended, including ones in a grace period, billing
        /// retry, on hold or paused: what a subscription management screen lists. Check access
        /// with the person's entitlements, never with this list.
        public let all: [SdkSubscription]
        public let history: [SdkSubscriptionHistoryEntry]

        private enum CodingKeys: String, CodingKey {
            case current, all, history
        }

        public init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            current = try container.decodeIfPresent(SdkSubscription.self, forKey: .current)
            // Absent from servers and caches that predate it.
            all = try container.decodeIfPresent([SdkSubscription].self, forKey: .all) ?? []
            history = try container.decode([SdkSubscriptionHistoryEntry].self, forKey: .history)
        }

        public func encode(to encoder: any Encoder) throws {
            var container = encoder.container(keyedBy: CodingKeys.self)
            try container.encode(current, forKey: .current)
            try container.encode(all, forKey: .all)
            try container.encode(history, forKey: .history)
        }
    }

    public let distinctId: String
    public let email: String?
    public let entitlements: Entitlements
    public let name: String?
    public let personId: String
    public let purchases: Purchases
    public let snapshotContext: SnapshotContext
    public let subscriptions: Subscriptions

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(distinctId, forKey: .distinctId)
        try container.encode(email, forKey: .email)
        try container.encode(entitlements, forKey: .entitlements)
        try container.encode(name, forKey: .name)
        try container.encode(personId, forKey: .personId)
        try container.encode(purchases, forKey: .purchases)
        try container.encode(snapshotContext, forKey: .snapshotContext)
        try container.encode(subscriptions, forKey: .subscriptions)
    }

    /// Studio slugs of the perks the person holds an active grant for, see
    /// ``SdkEntitlementGrant/isActive``.
    public var activePerkSlugs: [String] {
        return entitlements.grants.compactMap { $0.isActive ? $0.perkSlug : nil }
    }

    /// Whether the person holds an active grant for the perk with the Studio slug `slug`, see
    /// ``SdkEntitlementGrant/isActive``.
    ///
    /// A grant from a snapshot cached before the backend reported slugs is matched by its perk id
    /// instead.
    public func hasActivePerk(_ slug: String) -> Bool {
        return entitlements.grants.contains {
            $0.isActive && ($0.perkSlug == slug || $0.perkId == slug)
        }
    }
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

    /// The body for person attributes as an app sets them. A string named `email` or `name` is
    /// the person's email or name, which the API takes in fields of their own; any other value
    /// under those names, and everything else, is a trait.
    public init(attributes: [String: JSONValue]) {
        var traits = attributes
        var email: String?
        var name: String?
        if case .string(let value) = attributes["email"] {
            email = value
            traits["email"] = nil
        }
        if case .string(let value) = attributes["name"] {
            name = value
            traits["name"] = nil
        }
        self.init(email: email, name: name, traits: traits.isEmpty ? nil : traits)
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
    /// Value of the selected variant, as configured in Studio: untyped JSON, so validate it before
    /// use. `nil` when the flag has no payload, and for results cached by an SDK version that did
    /// not keep payloads yet.
    public let payload: JSONValue?

    /// A flag result, as the backend reports one or as the SDK answers for a flag's configured
    /// default (the `featureFlags.defaults` option), which carries no variant and no payload.
    public init(enabled: Bool, key: String, variantKey: String? = nil, payload: JSONValue? = nil) {
        self.enabled = enabled
        self.key = key
        self.variantKey = variantKey
        self.payload = payload
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(enabled, forKey: .enabled)
        try container.encode(key, forKey: .key)
        try container.encode(variantKey, forKey: .variantKey)
        try container.encodeIfPresent(payload, forKey: .payload)
    }
}

/// Response of `POST /api/v1/sdk/evaluate-flags`.
public struct SdkFeatureFlagsResponse: Codable, Sendable, Equatable {
    public let flags: [SdkFeatureFlagResult]
}

/// Body of `POST /api/v1/sdk/resolve-paywall`.
public struct SdkResolvePaywallBody: Codable, Sendable, Equatable {
    public let locationSlug: String
    /// The revision of the location's interface the app was built against; `nil`, which is
    /// left out of the body, for an app that reports none.
    public let interfaceRevision: Int?
    /// Whether the SDK reports an A/B test's exposure itself, with the answer's exposure token
    /// on the first event of each presentation and on each hand-off of the answer to the app;
    /// otherwise the backend counts the person on resolving.
    public let reportsExposure: Bool

    /// - Parameters:
    ///   - interfaceRevision: Sent only when greater than 0: an app that reports no revision
    ///     counts as revision 0.
    ///   - reportsExposure: Whether the SDK reports the exposure itself.
    public init(locationSlug: String, interfaceRevision: Int = 0, reportsExposure: Bool) {
        self.locationSlug = locationSlug
        self.interfaceRevision = interfaceRevision > 0 ? interfaceRevision : nil
        self.reportsExposure = reportsExposure
    }
}

/// The opaque value that counts a person in the A/B test that chose a resolve answer, sent on the
/// first event of each presentation and on each hand-off of the answer. It never leaves the SDK
/// otherwise: no description, log or JSON for the app holds it.
@_spi(VoidhashFlows)
public struct FlowExposureToken: Codable, Sendable, Equatable, CustomStringConvertible,
    CustomDebugStringConvertible, CustomReflectable
{
    public let value: String

    public init(_ value: String) {
        self.value = value
    }

    public init(from decoder: any Decoder) throws {
        value = try decoder.singleValueContainer().decode(String.self)
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(value)
    }

    public var description: String { "<exposure token>" }
    public var debugDescription: String { description }
    public var customMirror: Mirror { Mirror(self, children: [:]) }
}

extension CodingUserInfoKey {
    /// Set by the cache's encoder: values the SDK keeps on the device but never hands out,
    /// such as an answer's exposure token, are encoded only then.
    static let voidhashCache = CodingUserInfoKey(rawValue: "voidhash.cache")!
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

    /// A release compiled into a flow package, which a native paywall renderer draws.
    public struct FlowPackage: Codable, Sendable, Equatable {
        /// Where the package bytes are downloaded from.
        public let url: String
        /// Lowercase hex SHA-256 of the package bytes.
        public let sha256: String
        /// Package format version; a renderer shows only the versions it reads.
        public let abiVersion: Int
        /// Products the package references, matched against a product's id, slug or store id.
        public let productIds: [String]
        /// What the flow is for (`paywall` or `onboarding`); absent from older backends.
        public let kind: String?
        /// Whether a successful purchase or restore ends the flow; absent means it does.
        public let shouldEndFlowOnPurchase: Bool?
        /// The flow runtime module the release needs, for a renderer that runs the flow runtime
        /// as a downloaded module; absent from older backends and when none is offered.
        public var runtime: RuntimeModule? = nil

        /// A flow runtime module: what a renderer in module mode downloads, verifies by hash and
        /// signature, and caches to show the flow.
        public struct RuntimeModule: Codable, Sendable, Equatable {
            /// The runtime version, `major.minor.patch`.
            public let version: String
            /// Lowercase hex SHA-256 of the module bytes.
            public let sha256: String
            /// Where the module is downloaded from.
            public let url: String
            /// Hex signature of the module, which the renderer verifies before it runs it; a
            /// module without one never runs.
            public let signature: String?

            public init(version: String, sha256: String, url: String, signature: String? = nil) {
                self.version = version
                self.sha256 = sha256
                self.url = url
                self.signature = signature
            }
        }
    }

    public struct Release: Codable, Sendable, Equatable {
        public let publishedAt: String?
        public let releaseId: String
        public let version: Double
        /// The compiled flow package; `nil` for a release that has none.
        public let flowPackage: FlowPackage?

        public func encode(to encoder: any Encoder) throws {
            var container = encoder.container(keyedBy: CodingKeys.self)
            try container.encode(publishedAt, forKey: .publishedAt)
            try container.encode(releaseId, forKey: .releaseId)
            try container.encode(version, forKey: .version)
            try container.encodeIfPresent(flowPackage, forKey: .flowPackage)
        }
    }

    public struct Showing: Codable, Sendable, Equatable {
        public let id: String
        public let paywall: Paywall?
        public let paywallId: String?
        public let paywallRelease: Release?
        public let paywallReleaseId: String?
        public let startedAt: String
        public let type: String
        /// Present when an A/B test chose what is shown: sent unchanged on the first event of
        /// every presentation of this answer and on every hand-off of it to the app, which counts
        /// the person in the test. Kept with the cached answer, and in no other encoding; it
        /// expires 30 days after the answer, and sending an expired one is harmless.
        @_spi(VoidhashFlows)
        public var exposureToken: FlowExposureToken? = nil

        public func encode(to encoder: any Encoder) throws {
            var container = encoder.container(keyedBy: CodingKeys.self)
            try container.encode(id, forKey: .id)
            try container.encode(paywall, forKey: .paywall)
            try container.encode(paywallId, forKey: .paywallId)
            try container.encode(paywallRelease, forKey: .paywallRelease)
            try container.encode(paywallReleaseId, forKey: .paywallReleaseId)
            try container.encode(startedAt, forKey: .startedAt)
            try container.encode(type, forKey: .type)
            if encoder.userInfo[.voidhashCache] as? Bool == true {
                try container.encodeIfPresent(exposureToken, forKey: .exposureToken)
            }
        }
    }

    public let location: Location
    public let showing: Showing
    /// Lowercase hex SHA-256 of flow packages the location no longer shows because they were
    /// withdrawn, newest first; never the package ``showing`` names. A device never falls back to
    /// one of them. Kept with the cached answer; absent when there are none.
    public var withdrawnPackages: [String]? = nil
}

/// Why a receipt is sent to `POST /api/v1/sdk/sync-transaction`.
///
/// ``purchase`` and ``restore`` count only with the transaction's
/// ``SdkSyncTransactionBody/signedTransaction``; without it the backend treats them as ``sync``.
public enum SdkSyncTransactionIntent: String, Codable, Sendable, Equatable {
    /// Reports a renewal, a revocation or a transaction a scan found. A receipt the backend
    /// already holds for another person is recorded for that person; ownership never moves.
    case sync
    /// An explicit restore by the user: the backend applies the project's paid access sharing
    /// setting, which can share or move the purchase to the requesting person.
    case restore
    /// A purchase the user just made: the backend gives it to the reporting person, whoever had
    /// the store account's earlier purchase. It counts only for a purchase the store made in the
    /// last 24 hours; anything else is treated as ``sync``.
    case purchase
}

/// Body of `POST /api/v1/sdk/sync-transaction`.
/// The paywall a purchase was started from, sent with it so its revenue is credited to the
/// location, paywall, release and experiment variant that sold it. The backend validates the
/// showing and derives the rest; the other fields are informational.
public struct SdkPurchasePaywallContext: Codable, Sendable, Equatable {
    /// The showing the location lookup returned.
    public let showingId: String
    public let placement: String?
    public let paywallId: String?
    public let paywallReleaseId: String?
    /// Where the flow the purchase was started from came from, when that is not Voidhash's
    /// answer: `bundled` for the flow the app ships, shown without one.
    public let source: String?

    public init(
        showingId: String, placement: String? = nil, paywallId: String? = nil,
        paywallReleaseId: String? = nil, source: String? = nil
    ) {
        self.showingId = showingId
        self.placement = placement
        self.paywallId = paywallId
        self.paywallReleaseId = paywallReleaseId
        self.source = source
    }
}

public struct SdkSyncTransactionBody: Codable, Sendable, Equatable {
    public let appAccountToken: String?
    public let platform: String
    public let providerProductId: String?
    public let productSlug: String?
    public let purchaseDate: Double?
    public let purchaseToken: String?
    public let quantity: Double?
    public let receipt: String?
    public let transactionId: String
    /// Why the receipt is sent; the backend reads an absent intent as
    /// ``SdkSyncTransactionIntent/sync``.
    public var intent: SdkSyncTransactionIntent?
    /// The transaction as StoreKit signed it on the device (its `jwsRepresentation`), which
    /// proves the device's Apple Account holds it. A ``SdkSyncTransactionIntent/purchase`` or
    /// ``SdkSyncTransactionIntent/restore`` needs it; a ``SdkSyncTransactionIntent/sync`` is sent
    /// without it.
    public var signedTransaction: String?
    /// The paywall the purchase was started from; `nil` for every other report. It is part of
    /// the queued body, so it survives retries and restarts.
    public let paywallContext: SdkPurchasePaywallContext?

    public init(
        appAccountToken: String? = nil,
        platform: String,
        providerProductId: String? = nil,
        productSlug: String? = nil,
        purchaseDate: Double? = nil,
        purchaseToken: String? = nil,
        quantity: Double? = nil,
        receipt: String? = nil,
        transactionId: String,
        intent: SdkSyncTransactionIntent? = nil,
        signedTransaction: String? = nil,
        paywallContext: SdkPurchasePaywallContext? = nil
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
        self.intent = intent
        self.signedTransaction = signedTransaction.flatMap { $0.isEmpty ? nil : $0 }
        self.paywallContext = paywallContext
    }
}

/// Response of `POST /api/v1/sdk/sync-transaction`.
public struct SdkSyncTransactionResponse: Codable, Sendable, Equatable {
    /// Whether the backend recorded the transaction.
    public let accepted: Bool

    public init(accepted: Bool) {
        self.accepted = accepted
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        accepted = try container.decode(Bool.self, forKey: .accepted)
    }
}

/// Body of `POST /api/v1/sdk/promotional-offer-signature`.
public struct SdkPromotionalOfferSignatureBody: Codable, Sendable, Equatable {
    /// The App Store product identifier.
    public let productId: String
    /// The offer as the product's App Store mapping names it: its Studio offer id.
    public let offerId: String
    /// Any App Store transaction id of the customer, such as their app transaction's, which
    /// binds the signed JWS to them. Left out rather than sent empty.
    public let transactionId: String?

    /// - Parameter transactionId: An empty one is left out.
    public init(productId: String, offerId: String, transactionId: String? = nil) {
        self.productId = productId
        self.offerId = offerId
        self.transactionId = transactionId?.isEmpty == false ? transactionId : nil
    }
}

/// A promotional offer signed with the app's In-App Purchase key, for StoreKit's
/// `promotionalOffer` purchase option. Bound to `appAccountToken`.
public struct SdkPromotionalOfferSignature: Codable, Sendable, Equatable {
    /// Apple's compact JWS of the offer, which purchases use when present; `nil` when the
    /// backend cannot sign one for the app (no issuer id), leaving the legacy signature.
    public let signatureJws: String?
    public let offerIdentifier: String
    public let keyIdentifier: String
    public let nonce: String
    /// Base64 DER ECDSA signature.
    public let signature: String
    /// Milliseconds since the Unix epoch.
    public let timestamp: Double
    public let appAccountToken: String

    public init(
        offerIdentifier: String, keyIdentifier: String, nonce: String, signature: String,
        timestamp: Double, appAccountToken: String, signatureJws: String? = nil
    ) {
        self.signatureJws = signatureJws
        self.offerIdentifier = offerIdentifier
        self.keyIdentifier = keyIdentifier
        self.nonce = nonce
        self.signature = signature
        self.timestamp = timestamp
        self.appAccountToken = appAccountToken
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
