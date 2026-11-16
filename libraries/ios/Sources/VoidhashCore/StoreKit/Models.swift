import Foundation
import StoreKit

#if canImport(UIKit)
    import UIKit
#endif

/// The store environment a transaction was made in.
public enum VoidhashEnvironment: String, Sendable, Hashable {
    case production
    case sandbox
    /// A local StoreKit configuration in Xcode, which the App Store cannot verify.
    case xcode
    /// Voidhash's development store, which charges nothing.
    case development
    /// An environment this SDK version does not know.
    case unknown

    /// The environment StoreKit names `Production`, `Sandbox` or `Xcode`.
    init(appStoreRawValue: String) {
        switch appStoreRawValue.lowercased() {
        case "production": self = .production
        case "sandbox": self = .sandbox
        case "xcode": self = .xcode
        default: self = .unknown
        }
    }
}

/// The kind of App Store product, as App Store Connect sets it.
public enum VoidhashAppStoreProductType: String, Sendable, Hashable {
    case consumable
    case nonConsumable
    case autoRenewable
    case nonRenewable
    /// A product type this SDK version does not know.
    case unknown
}

/// A subscription offer exactly as the App Store describes it, whether or not the user can
/// have it.
public struct VoidhashAppStoreOffer: Sendable, Hashable {
    /// The offer identifier in App Store Connect; `nil` for an introductory offer.
    public let id: String?
    /// ``VoidhashOfferKind/introductory``, ``VoidhashOfferKind/promotional`` or
    /// ``VoidhashOfferKind/winBack``.
    public let type: VoidhashOfferKind
    public let paymentMode: VoidhashPaymentMode
    /// For pay as you go and free trials the length of one period, for pay up front the whole
    /// offer.
    public let period: VoidhashPeriod
    /// How many ``period``s the offer lasts.
    public let periodCount: Int
    /// What one period costs; for pay up front, the whole offer.
    public let price: VoidhashPrice

    public init(
        id: String?, type: VoidhashOfferKind, paymentMode: VoidhashPaymentMode,
        period: VoidhashPeriod, periodCount: Int, price: VoidhashPrice
    ) {
        self.id = id
        self.type = type
        self.paymentMode = paymentMode
        self.period = period
        self.periodCount = periodCount
        self.price = price
    }

    /// The offer as the SDKs describe offers on every store: one pricing phase lasting
    /// ``periodCount`` cycles of ``period``.
    public var offer: VoidhashOffer {
        let phasePrice =
            paymentMode == .freeTrial
            ? VoidhashPrice.zero(currencyCode: price.currencyCode, formatted: price.formatted)
            : price
        return VoidhashOffer(
            id: id ?? "", kind: type,
            phases: [
                VoidhashPricingPhase(
                    paymentMode: paymentMode, price: phasePrice, period: period,
                    cycles: periodCount)
            ])
    }
}

/// What the App Store says about a product, for a custom purchase screen that needs more than
/// the SDK's own fields.
public struct VoidhashAppStoreProductInfo: Sendable, Hashable {
    /// The StoreKit product, for StoreKit's own views and APIs. `nil` only for a product built
    /// by hand, such as in a test.
    public let storeKitProduct: Product?
    public let subscriptionGroupId: String?
    /// The product's rank in its subscription group; from iOS 16.4.
    public let subscriptionGroupLevel: Int?
    /// From iOS 16.4.
    public let subscriptionGroupDisplayName: String?
    public let isFamilyShareable: Bool
    public let productType: VoidhashAppStoreProductType
    /// The introductory offer, whether or not the user is eligible for it.
    public let introductoryOffer: VoidhashAppStoreOffer?
    /// Every promotional offer, whether or not the user can have it.
    public let promotionalOffers: [VoidhashAppStoreOffer]
    /// Every win-back offer, whether or not the user can have it; empty before iOS 18.
    public let winBackOffers: [VoidhashAppStoreOffer]
    /// Whether the user can have the subscription group's introductory offer; `nil` for a
    /// product that is not a subscription.
    public let isEligibleForIntroOffer: Bool?

    public init(
        storeKitProduct: Product?, subscriptionGroupId: String?, subscriptionGroupLevel: Int?,
        subscriptionGroupDisplayName: String?, isFamilyShareable: Bool,
        productType: VoidhashAppStoreProductType, introductoryOffer: VoidhashAppStoreOffer?,
        promotionalOffers: [VoidhashAppStoreOffer], winBackOffers: [VoidhashAppStoreOffer],
        isEligibleForIntroOffer: Bool?
    ) {
        self.storeKitProduct = storeKitProduct
        self.subscriptionGroupId = subscriptionGroupId
        self.subscriptionGroupLevel = subscriptionGroupLevel
        self.subscriptionGroupDisplayName = subscriptionGroupDisplayName
        self.isFamilyShareable = isFamilyShareable
        self.productType = productType
        self.introductoryOffer = introductoryOffer
        self.promotionalOffers = promotionalOffers
        self.winBackOffers = winBackOffers
        self.isEligibleForIntroOffer = isEligibleForIntroOffer
    }
}

/// A product as the App Store sells it to the current user: its price and the offers they can
/// have.
public struct StoreKitProductInfo: Sendable, Equatable {
    /// The App Store product identifier.
    public let id: String
    public let displayName: String
    public let description: String
    /// The regular price.
    public let price: VoidhashPrice
    /// `nil` for a product that does not renew.
    public let subscription: VoidhashSubscriptionInfo?
    /// The promotional and win-back offers the user can have, see
    /// ``init(id:displayName:description:price:subscriptionPeriod:appStore:eligibleWinBackOfferIds:isCurrentOrFormerSubscriber:format:)``.
    public let offers: [VoidhashOffer]
    public let appStore: VoidhashAppStoreProductInfo

    /// A product with the offers the user can have:
    ///
    /// - The introductory offer only while the user is eligible for it.
    /// - Promotional offers only to a current or former subscriber of the group, as the App
    ///   Store sells them: one no longer eligible for the introductory offer, or one the App
    ///   Store has a subscription status for. The App Store keeps a subscriber who never
    ///   redeemed an introductory offer eligible for it, so eligibility alone misses them.
    /// - Win-back offers the App Store lists as eligible in the user's renewal information.
    ///
    /// - Parameters:
    ///   - subscriptionPeriod: How long one renewal lasts; `nil` for a product that does not
    ///     renew.
    ///   - eligibleWinBackOfferIds: The win-back offers the App Store says the user can have.
    ///   - isCurrentOrFormerSubscriber: Whether the App Store has a subscription status for the
    ///     user in the product's group.
    ///   - format: Formats an amount as the store formats its prices.
    public init(
        id: String, displayName: String, description: String, price: VoidhashPrice,
        subscriptionPeriod: VoidhashPeriod?, appStore: VoidhashAppStoreProductInfo,
        eligibleWinBackOfferIds: Set<String>, isCurrentOrFormerSubscriber: Bool = false,
        format: (Decimal) -> String
    ) {
        self.id = id
        self.displayName = displayName
        self.description = description
        self.price = price
        self.appStore = appStore
        let introOffer =
            appStore.isEligibleForIntroOffer == true ? appStore.introductoryOffer?.offer : nil
        subscription = subscriptionPeriod.map { period in
            VoidhashSubscriptionInfo(
                period: period, groupId: appStore.subscriptionGroupId ?? "",
                introOffer: introOffer, price: price, format: format)
        }
        let promotional =
            appStore.isEligibleForIntroOffer == false || isCurrentOrFormerSubscriber
            ? appStore.promotionalOffers : []
        let winBack = appStore.winBackOffers.filter { offer in
            offer.id.map(eligibleWinBackOfferIds.contains) ?? false
        }
        offers = (promotional + winBack).map(\.offer)
    }
}

/// The App Store's side of a transaction.
public struct VoidhashAppStoreTransactionInfo: Sendable, Hashable {
    public enum OwnershipType: String, Sendable, Hashable {
        case purchased
        case familyShared
        /// An ownership type this SDK version does not know.
        case unknown
    }

    public enum RevocationReason: String, Sendable, Hashable {
        /// Refunded because of an issue in the app.
        case developerIssue
        case other
        case upgradedToBundle
        /// A revocation reason this SDK version does not know.
        case unknown
    }

    public let ownershipType: OwnershipType
    /// ISO 3166-1 alpha-2 country of the storefront the transaction was made in.
    public let storefrontCountryCode: String?
    /// Whether the user upgraded to another subscription of the group, which replaces this one.
    public let isUpgraded: Bool
    /// When the App Store refunded or revoked the transaction.
    public let revocationDate: Date?
    public let revocationReason: RevocationReason?
    public let appTransactionId: String?
    /// The transaction as the App Store signed it, for verification on a server.
    public let jwsRepresentation: String

    public init(
        ownershipType: OwnershipType, storefrontCountryCode: String?, isUpgraded: Bool,
        revocationDate: Date?, revocationReason: RevocationReason?, appTransactionId: String?,
        jwsRepresentation: String
    ) {
        self.ownershipType = ownershipType
        self.storefrontCountryCode = storefrontCountryCode
        self.isUpgraded = isUpgraded
        self.revocationDate = revocationDate
        self.revocationReason = revocationReason
        self.appTransactionId = appTransactionId
        self.jwsRepresentation = jwsRepresentation
    }
}

/// The offer a transaction was bought with.
public struct VoidhashTransactionOffer: Sendable, Hashable {
    /// The store's offer identifier; `nil` for an introductory offer.
    public let id: String?
    public let kind: VoidhashOfferKind?
    public let paymentMode: VoidhashPaymentMode?

    public init(id: String?, kind: VoidhashOfferKind?, paymentMode: VoidhashPaymentMode?) {
        self.id = id
        self.kind = kind
        self.paymentMode = paymentMode
    }
}

/// A transaction StoreKit verified, projected into plain values.
public struct StoreKitTransactionInfo: Sendable, Equatable {
    public let transactionId: String
    /// The first transaction of its subscription series, or the transaction itself.
    public let originalTransactionId: String
    /// The App Store product identifier.
    public let productId: String
    public let purchaseDate: Date
    public let expirationDate: Date?
    public let quantity: Int
    /// The app account token the purchase was made with, in StoreKit's uppercase form.
    public let appAccountToken: String?
    public let productType: VoidhashAppStoreProductType
    /// Whether the transaction renews a subscription; `nil` before iOS 17.
    public let isRenewal: Bool?
    public let offer: VoidhashTransactionOffer?
    public let environment: VoidhashEnvironment
    public let appStore: VoidhashAppStoreTransactionInfo

    public init(
        transactionId: String, originalTransactionId: String, productId: String,
        purchaseDate: Date, expirationDate: Date?, quantity: Int, appAccountToken: String?,
        productType: VoidhashAppStoreProductType, isRenewal: Bool?,
        offer: VoidhashTransactionOffer?, environment: VoidhashEnvironment,
        appStore: VoidhashAppStoreTransactionInfo
    ) {
        self.transactionId = transactionId
        self.originalTransactionId = originalTransactionId
        self.productId = productId
        self.purchaseDate = purchaseDate
        self.expirationDate = expirationDate
        self.quantity = quantity
        self.appAccountToken = appAccountToken
        self.productType = productType
        self.isRenewal = isRenewal
        self.offer = offer
        self.environment = environment
        self.appStore = appStore
    }
}

/// A promotional offer the backend signed, as StoreKit's `promotionalOffer` purchase option
/// takes it. The signature is bound to the purchase's app account token.
public struct StoreKitPromotionalOffer: Sendable, Equatable {
    public enum Signature: Sendable, Equatable {
        /// Apple's compact JWS. StoreKit checks it from iOS 26; below that the SDK applies the
        /// legacy signature instead (see `PurchaseOrchestrator.storeKitChecksOfferJWS`).
        case compactJWS(String)
        /// The signature StoreKit took before JWS: applied below iOS 26, and from iOS 26 only when
        /// the backend cannot sign a JWS for the app.
        case legacy(keyIdentifier: String, nonce: UUID, signature: Data, timestamp: Int)
    }

    /// The offer identifier in App Store Connect.
    public let offerIdentifier: String
    public let signature: Signature

    public init(offerIdentifier: String, signature: Signature) {
        self.offerIdentifier = offerIdentifier
        self.signature = signature
    }
}

#if canImport(UIKit)
    /// Where StoreKit shows its purchase confirmation. StoreKit reads it on the main actor only.
    public enum StoreKitConfirmationTarget: @unchecked Sendable {
        case scene(UIWindowScene)
        case viewController(UIViewController)
    }
#endif

/// What to buy and how, beyond the product.
public struct StoreKitPurchaseRequest: Sendable {
    public enum Offer: Sendable, Equatable {
        case promotional(StoreKitPromotionalOffer)
        /// A win-back offer of the product, by its identifier; from iOS 18.
        case winBack(offerId: String)
    }

    /// The token tying the purchase to the person; a UUID string.
    public var appAccountToken: String
    public var quantity: Int
    /// `nil` buys at the price StoreKit chooses: the introductory offer when the user is
    /// eligible, the regular price otherwise.
    public var offer: Offer?
    public var simulatesAskToBuyInSandbox: Bool
    #if canImport(UIKit)
        /// `nil` lets the SDK find the scene.
        public var confirmIn: StoreKitConfirmationTarget?
    #endif

    public init(
        appAccountToken: String, quantity: Int = 1, offer: Offer? = nil,
        simulatesAskToBuyInSandbox: Bool = false
    ) {
        self.appAccountToken = appAccountToken
        self.quantity = quantity
        self.offer = offer
        self.simulatesAskToBuyInSandbox = simulatesAskToBuyInSandbox
    }
}

/// How a purchase ended at the store.
public enum StoreKitPurchaseResult: Sendable, Equatable {
    /// The store charged the user; the transaction is retained until it is finished.
    case purchased(StoreKitTransactionInfo)
    /// The purchase waits for approval, such as Ask to Buy; it arrives later as an update.
    case pending
    case cancelled
}

/// The App Store storefront the user buys in.
public struct VoidhashStorefront: Sendable, Hashable {
    /// ISO 3166-1 alpha-2.
    public let countryCode: String
    /// ISO 4217; from iOS 17.
    public let currencyCode: String?

    public init(countryCode: String, currencyCode: String?) {
        self.countryCode = countryCode
        self.currencyCode = currencyCode
    }
}

/// How the user answered a refund request sheet.
public enum VoidhashRefundRequestStatus: String, Sendable, Hashable {
    /// The request was sent to Apple; the refund itself arrives later as a revocation.
    case success
    case userCancelled
}

/// The renewal state of one subscription in a group.
public struct StoreKitSubscriptionStatusInfo: Sendable, Equatable {
    public enum State: String, Sendable, Hashable {
        case subscribed
        case expired
        case inBillingRetryPeriod
        case inGracePeriod
        case revoked
        /// A state this SDK version does not know.
        case unknown
    }

    public let state: State
    /// The latest transaction of the subscription.
    public let transaction: StoreKitTransactionInfo
    /// `nil` when StoreKit could not verify the renewal information.
    public let renewalInfo: VoidhashAppStoreRenewalInfo?

    public init(
        state: State, transaction: StoreKitTransactionInfo,
        renewalInfo: VoidhashAppStoreRenewalInfo?
    ) {
        self.state = state
        self.transaction = transaction
        self.renewalInfo = renewalInfo
    }
}

/// What happens to a subscription at its next renewal, as the App Store reports it.
public struct VoidhashAppStoreRenewalInfo: Sendable, Hashable {
    public enum ExpirationReason: String, Sendable, Hashable {
        case autoRenewDisabled
        case billingError
        case didNotConsentToPriceIncrease
        case productUnavailable
        /// A reason the App Store did not give, or one this SDK version does not know.
        case unknown
    }

    public enum PriceIncreaseStatus: String, Sendable, Hashable {
        case noIncreasePending
        /// The user has not answered the price increase yet.
        case pending
        case agreed
    }

    public let willAutoRenew: Bool
    /// The product the subscription renews to, another one of the group after a downgrade.
    public let autoRenewProductId: String
    /// Why the subscription expired; `nil` while it has not.
    public let expirationReason: ExpirationReason?
    public let gracePeriodExpiresAt: Date?
    public let isInBillingRetry: Bool
    public let priceIncreaseStatus: PriceIncreaseStatus?
    /// What the next renewal costs; `nil` when StoreKit does not say.
    public let renewalPrice: VoidhashPrice?
    /// The win-back offers the user can have; empty before iOS 18.
    public let eligibleWinBackOfferIds: [String]
    /// The renewal information as the App Store signed it.
    public let jwsRepresentation: String

    public init(
        willAutoRenew: Bool, autoRenewProductId: String, expirationReason: ExpirationReason?,
        gracePeriodExpiresAt: Date?, isInBillingRetry: Bool,
        priceIncreaseStatus: PriceIncreaseStatus?, renewalPrice: VoidhashPrice?,
        eligibleWinBackOfferIds: [String], jwsRepresentation: String
    ) {
        self.willAutoRenew = willAutoRenew
        self.autoRenewProductId = autoRenewProductId
        self.expirationReason = expirationReason
        self.gracePeriodExpiresAt = gracePeriodExpiresAt
        self.isInBillingRetry = isInBillingRetry
        self.priceIncreaseStatus = priceIncreaseStatus
        self.renewalPrice = renewalPrice
        self.eligibleWinBackOfferIds = eligibleWinBackOfferIds
        self.jwsRepresentation = jwsRepresentation
    }
}

/// The App Store's record of the user getting the app.
public struct VoidhashAppTransaction: Sendable, Hashable {
    /// The app version the user first got: the build number (`CFBundleVersion`) on iOS.
    public let originalAppVersion: String
    public let originalPurchaseDate: Date
    public let environment: VoidhashEnvironment
    public let appTransactionId: String?
    /// The platform the user first got the app on, such as `iOS`.
    public let originalPlatform: String?
    /// The app transaction as the App Store signed it, for verification on a server.
    public let jwsRepresentation: String

    public init(
        originalAppVersion: String, originalPurchaseDate: Date, environment: VoidhashEnvironment,
        appTransactionId: String?, originalPlatform: String?, jwsRepresentation: String
    ) {
        self.originalAppVersion = originalAppVersion
        self.originalPurchaseDate = originalPurchaseDate
        self.environment = environment
        self.appTransactionId = appTransactionId
        self.originalPlatform = originalPlatform
        self.jwsRepresentation = jwsRepresentation
    }
}

/// Picks the current user's subscription among the ones an Apple account has in a group: its
/// own and family-shared ones, possibly bought for other people of the app.
public enum SubscriptionStatusRanking {
    /// What ranks a status: whose purchase its latest transaction is, and when it was made.
    public struct Candidate: Sendable, Equatable {
        public let appAccountToken: String?
        public let ownershipType: VoidhashAppStoreTransactionInfo.OwnershipType
        public let purchaseDate: Date

        public init(
            appAccountToken: String?, ownershipType: VoidhashAppStoreTransactionInfo.OwnershipType,
            purchaseDate: Date
        ) {
            self.appAccountToken = appAccountToken
            self.ownershipType = ownershipType
            self.purchaseDate = purchaseDate
        }
    }

    /// `elements` with the current user's first: one bought with `appAccountToken`, then one the
    /// account bought rather than shares through Family Sharing, the latest first within each.
    /// Elements `candidate` knows nothing about go last.
    public static func currentUserFirst<Element>(
        _ elements: [Element], appAccountToken: String?, candidate: (Element) -> Candidate?
    ) -> [Element] {
        func rank(_ element: Element) -> (Int, Date) {
            guard let candidate = candidate(element) else {
                return (3, .distantPast)
            }
            if let appAccountToken,
                candidate.appAccountToken?.lowercased() == appAccountToken.lowercased()
            {
                return (0, candidate.purchaseDate)
            }
            return (candidate.ownershipType == .purchased ? 1 : 2, candidate.purchaseDate)
        }
        return elements.enumerated().sorted { lhs, rhs in
            let (left, right) = (rank(lhs.element), rank(rhs.element))
            if left.0 != right.0 { return left.0 < right.0 }
            if left.1 != right.1 { return left.1 > right.1 }
            return lhs.offset < rhs.offset
        }.map(\.element)
    }
}

// MARK: - StoreKit mapping

@available(iOS 15.0, macOS 13.0, *)
extension VoidhashPeriod {
    init(_ period: Product.SubscriptionPeriod) {
        let unit: Unit
        switch period.unit {
        case .day: unit = .day
        case .week: unit = .week
        case .month: unit = .month
        case .year: unit = .year
        @unknown default: unit = .day
        }
        self.init(unit: unit, count: period.value)
    }
}

@available(iOS 15.0, macOS 13.0, *)
extension VoidhashAppStoreOffer {
    init(_ offer: Product.SubscriptionOffer, currencyCode: String) {
        let type: VoidhashOfferKind
        if offer.type == .introductory {
            type = .introductory
        } else if offer.type == .promotional {
            type = .promotional
        } else if #available(iOS 18.0, macOS 15.0, visionOS 2.0, *), offer.type == .winBack {
            type = .winBack
        } else {
            type = .unknown
        }
        let paymentMode: VoidhashPaymentMode
        switch offer.paymentMode {
        case .freeTrial: paymentMode = .freeTrial
        case .payAsYouGo: paymentMode = .payAsYouGo
        case .payUpFront: paymentMode = .payUpFront
        default: paymentMode = .unknown
        }
        self.init(
            id: offer.id, type: type, paymentMode: paymentMode, period: VoidhashPeriod(offer.period),
            periodCount: offer.periodCount,
            price: VoidhashPrice(
                amount: offer.price, currencyCode: currencyCode, formatted: offer.displayPrice))
    }
}

@available(iOS 15.0, macOS 13.0, *)
extension VoidhashAppStoreProductType {
    init(_ type: Product.ProductType) {
        switch type {
        case .consumable: self = .consumable
        case .nonConsumable: self = .nonConsumable
        case .autoRenewable: self = .autoRenewable
        case .nonRenewable: self = .nonRenewable
        default: self = .unknown
        }
    }
}

@available(iOS 15.0, macOS 13.0, *)
extension StoreKitProductInfo {
    /// Projects a StoreKit product, with what the App Store said about the user's eligibility
    /// for its group's introductory offer and its win-back offers, and whether it has a
    /// subscription status for them in the group.
    public init(
        product: Product, isEligibleForIntroOffer: Bool?, eligibleWinBackOfferIds: Set<String>,
        isCurrentOrFormerSubscriber: Bool = false
    ) {
        let formatStyle = product.priceFormatStyle
        let currencyCode = formatStyle.currencyCode
        let subscription = product.subscription
        var groupLevel: Int?
        var groupDisplayName: String?
        if #available(iOS 16.4, macOS 13.3, *), let subscription {
            groupLevel = subscription.groupLevel
            groupDisplayName = subscription.groupDisplayName
        }
        var winBackOffers: [VoidhashAppStoreOffer] = []
        if #available(iOS 18.0, macOS 15.0, visionOS 2.0, *), let subscription {
            winBackOffers = subscription.winBackOffers.map {
                VoidhashAppStoreOffer($0, currencyCode: currencyCode)
            }
        }
        let appStore = VoidhashAppStoreProductInfo(
            storeKitProduct: product,
            subscriptionGroupId: subscription?.subscriptionGroupID,
            subscriptionGroupLevel: groupLevel,
            subscriptionGroupDisplayName: groupDisplayName,
            isFamilyShareable: product.isFamilyShareable,
            productType: VoidhashAppStoreProductType(product.type),
            introductoryOffer: subscription?.introductoryOffer.map {
                VoidhashAppStoreOffer($0, currencyCode: currencyCode)
            },
            promotionalOffers: subscription?.promotionalOffers.map {
                VoidhashAppStoreOffer($0, currencyCode: currencyCode)
            } ?? [],
            winBackOffers: winBackOffers,
            isEligibleForIntroOffer: subscription == nil ? nil : isEligibleForIntroOffer)
        self.init(
            id: product.id, displayName: product.displayName, description: product.description,
            price: VoidhashPrice(
                amount: product.price, currencyCode: currencyCode,
                formatted: product.displayPrice),
            subscriptionPeriod: subscription.map { VoidhashPeriod($0.subscriptionPeriod) },
            appStore: appStore, eligibleWinBackOfferIds: eligibleWinBackOfferIds,
            isCurrentOrFormerSubscriber: isCurrentOrFormerSubscriber,
            format: VoidhashPrice.formatter(formatStyle))
    }
}

@available(iOS 15.0, macOS 13.0, *)
extension StoreKitTransactionInfo {
    /// Projects a transaction StoreKit verified, with the JWS it was verified from.
    public init(transaction: Transaction, jwsRepresentation: String) {
        // visionOS has the current APIs from its first release, and none of the fallbacks.
        let environment: VoidhashEnvironment
        var isRenewal: Bool?
        let storefrontCountryCode: String
        #if os(visionOS)
            environment = VoidhashEnvironment(appStoreRawValue: transaction.environment.rawValue)
            isRenewal = transaction.reason == .renewal
            storefrontCountryCode = transaction.storefront.countryCode
        #else
            if #available(iOS 16.0, *) {
                environment = VoidhashEnvironment(
                    appStoreRawValue: transaction.environment.rawValue)
            } else {
                environment = VoidhashEnvironment(
                    appStoreRawValue: transaction.environmentStringRepresentation)
            }
            if #available(iOS 17.0, macOS 14.0, *) {
                isRenewal = transaction.reason == .renewal
                storefrontCountryCode = transaction.storefront.countryCode
            } else {
                storefrontCountryCode = transaction.storefrontCountryCode
            }
        #endif

        let offer: VoidhashTransactionOffer?
        if #available(iOS 17.2, macOS 14.2, visionOS 1.1, *) {
            offer = transaction.offer.map { offer in
                VoidhashTransactionOffer(
                    id: offer.id, kind: Self.offerKind(offer.type),
                    paymentMode: offer.paymentMode.map { Self.paymentMode($0.rawValue) })
            }
        } else {
            offer = transaction.offerType.map { type in
                VoidhashTransactionOffer(
                    id: transaction.offerID, kind: Self.offerKind(type),
                    paymentMode: transaction.offerPaymentModeStringRepresentation.map(
                        Self.paymentMode))
            }
        }

        let ownershipType: VoidhashAppStoreTransactionInfo.OwnershipType
        switch transaction.ownershipType {
        case .purchased: ownershipType = .purchased
        case .familyShared: ownershipType = .familyShared
        default: ownershipType = .unknown
        }

        let revocationReason = transaction.revocationReason.map {
            reason -> VoidhashAppStoreTransactionInfo.RevocationReason in
            switch reason {
            case .developerIssue: return .developerIssue
            case .other: return .other
            // Ships in the iOS 27 SDK (Swift 6.4); an app built with an older Xcode reads it as
            // unknown.
            #if compiler(>=6.4)
                case .upgradedToBundle: return .upgradedToBundle
            #endif
            default: return .unknown
            }
        }

        let appTransactionId = transaction.appTransactionID
        self.init(
            transactionId: String(transaction.id),
            originalTransactionId: String(transaction.originalID),
            productId: transaction.productID,
            purchaseDate: transaction.purchaseDate,
            expirationDate: transaction.expirationDate,
            quantity: transaction.purchasedQuantity,
            appAccountToken: transaction.appAccountToken?.uuidString,
            productType: VoidhashAppStoreProductType(transaction.productType),
            isRenewal: isRenewal,
            offer: offer,
            environment: environment,
            appStore: VoidhashAppStoreTransactionInfo(
                ownershipType: ownershipType,
                storefrontCountryCode: CountryCodes.alpha2(storefrontCountryCode),
                isUpgraded: transaction.isUpgraded,
                revocationDate: transaction.revocationDate,
                revocationReason: revocationReason,
                appTransactionId: appTransactionId.isEmpty ? nil : appTransactionId,
                jwsRepresentation: jwsRepresentation))
    }

    private static func offerKind(_ type: Transaction.OfferType) -> VoidhashOfferKind {
        switch type {
        case .introductory: return .introductory
        case .promotional: return .promotional
        case .code: return .code
        case .winBack: return .winBack
        default: return .unknown
        }
    }

    /// The payment mode StoreKit names `FREE_TRIAL`, `PAY_AS_YOU_GO` or `PAY_UP_FRONT`.
    private static func paymentMode(_ rawValue: String) -> VoidhashPaymentMode {
        switch rawValue {
        case "FREE_TRIAL": return .freeTrial
        case "PAY_AS_YOU_GO": return .payAsYouGo
        case "PAY_UP_FRONT": return .payUpFront
        default: return .unknown
        }
    }
}

@available(iOS 15.0, macOS 13.0, *)
extension VoidhashAppStoreRenewalInfo {
    init(_ renewalInfo: Product.SubscriptionInfo.RenewalInfo, jwsRepresentation: String) {
        let expirationReason = renewalInfo.expirationReason.map { reason -> ExpirationReason in
            switch reason {
            case .autoRenewDisabled: return .autoRenewDisabled
            case .billingError: return .billingError
            case .didNotConsentToPriceIncrease: return .didNotConsentToPriceIncrease
            case .productUnavailable: return .productUnavailable
            default: return .unknown
            }
        }
        let priceIncreaseStatus: PriceIncreaseStatus
        switch renewalInfo.priceIncreaseStatus {
        case .noIncreasePending: priceIncreaseStatus = .noIncreasePending
        case .pending: priceIncreaseStatus = .pending
        case .agreed: priceIncreaseStatus = .agreed
        }
        let currencyCode: String?
        #if os(visionOS)
            currencyCode = renewalInfo.currency?.identifier
        #else
            if #available(iOS 16.0, *) {
                currencyCode = renewalInfo.currency?.identifier
            } else {
                currencyCode = renewalInfo.currencyCode
            }
        #endif
        var renewalPrice: VoidhashPrice?
        if let amount = renewalInfo.renewalPrice, let currencyCode {
            renewalPrice = VoidhashPrice(
                amount: amount, currencyCode: currencyCode,
                formatted: amount.formatted(.currency(code: currencyCode)))
        }
        var eligibleWinBackOfferIds: [String] = []
        if #available(iOS 18.0, macOS 15.0, visionOS 2.0, *) {
            eligibleWinBackOfferIds = renewalInfo.eligibleWinBackOfferIDs
        }
        self.init(
            willAutoRenew: renewalInfo.willAutoRenew,
            autoRenewProductId: renewalInfo.autoRenewPreference ?? renewalInfo.currentProductID,
            expirationReason: expirationReason,
            gracePeriodExpiresAt: renewalInfo.gracePeriodExpirationDate,
            isInBillingRetry: renewalInfo.isInBillingRetry,
            priceIncreaseStatus: priceIncreaseStatus,
            renewalPrice: renewalPrice,
            eligibleWinBackOfferIds: eligibleWinBackOfferIds,
            jwsRepresentation: jwsRepresentation)
    }
}

@available(iOS 15.0, macOS 13.0, *)
extension StoreKitSubscriptionStatusInfo.State {
    init(_ state: Product.SubscriptionInfo.RenewalState) {
        switch state {
        case .subscribed: self = .subscribed
        case .expired: self = .expired
        case .inBillingRetryPeriod: self = .inBillingRetryPeriod
        case .inGracePeriod: self = .inGracePeriod
        case .revoked: self = .revoked
        default: self = .unknown
        }
    }
}
