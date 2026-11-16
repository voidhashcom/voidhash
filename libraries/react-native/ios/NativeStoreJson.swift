import Foundation
import VoidhashCore

@_spi(VoidhashHost) import Voidhash

/// The App Store payloads the Nitro contract sends as JSON, shaped exactly as the facade's
/// types in `src/core/entities/app-store.ts` declare them: StoreKit's field names, dates in
/// milliseconds since the epoch, an absent value left out, and `unknown` for a case the
/// contract does not list.
enum NativeStoreJson {
    /// A product's `appStore` part, the facade's `AppStoreProductInfo`.
    static func product(_ info: VoidhashAppStoreProductInfo) -> String {
        var object: [String: JSONValue] = [
            "isFamilyShareable": .bool(info.isFamilyShareable),
            "productType": .string(info.productType.rawValue),
            "promotionalOffers": .array(info.promotionalOffers.map(offer)),
            "winBackOffers": .array(info.winBackOffers.map(offer)),
        ]
        object["subscriptionGroupId"] = info.subscriptionGroupId.map(JSONValue.string)
        object["subscriptionGroupLevel"] = info.subscriptionGroupLevel.map { .number(Double($0)) }
        object["subscriptionGroupDisplayName"] = info.subscriptionGroupDisplayName.map(
            JSONValue.string)
        object["introductoryOffer"] = info.introductoryOffer.map(offer)
        object["isEligibleForIntroOffer"] = info.isEligibleForIntroOffer.map(JSONValue.bool)
        return encode(object)
    }

    /// A transaction's `appStore` part, the facade's `AppStoreTransactionInfo`.
    static func transaction(_ info: VoidhashAppStoreTransactionInfo) -> String {
        var object: [String: JSONValue] = [
            "ownershipType": .string(info.ownershipType.rawValue),
            "isUpgraded": .bool(info.isUpgraded),
            "jwsRepresentation": .string(info.jwsRepresentation),
        ]
        object["storefrontCountryCode"] = info.storefrontCountryCode.map(JSONValue.string)
        object["revocationDate"] = info.revocationDate.map(millis)
        object["revocationReason"] = info.revocationReason.map { reason in
            switch reason {
            case .developerIssue, .other: return .string(reason.rawValue)
            case .upgradedToBundle, .unknown: return .string("unknown")
            }
        }
        object["appTransactionId"] = info.appTransactionId.map(JSONValue.string)
        return encode(object)
    }

    /// A subscription status's renewal info, the facade's `AppStoreRenewalInfo`.
    static func renewalInfo(_ info: VoidhashAppStoreRenewalInfo) -> String {
        var object: [String: JSONValue] = [
            "willAutoRenew": .bool(info.willAutoRenew),
            "autoRenewProductId": .string(info.autoRenewProductId),
            "isInBillingRetry": .bool(info.isInBillingRetry),
            "eligibleWinBackOfferIds": .array(info.eligibleWinBackOfferIds.map(JSONValue.string)),
        ]
        object["expirationReason"] = info.expirationReason.map { .string($0.rawValue) }
        object["gracePeriodExpiresAt"] = info.gracePeriodExpiresAt.map(millis)
        object["priceIncreaseStatus"] = info.priceIncreaseStatus.map { .string($0.rawValue) }
        object["renewalPrice"] = info.renewalPrice.map(price)
        return encode(object)
    }

    /// The app transaction, the facade's `AppTransaction`.
    static func appTransaction(_ transaction: VoidhashAppTransaction) -> String {
        var object: [String: JSONValue] = [
            "originalAppVersion": .string(transaction.originalAppVersion),
            "originalPurchaseDate": millis(transaction.originalPurchaseDate),
            "environment": .string(transaction.environment.rawValue),
            "jwsRepresentation": .string(transaction.jwsRepresentation),
        ]
        object["appTransactionId"] = transaction.appTransactionId.map(JSONValue.string)
        object["originalPlatform"] = transaction.originalPlatform.map { platform in
            ["iOS", "macOS", "tvOS", "visionOS"].contains(platform)
                ? .string(platform) : .string("unknown")
        }
        return encode(object)
    }

    private static func offer(_ offer: VoidhashAppStoreOffer) -> JSONValue {
        var object: [String: JSONValue] = [
            "type": .string(
                [.introductory, .promotional, .winBack].contains(offer.type)
                    ? offer.type.rawValue : "unknown"),
            "paymentMode": .string(offer.paymentMode.rawValue),
            "period": period(offer.period),
            "periodCount": .number(Double(offer.periodCount)),
            "price": price(offer.price),
        ]
        object["id"] = offer.id.map(JSONValue.string)
        return .object(object)
    }

    /// A decimal amount as the JavaScript number nearest to it. `NSDecimalNumber.doubleValue` is
    /// not correctly rounded (49.99 becomes 49.989999999999995), so the decimal's text is parsed,
    /// as the flow configuration does.
    static func number(_ amount: Decimal) -> Double {
        return Double(amount.description) ?? NSDecimalNumber(decimal: amount).doubleValue
    }

    private static func price(_ price: VoidhashPrice) -> JSONValue {
        return .object([
            "amount": .number(number(price.amount)),
            "amountMicros": .number(Double(price.amountMicros)),
            "currencyCode": .string(price.currencyCode),
            "formatted": .string(price.formatted),
        ])
    }

    private static func period(_ period: VoidhashPeriod) -> JSONValue {
        return .object([
            "unit": .string(period.unit.rawValue),
            "count": .number(Double(period.count)),
            "iso8601": .string(period.iso8601),
        ])
    }

    /// Milliseconds since the epoch, whole: StoreKit's dates carry no finer precision.
    static func millis(_ date: Date) -> JSONValue {
        return .number((date.timeIntervalSince1970 * 1000).rounded())
    }

    private static func encode(_ object: [String: JSONValue]) -> String {
        // Every value is a string, a bool or a finite number, which always encodes.
        return VoidhashNativeClientCore.json(JSONValue.object(object)) ?? "{}"
    }
}
