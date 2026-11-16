import Foundation

/// An offer of a product on one store, as Studio maps it.
public struct RuntimeStoreOffer: Codable, Sendable, Equatable {
    /// How paywalls, apps and Voidhash name the offer; the same on every store.
    public let id: String
    /// The store's identifier: the offer identifier in App Store Connect.
    public let offerId: String

    public init(id: String, offerId: String) {
        self.id = id
        self.offerId = offerId
    }
}

/// App Store configuration of a product.
public struct RuntimeAppleAppStoreProductConfiguration: Codable, Sendable, Equatable {
    public let productId: String
    /// The promotional offers Studio exposes, which Voidhash signs. An entry without both ids is
    /// left out.
    public let offers: [RuntimeStoreOffer]

    public init(productId: String, offers: [RuntimeStoreOffer] = []) {
        self.productId = productId
        self.offers = offers
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        productId = try container.decode(String.self, forKey: .productId)
        offers =
            (try? container.decodeIfPresent([LenientOffer].self, forKey: .offers))?
            .compactMap { offer in
                guard let id = offer.id, !id.isEmpty, let offerId = offer.offerId,
                    !offerId.isEmpty
                else {
                    return nil
                }
                return RuntimeStoreOffer(id: id, offerId: offerId)
            } ?? []
    }

    /// An `offers` entry read without failing the schema over one that is malformed.
    private struct LenientOffer: Decodable {
        let id: String?
        let offerId: String?

        init(from decoder: Decoder) throws {
            let container = try? decoder.container(keyedBy: CodingKeys.self)
            id = try? container?.decodeIfPresent(String.self, forKey: .id)
            offerId = try? container?.decodeIfPresent(String.self, forKey: .offerId)
        }

        enum CodingKeys: String, CodingKey {
            case id, offerId
        }
    }
}

/// Google Play configuration of a product.
public struct RuntimeGooglePlayProductConfiguration: Codable, Sendable, Equatable {
    public let productId: String
    public let basePlanId: String?

    public init(productId: String, basePlanId: String? = nil) {
        self.productId = productId
        self.basePlanId = basePlanId
    }
}

/// Development-provider configuration of a product, used by the mock store.
public struct RuntimeDevelopmentProductConfiguration: Codable, Sendable, Equatable {
    public let currencyCode: String
    public let duration: String?
    public let period: String
    public let periodCount: Double
    public let price: Double
    public let priceInMinorUnits: Double
    public let productId: String
    public let warning: String?

    public init(
        currencyCode: String,
        duration: String?,
        period: String,
        periodCount: Double,
        price: Double,
        priceInMinorUnits: Double,
        productId: String,
        warning: String?
    ) {
        self.currencyCode = currencyCode
        self.duration = duration
        self.period = period
        self.periodCount = periodCount
        self.price = price
        self.priceInMinorUnits = priceInMinorUnits
        self.productId = productId
        self.warning = warning
    }
}

/// Per-provider configuration of a product.
public struct RuntimeProductProviders: Codable, Sendable, Equatable {
    public let appleAppStore: RuntimeAppleAppStoreProductConfiguration?
    public let development: RuntimeDevelopmentProductConfiguration?
    public let googlePlay: RuntimeGooglePlayProductConfiguration?

    public init(
        appleAppStore: RuntimeAppleAppStoreProductConfiguration? = nil,
        development: RuntimeDevelopmentProductConfiguration? = nil,
        googlePlay: RuntimeGooglePlayProductConfiguration? = nil
    ) {
        self.appleAppStore = appleAppStore
        self.development = development
        self.googlePlay = googlePlay
    }
}

/// Configuration block of a product definition.
public struct RuntimeProductConfiguration: Codable, Sendable, Equatable {
    public let providers: RuntimeProductProviders
    public let perks: [String: Bool]

    public init(providers: RuntimeProductProviders, perks: [String: Bool] = [:]) {
        self.providers = providers
        self.perks = perks
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        providers = try container.decode(RuntimeProductProviders.self, forKey: .providers)
        perks = try container.decodeIfPresent([String: Bool].self, forKey: .perks) ?? [:]
    }
}

/// Human readable properties of a product definition.
public struct RuntimeProductProperties: Codable, Sendable, Equatable {
    public let name: String

    public init(name: String) {
        self.name = name
    }
}

/// A product as configured in the dashboard.
///
/// Decoding requires ``id``: a schema cached before the backend sent it is undecodable, so the
/// cache discards it and the schema is fetched again.
public struct RuntimeProductDefinition: Codable, Sendable, Equatable {
    /// The Voidhash product id, which person snapshots name subscriptions and purchases by.
    public let id: String
    public let duration: String?
    public let slug: String
    public let type: String
    public let properties: RuntimeProductProperties
    public let configuration: RuntimeProductConfiguration

    public init(
        id: String,
        duration: String? = nil,
        slug: String,
        type: String,
        properties: RuntimeProductProperties,
        configuration: RuntimeProductConfiguration
    ) {
        self.id = id
        self.duration = duration
        self.slug = slug
        self.type = type
        self.properties = properties
        self.configuration = configuration
    }
}

/// A paywall location as configured in the dashboard.
public struct RuntimePaywallLocationDefinition: Codable, Sendable, Equatable {
    public let slug: String
    public let name: String
    public let description: String?

    public init(slug: String, name: String, description: String? = nil) {
        self.slug = slug
        self.name = name
        self.description = description
    }
}

/// The runtime schema fetched from `/api/v1/sdk/schema`, keyed by slug.
///
/// Mirrors `src/core/schema/runtime.ts`; `version` is the server-side schema hash.
public struct RuntimeSchema: Codable, Sendable, Equatable {
    public let version: String
    public let products: [String: RuntimeProductDefinition]
    public let locations: [String: RuntimePaywallLocationDefinition]

    public init(
        version: String,
        products: [String: RuntimeProductDefinition] = [:],
        locations: [String: RuntimePaywallLocationDefinition] = [:]
    ) {
        self.version = version
        self.products = products
        self.locations = locations
    }

    /// Schema served when nothing has ever been fetched and the backend is unreachable.
    ///
    /// A cold-cache offline launch resolves to this rather than failing: analytics, identity and
    /// flags all work without it, and it is replaced by the first successful refresh.
    public static let empty = RuntimeSchema(version: "")

    /// Whether this is the ``empty`` placeholder rather than a schema the backend served.
    public var isEmpty: Bool {
        return version.isEmpty && products.isEmpty && locations.isEmpty
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        version = try container.decode(String.self, forKey: .version)
        products =
            try container.decodeIfPresent(
                [String: RuntimeProductDefinition].self, forKey: .products) ?? [:]
        locations =
            try container.decodeIfPresent(
                [String: RuntimePaywallLocationDefinition].self, forKey: .locations) ?? [:]
    }

    /// The App Store product id configured for `slug`, if any.
    public func appleProductId(forSlug slug: String) -> String? {
        return products[slug]?.configuration.providers.appleAppStore?.productId
    }
}
