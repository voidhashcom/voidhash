import Foundation
import StoreKit
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
    /// The renewing subscription's billing period: `day`, `week`, `month` or `year`, and how many
    /// of them; absent for anything else.
    var periodUnit: String? = nil
    var periodCount: Int? = nil
    /// The regular price per week, month and year, as ``VoidhashSubscriptionInfo`` computes them,
    /// with their text; subscriptions only.
    var pricePerWeek: Double? = nil
    var pricePerWeekString: String? = nil
    var pricePerMonth: Double? = nil
    var pricePerMonthString: String? = nil
    var pricePerYear: Double? = nil
    var pricePerYearString: String? = nil
    /// The product's introductory offer whether or not the user can have it: kind `none` when it
    /// has none; absent when that is not known.
    var introOffer: FlowConfigurationIntroOffer? = nil
    /// Whether the user can have the introductory offer now: StoreKit's
    /// `isEligibleForIntroOffer(for:)` for the Apple Account and subscription group, known before
    /// any purchase; `false` without an offer; absent when StoreKit gave no answer.
    var introEligible: Bool? = nil
    /// What the user saves a year with this product against each other configured subscription
    /// in the same currency, by that product's id; negative when this one costs more.
    var savings: [String: FlowConfigurationSaving]? = nil
}

/// An introductory offer as a flow reads it, from the offer's first pricing phase.
struct FlowConfigurationIntroOffer: Codable, Sendable, Equatable {
    /// `none`, `free-trial`, `pay-as-you-go` or `pay-up-front`.
    let kind: String
    /// What one cycle costs, 0 for a free trial, and the store's text for it.
    var price: Double? = nil
    var priceString: String? = nil
    /// The length of one cycle.
    var periodUnit: String? = nil
    var periodCount: Int? = nil
    /// How many cycles the phase lasts.
    var periods: Int? = nil
}

/// A yearly difference in price between two subscriptions.
struct FlowConfigurationSaving: Codable, Sendable, Equatable {
    let amount: Double
    /// ``amount`` formatted as the store formats its prices.
    let amountString: String
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
    /// The status of each permission the app lets flows ask for, by name.
    var permissions: [String: String]? = nil

    /// Offers `products` in order, the first selected by default.
    static func make(
        products: [VoidhashProduct],
        capabilities: Set<FlowCapability>,
        input: [String: FlowValue] = [:],
        savedVariables: [String: JSONValue]?,
        platform: String?,
        locale: String?
    ) -> FlowConfiguration {
        let configured = entries(for: products)
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

    /// `products` as a flow reads them, in `configure` and in the `products` message that
    /// sends them again; each one's savings are against the others of `products`.
    static func entries(for products: [VoidhashProduct]) -> [FlowConfigurationProduct] {
        return products.map { product -> FlowConfigurationProduct in
            var entry = FlowConfigurationProduct(
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
            if let subscription = product.subscription {
                entry.periodUnit = subscription.period.unit.rawValue
                entry.periodCount = subscription.period.count
                entry.pricePerWeek = Double(subscription.pricePerWeek.amount.description)
                entry.pricePerWeekString = subscription.pricePerWeek.formatted
                entry.pricePerMonth = Double(subscription.pricePerMonth.amount.description)
                entry.pricePerMonthString = subscription.pricePerMonth.formatted
                entry.pricePerYear = Double(subscription.pricePerYear.amount.description)
                entry.pricePerYearString = subscription.pricePerYear.formatted
            }
            (entry.introOffer, entry.introEligible) = introOffer(of: product)
            entry.savings = savings(of: product, against: products)
            return entry
        }
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

    /// `product`'s introductory offer, from the App Store's description of it whether or not the
    /// user can have it, and whether they can. A product that is not a subscription, and a
    /// development store product, have none.
    static func introOffer(of product: VoidhashProduct) -> (FlowConfigurationIntroOffer?, Bool?) {
        let none = FlowConfigurationIntroOffer(kind: "none")
        guard product.subscription != nil, product.store == .appStore else {
            return (none, false)
        }
        guard let appStore = product.appStore else {
            return (nil, nil)
        }
        guard let offer = appStore.introductoryOffer?.offer else {
            return (none, false)
        }
        let eligible = appStore.isEligibleForIntroOffer
        guard let phase = offer.phases.first else {
            return (nil, eligible)
        }
        let kind: String
        switch phase.paymentMode {
        case .freeTrial: kind = "free-trial"
        case .payAsYouGo: kind = "pay-as-you-go"
        case .payUpFront: kind = "pay-up-front"
        case .unknown: return (nil, eligible)
        }
        return (
            FlowConfigurationIntroOffer(
                kind: kind, price: Double(phase.price.amount.description),
                priceString: phase.price.formatted, periodUnit: phase.period.unit.rawValue,
                periodCount: phase.period.count, periods: phase.cycles),
            eligible
        )
    }

    /// What `product` saves a year against each other subscription of `products` priced in the
    /// same currency, by its slug; `nil` when none is.
    static func savings(of product: VoidhashProduct, against products: [VoidhashProduct])
        -> [String: FlowConfigurationSaving]?
    {
        guard let perYear = product.subscription?.pricePerYear, !perYear.currencyCode.isEmpty
        else {
            return nil
        }
        // As the store formats its prices: the storefront's style, or the development store's.
        let format = VoidhashPrice.formatter(
            product.appStore?.storeKitProduct?.priceFormatStyle
                ?? Decimal.FormatStyle.Currency(code: perYear.currencyCode))
        var savings: [String: FlowConfigurationSaving] = [:]
        for other in products where other.slug != product.slug {
            guard let otherPerYear = other.subscription?.pricePerYear,
                otherPerYear.currencyCode == perYear.currencyCode
            else {
                continue
            }
            // Exact: both are already rounded to the currency's minor units.
            let amount = otherPerYear.amount - perYear.amount
            guard let value = Double(amount.description) else {
                continue
            }
            savings[other.slug] = FlowConfigurationSaving(amount: value, amountString: format(amount))
        }
        return savings.isEmpty ? nil : savings
    }
}
