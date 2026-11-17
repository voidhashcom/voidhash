import Foundation
import VoidhashCore

/// A purchasable product as a flow reads it: `{price}`, `{title}` and `{period}` placeholders
/// resolve against these fields.
struct FlowConfigurationProduct: Codable, Sendable, Equatable {
    /// The product's slug, which flows name products by.
    let id: String
    let slug: String
    let displayName: String
    let description: String?
    let price: Double?
    /// The locale-correct formatted price straight from the store.
    let priceString: String
    let currencyCode: String?
    /// `month` for one month, `3 months` for more; `lifetime` for a development lifetime
    /// product; absent for a one-time product.
    let period: String?
    /// The free trial the user can have, `1 week`, `3 days`; absent without one.
    let trialPeriod: String?
}

/// Variables saved from an earlier presentation of the same flow.
struct FlowSavedState: Codable, Sendable, Equatable {
    let variables: [String: JSONValue]
}

/// The payload of the `configure` envelope a flow receives after `ready`.
struct FlowConfiguration: Codable, Sendable, Equatable {
    var products: [FlowConfigurationProduct]
    var variables: [String: JSONValue]
    /// The app's inputs by name.
    var input: [String: FlowValue]
    var locale: String?
    var platform: String?
    var defaultSelectedProductId: String?
    /// Wire names of the capabilities the app granted.
    var capabilities: [String]
    var state: FlowSavedState?

    /// Offers `products` in order, the first selected by default.
    static func make(
        products: [VoidhashProduct],
        capabilities: Set<FlowCapability>,
        input: [String: FlowValue] = [:],
        savedVariables: [String: JSONValue]?,
        platform: String?,
        locale: String?
    ) -> FlowConfiguration {
        let configured = products.map { product in
            FlowConfigurationProduct(
                id: product.slug,
                slug: product.slug,
                displayName: product.displayName,
                description: product.description.isEmpty ? nil : product.description,
                // Through its decimal text: a conversion of the decimal itself can land off the
                // nearest double, 59.989999 for 59.99.
                price: Double(product.price.amount.description),
                priceString: product.price.formatted,
                currencyCode: product.price.currencyCode.isEmpty ? nil : product.price.currencyCode,
                period: period(of: product),
                trialPeriod: product.subscription?.introOffer?.freeTrial?.description
            )
        }
        return FlowConfiguration(
            products: configured,
            variables: [:],
            input: input,
            locale: locale,
            platform: platform,
            defaultSelectedProductId: configured.first?.id,
            capabilities: capabilities.map(\.rawValue).sorted(),
            state: savedVariables.map(FlowSavedState.init(variables:))
        )
    }

    /// How a flow names `product`'s billing period: the unit alone for one unit (`month`, as
    /// every flow published before counts expect), the count and the unit otherwise
    /// (`3 months`), `lifetime` for a development product whose development configuration's
    /// period is `lifetime`, `nil` for any other one-time product.
    static func period(of product: VoidhashProduct) -> String? {
        guard let period = product.subscription?.period else {
            return product.isDevelopmentLifetime ? "lifetime" : nil
        }
        return period.count == 1 ? period.unit.rawValue : period.description
    }
}
