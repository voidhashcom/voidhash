import Foundation
import VoidhashCore

/// Billing period of a ``PaywallRuntimeConfigProduct`` (deploy contract §7.1).
public enum PaywallRuntimeConfigProductPeriod: String, Codable, Sendable, Equatable {
    case month
    case year
    case week
    case lifetime
}

/// A purchasable product surfaced to a paywall bundle (deploy contract §7.1).
///
/// `priceString` is the locale-correct formatted price straight from the store.
public struct PaywallRuntimeConfigProduct: Codable, Sendable, Equatable {
    public let id: String
    public let slug: String
    public let displayName: String
    public let description: String?
    public let price: Double?
    public let priceString: String
    public let currencyCode: String?
    public let period: PaywallRuntimeConfigProductPeriod?
    public let trialPeriod: String?

    public init(
        id: String,
        slug: String,
        displayName: String,
        description: String? = nil,
        price: Double? = nil,
        priceString: String,
        currencyCode: String? = nil,
        period: PaywallRuntimeConfigProductPeriod? = nil,
        trialPeriod: String? = nil
    ) {
        self.id = id
        self.slug = slug
        self.displayName = displayName
        self.description = description
        self.price = price
        self.priceString = priceString
        self.currencyCode = currencyCode
        self.period = period
        self.trialPeriod = trialPeriod
    }
}

/// Everything a code-release paywall bundle needs at runtime beyond its own tree
/// (deploy contract §7.1). Delivered in a `configure` envelope after the bundle's `ready`.
public struct PaywallRuntimeConfig: Codable, Sendable, Equatable {
    public let products: [PaywallRuntimeConfigProduct]
    public let variables: [String: JSONValue]
    public let locale: String?
    public let platform: String?
    public let defaultSelectedProductId: String?

    public init(
        products: [PaywallRuntimeConfigProduct],
        variables: [String: JSONValue],
        locale: String? = nil,
        platform: String? = nil,
        defaultSelectedProductId: String? = nil
    ) {
        self.products = products
        self.variables = variables
        self.locale = locale
        self.platform = platform
        self.defaultSelectedProductId = defaultSelectedProductId
    }
}

/// Builds the `configure` payload for a code-release paywall.
///
/// Port of `src/core/paywalls/paywall-runtime-config.ts`: product slugs that did not resolve in
/// the store are skipped and an empty product list is valid.
public enum PaywallRuntimeConfigBuilder {
    private static let periodByNormalizedInterval: [String: PaywallRuntimeConfigProductPeriod] = [
        // ISO-8601 billing periods (Play Billing `billingPeriod`).
        "p1m": .month,
        "p1y": .year,
        "p1w": .week,
        "p7d": .week,
        // Keyword variants seen across store SDK surfaces.
        "month": .month,
        "monthly": .month,
        "year": .year,
        "yearly": .year,
        "annual": .year,
        "week": .week,
        "weekly": .week,
        "lifetime": .lifetime,
    ]

    /// Maps a native store billing-interval string (StoreKit subscription period unit or Play
    /// Billing ISO-8601 `billingPeriod`) onto the contract period union.
    ///
    /// - Returns: `nil` for unknown or missing intervals — `period` is optional on the wire.
    public static func mapStoreIntervalToPeriod(_ interval: String?)
        -> PaywallRuntimeConfigProductPeriod?
    {
        guard let interval, !interval.isEmpty else {
            return nil
        }
        let normalized = interval.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return periodByNormalizedInterval[normalized]
    }

    /// Builds the runtime config for a release from its runtime block and the resolved products.
    ///
    /// - Parameters:
    ///   - runtime: The release's `runtime` block (product slugs + author variables).
    ///   - productsBySlug: Products resolved from the store, keyed by dashboard slug.
    ///   - platform: Reported platform; `nil` when unknown.
    ///   - locale: Locale identifier reported to the bundle.
    ///   - onSkippedProductSlug: Called for every slug that did not resolve in the store.
    public static func build(
        runtime: SdkResolvedPaywall.Runtime,
        productsBySlug: [String: VoidhashProduct],
        platform: String?,
        locale: String?,
        onSkippedProductSlug: ((String) -> Void)? = nil
    ) -> PaywallRuntimeConfig {
        var products: [PaywallRuntimeConfigProduct] = []

        for slug in runtime.productSlugs {
            guard let product = productsBySlug[slug] else {
                onSkippedProductSlug?(slug)
                continue
            }
            products.append(runtimeConfigProduct(product))
        }

        return PaywallRuntimeConfig(
            products: products,
            variables: runtime.variables,
            locale: locale,
            platform: platform,
            defaultSelectedProductId: products.first?.id
        )
    }

    private static func runtimeConfigProduct(_ product: VoidhashProduct)
        -> PaywallRuntimeConfigProduct
    {
        return PaywallRuntimeConfigProduct(
            id: product.id,
            slug: product.slug,
            displayName: product.displayName,
            description: product.description.isEmpty ? nil : product.description,
            price: product.price.isFinite ? product.price : nil,
            priceString: product.displayPrice,
            currencyCode: product.currency.isEmpty ? nil : product.currency,
            period: mapStoreIntervalToPeriod(product.interval),
            // Trial metadata isn't surfaced by the store engine yet.
            trialPeriod: nil
        )
    }
}
