import Foundation

/// App Store configuration of a product.
public struct RuntimeAppleAppStoreProductConfiguration: Codable, Sendable, Equatable {
    public let productId: String

    public init(productId: String) {
        self.productId = productId
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
public struct RuntimeProductDefinition: Codable, Sendable, Equatable {
    public let id: String?
    public let duration: String?
    public let slug: String
    public let type: String
    public let properties: RuntimeProductProperties
    public let configuration: RuntimeProductConfiguration

    public init(
        id: String? = nil,
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
