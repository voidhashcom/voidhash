import Foundation

/// An amount of money as a store states it.
public struct VoidhashPrice: Sendable, Hashable {
    /// The amount in ``currencyCode``, exact.
    public let amount: Decimal
    /// ``amount`` in millionths of the currency unit.
    public let amountMicros: Int64
    /// ISO 4217 currency code.
    public let currencyCode: String
    /// The amount as the store formats it for the user's storefront. Show it as it is.
    public let formatted: String

    public init(amount: Decimal, currencyCode: String, formatted: String) {
        self.amount = amount
        self.amountMicros = Self.micros(of: amount)
        self.currencyCode = currencyCode
        self.formatted = formatted
    }

    /// A price of nothing, as a free trial costs, formatted as `formatted`.
    public static func zero(currencyCode: String, formatted: String) -> VoidhashPrice {
        return VoidhashPrice(amount: 0, currencyCode: currencyCode, formatted: formatted)
    }

    /// What this price, charged once every `period`, comes to per one `unit`.
    ///
    /// The price is scaled by the length of a `unit` over the length of `period`, counting a year
    /// as 365 days, 52 weeks or 12 months, and rounded half up to the currency's minor units:
    /// 49.99 a year is 4.17 a month, 0.96 a week and 0.14 a day. The other SDKs compute the same
    /// values, so a paywall shows the same per-month price on every platform.
    ///
    /// - Parameter format: Formats the result as the store formats its prices.
    public func per(
        _ unit: VoidhashPeriod.Unit, of period: VoidhashPeriod, format: (Decimal) -> String
    ) -> VoidhashPrice {
        var scaled =
            amount * Decimal(period.unit.unitsPerYear)
            / (Decimal(unit.unitsPerYear) * Decimal(period.count))
        var rounded = Decimal()
        NSDecimalRound(&rounded, &scaled, Self.minorUnits(of: currencyCode), .plain)
        return VoidhashPrice(amount: rounded, currencyCode: currencyCode, formatted: format(rounded))
    }

    /// How many decimal places amounts in `currencyCode` take, as ISO 4217 sets them: 2 for USD,
    /// HUF, RSD and IDR, 0 for JPY, 3 for KWD and IQD; 2 for a code it does not list.
    ///
    /// A table rather than the system's currency data, which is CLDR's: it gives fewer places for
    /// a number of currencies, 0 for HUF, IDR, RSD, IQD and LBP among others. The Android SDK
    /// holds the same table, as a device's `java.util.Currency` reads CLDR too, so both compute
    /// the same per-unit prices.
    public static func minorUnits(of currencyCode: String) -> Int {
        return iso4217MinorUnits[currencyCode.uppercased()] ?? 2
    }

    /// Formats amounts the SDK computes, such as per-unit prices, as `style` formats the store's
    /// prices, but to ``minorUnits(of:)`` places: the system's formatter would show 4.17 RSD as
    /// `RSD 4`. The Android SDK formats them to the same places.
    public static func formatter(_ style: Decimal.FormatStyle.Currency) -> (Decimal) -> String {
        let style = style.precision(.fractionLength(minorUnits(of: style.currencyCode)))
        return { $0.formatted(style) }
    }

    /// The ISO 4217 currencies whose minor unit is not 2; the Android SDK's table has the same
    /// entries.
    private static let iso4217MinorUnits: [String: Int] = [
        "BIF": 0, "CLP": 0, "DJF": 0, "GNF": 0, "ISK": 0, "JPY": 0, "KMF": 0, "KRW": 0,
        "PYG": 0, "RWF": 0, "UGX": 0, "UYI": 0, "VND": 0, "VUV": 0, "XAF": 0, "XOF": 0,
        "XPF": 0,
        "BHD": 3, "IQD": 3, "JOD": 3, "KWD": 3, "LYD": 3, "OMR": 3, "TND": 3,
        "CLF": 4, "UYW": 4,
    ]

    private static func micros(of amount: Decimal) -> Int64 {
        var scaled = amount * 1_000_000
        var whole = Decimal()
        NSDecimalRound(&whole, &scaled, 0, .plain)
        return NSDecimalNumber(decimal: whole).int64Value
    }
}

/// A length of time a subscription or an offer runs for, such as one month or three days.
///
/// A count of days divisible by 7 is kept as weeks, since StoreKit may report a week as 7 days,
/// so equal lengths compare equal and print the same.
public struct VoidhashPeriod: Sendable, Hashable, CustomStringConvertible {
    public enum Unit: String, Sendable, CaseIterable {
        case day
        case week
        case month
        case year

        /// How many of this unit make a year, for converting prices between periods.
        var unitsPerYear: Int {
            switch self {
            case .day: return 365
            case .week: return 52
            case .month: return 12
            case .year: return 1
            }
        }

        var iso8601Designator: Character {
            switch self {
            case .day: return "D"
            case .week: return "W"
            case .month: return "M"
            case .year: return "Y"
            }
        }
    }

    public let unit: Unit
    /// How many ``unit``s, at least 1.
    public let count: Int

    /// - Parameter count: Raised to 1 when lower.
    public init(unit: Unit, count: Int) {
        let count = max(count, 1)
        if unit == .day, count % 7 == 0 {
            self.unit = .week
            self.count = count / 7
        } else {
            self.unit = unit
            self.count = count
        }
    }

    /// Reads a period in the ISO 8601 form stores use: `P1W`, `P3M`, `P1Y`, `P7D`. `nil` for
    /// anything else, combined forms such as `P1Y2M` included.
    public init?(iso8601: String) {
        let text = iso8601.uppercased()
        guard text.count >= 3, text.first == "P", let designator = text.last,
            let unit = Unit.allCases.first(where: { $0.iso8601Designator == designator }),
            let count = Int(text.dropFirst().dropLast()), count >= 1
        else {
            return nil
        }
        self.init(unit: unit, count: count)
    }

    /// The period in ISO 8601, `P1W`, `P3M`: what Google Play's `billingPeriod` holds.
    public var iso8601: String {
        return "P\(count)\(unit.iso8601Designator)"
    }

    /// `1 month`, `3 days`.
    public var description: String {
        return "\(count) \(unit.rawValue)\(count == 1 ? "" : "s")"
    }
}

/// How the user pays during an offer.
public enum VoidhashPaymentMode: String, Sendable, Hashable {
    /// Nothing, for the offer's duration.
    case freeTrial
    /// A reduced price every period of the offer.
    case payAsYouGo
    /// A reduced price once, for the whole offer.
    case payUpFront
    /// A payment mode this SDK version does not know.
    case unknown
}

/// One stretch of a subscription offer at one price, such as a free week or three months at
/// half price.
public struct VoidhashPricingPhase: Sendable, Hashable {
    public let paymentMode: VoidhashPaymentMode
    /// What one cycle costs; zero for a free trial.
    public let price: VoidhashPrice
    /// The length of one cycle.
    public let period: VoidhashPeriod
    /// How many cycles the phase lasts, at least 1.
    public let cycles: Int

    public init(
        paymentMode: VoidhashPaymentMode, price: VoidhashPrice, period: VoidhashPeriod, cycles: Int
    ) {
        self.paymentMode = paymentMode
        self.price = price
        self.period = period
        self.cycles = max(cycles, 1)
    }

    /// The whole phase: its period times its cycles, `7 days` as `1 week`.
    public var duration: VoidhashPeriod {
        return VoidhashPeriod(unit: period.unit, count: period.count * cycles)
    }
}

/// What kind of offer a product or a transaction has.
public enum VoidhashOfferKind: String, Sendable, Hashable {
    /// A free trial or introductory price for new subscribers.
    case introductory
    /// An offer the app chooses whom to show, such as a discount for lapsed subscribers.
    case promotional
    /// An App Store win-back offer for a former subscriber.
    case winBack
    /// A discounted one-time purchase.
    case oneTime
    /// An offer code the user redeemed; transactions only.
    case code
    /// An offer kind this SDK version does not know.
    case unknown
}

/// A way to buy a product at other than its regular price.
public struct VoidhashOffer: Sendable, Hashable {
    /// The store's offer identifier. Empty for an App Store introductory offer, which has none.
    public let id: String
    public let kind: VoidhashOfferKind
    /// For a subscription offer, the phases before the regular price, in order; empty for a
    /// one-time offer.
    public let phases: [VoidhashPricingPhase]
    /// What a one-time offer costs; `nil` for a subscription offer.
    public let price: VoidhashPrice?

    public init(
        id: String, kind: VoidhashOfferKind, phases: [VoidhashPricingPhase],
        price: VoidhashPrice? = nil
    ) {
        self.id = id
        self.kind = kind
        self.phases = phases
        self.price = price
    }

    /// The free trial the offer starts with, as long as it lasts in total; `nil` when its first
    /// phase is not free.
    public var freeTrial: VoidhashPeriod? {
        guard let first = phases.first, first.paymentMode == .freeTrial else {
            return nil
        }
        return first.duration
    }
}

/// What a subscription renews at, and the introductory offer the user can have.
public struct VoidhashSubscriptionInfo: Sendable, Hashable {
    /// How long one renewal lasts.
    public let period: VoidhashPeriod
    /// The App Store subscription group; for a development store product, its development
    /// product id.
    public let groupId: String
    /// The free trial or introductory price the user is eligible for right now; `nil` when they
    /// are not, or the product has none.
    public let introOffer: VoidhashOffer?
    /// The regular price as a price per day, see ``VoidhashPrice/per(_:of:format:)``.
    public let pricePerDay: VoidhashPrice
    public let pricePerWeek: VoidhashPrice
    public let pricePerMonth: VoidhashPrice
    public let pricePerYear: VoidhashPrice

    /// - Parameters:
    ///   - price: The regular price, charged once every `period`.
    ///   - format: Formats a per-unit price as the store formats its prices.
    public init(
        period: VoidhashPeriod, groupId: String, introOffer: VoidhashOffer?, price: VoidhashPrice,
        format: (Decimal) -> String
    ) {
        self.period = period
        self.groupId = groupId
        self.introOffer = introOffer
        pricePerDay = price.per(.day, of: period, format: format)
        pricePerWeek = price.per(.week, of: period, format: format)
        pricePerMonth = price.per(.month, of: period, format: format)
        pricePerYear = price.per(.year, of: period, format: format)
    }
}
