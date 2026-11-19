import Foundation
import StoreKit

#if canImport(UIKit)
    import UIKit
#endif

/// Callback invoked when the store reports a new or updated transaction.
public typealias StoreKitTransactionListener = @Sendable (StoreKitTransactionInfo) -> Void

/// The StoreKit surface consumed by the SDKs, expressed as plain values so it can be mocked.
public protocol StoreKitEngineProtocol: AnyObject, Sendable {
    /// Opens the store connection and returns whether the device can make payments.
    ///
    /// `onTransaction` receives the transactions the store reports on its own for the lifetime
    /// of the connection: unfinished ones when it opens, renewals, Ask to Buy approvals, offer
    /// codes redeemed outside the app. A purchase this engine makes is returned by
    /// ``buyProduct(sku:request:)`` instead. The engine only retains and reports; it never
    /// finishes automatically.
    func initConnection(onTransaction: StoreKitTransactionListener?) async throws -> Bool
    /// Tears down the store connection, dropping cached products and retained transactions. The
    /// listener passed to ``initConnection(onTransaction:)`` receives nothing afterwards.
    @discardableResult
    func endConnection() async throws -> Bool
    /// Fetches (and caches) the products with the given identifiers, with the offers the user
    /// can have. Identifiers the store does not know are left out.
    ///
    /// - Parameter appAccountToken: The current person's token, which picks their subscription
    ///   when the Apple account has several in a group.
    func getItems(skus: [String], appAccountToken: String?) async throws -> [StoreKitProductInfo]
    /// Returns the customer's purchases, optionally limited to currently active entitlements.
    func getPurchasedItems(onlyIncludeActiveItems: Bool) async throws -> [StoreKitTransactionInfo]
    /// Refreshes transactions from the App Store. Only call after an explicit user action;
    /// StoreKit may ask the user to authenticate.
    func syncStore() async throws
    /// Buys a product previously fetched via ``getItems(skus:appAccountToken:)``.
    ///
    /// A cancelled sheet and a purchase waiting for approval are results, not errors. A
    /// requested offer the product does not have, or that StoreKit refuses, throws
    /// `OFFER_UNAVAILABLE`: the product is never bought at its regular price instead.
    func buyProduct(sku: String, request: StoreKitPurchaseRequest) async throws
        -> StoreKitPurchaseResult
    /// Finishes a retained transaction, removing it from the store queue.
    func finishTransaction(transactionId: String) async throws
    /// Transactions the store handed over as awaiting a finish, and not finished yet: purchases
    /// this engine made, and the unfinished and updated transactions it observed. A transaction
    /// ``getPurchasedItems(onlyIncludeActiveItems:)`` returned can be finished, but is not
    /// pending for having been read.
    func getPendingTransactions() throws -> [StoreKitTransactionInfo]
    /// The unfinished transaction `transactionId`, retained so it can be finished here: for a
    /// client that takes over a purchase another one started. `nil` once it is finished.
    func retainUnfinishedTransaction(_ transactionId: String) async -> StoreKitTransactionInfo?
    /// Presents the App Store's offer code redemption sheet.
    ///
    /// - Returns: The transaction of the code redeemed, retained until it is finished, where the
    ///   OS hands it over (iOS 27); `nil` when the user closed the sheet, and before iOS 27,
    ///   where it arrives through the connection's listener.
    func presentCodeRedemption() async throws -> StoreKitTransactionInfo?
    /// Presents the App Store's subscription management sheet, opened on
    /// `subscriptionGroupId` from iOS 17.
    func showManageSubscriptions(subscriptionGroupId: String?) async throws
    /// The storefront the user buys in; `nil` when the App Store cannot say.
    func storefront() async -> VoidhashStorefront?
    /// Whether the user may make payments: parental controls can turn them off.
    func canMakePayments() -> Bool
    /// Presents the App Store's refund request sheet for a transaction.
    func beginRefundRequest(transactionId: String) async throws -> VoidhashRefundRequestStatus
    /// The renewal state of each subscription the Apple account has in a group, the current
    /// person's first (see ``SubscriptionStatusRanking``).
    func subscriptionStatuses(groupId: String, appAccountToken: String?) async throws
        -> [StoreKitSubscriptionStatusInfo]
    /// The transactions that entitle the Apple account right now, as StoreKit lists them.
    func currentEntitlements() async throws -> [StoreKitTransactionInfo]
    /// The App Store's record of the user getting the app; from iOS 16.
    func appTransaction() async throws -> VoidhashAppTransaction
    /// The JWS StoreKit verified the transaction `transactionId` from, which proves to a server
    /// that this device's Apple Account holds it; `nil` when the device has no verified
    /// transaction with that id.
    func signedTransaction(transactionId: String) async -> String?
}

extension StoreKitEngineProtocol {
    public func retainUnfinishedTransaction(_ transactionId: String) async
        -> StoreKitTransactionInfo?
    {
        return nil
    }

    public func presentCodeRedemption() async throws -> StoreKitTransactionInfo? {
        throw VoidhashStoreError.methodNotAvailableOnPlatform(
            "This store has no offer code redemption")
    }

    public func showManageSubscriptions(subscriptionGroupId: String?) async throws {
        throw VoidhashStoreError.methodNotAvailableOnPlatform(
            "This store has no subscription management")
    }

    public func storefront() async -> VoidhashStorefront? {
        return nil
    }

    public func canMakePayments() -> Bool {
        return true
    }

    public func beginRefundRequest(transactionId: String) async throws
        -> VoidhashRefundRequestStatus
    {
        throw VoidhashStoreError.methodNotAvailableOnPlatform("This store has no refund requests")
    }

    public func subscriptionStatuses(groupId: String, appAccountToken: String?) async throws
        -> [StoreKitSubscriptionStatusInfo]
    {
        return []
    }

    public func currentEntitlements() async throws -> [StoreKitTransactionInfo] {
        return []
    }

    public func appTransaction() async throws -> VoidhashAppTransaction {
        throw VoidhashStoreError.methodNotAvailableOnPlatform("This store has no app transaction")
    }

    public func signedTransaction(transactionId: String) async -> String? {
        return nil
    }
}

/// StoreKit 2 engine shared by the bare iOS SDK and the React Native native layer.
public final class StoreKitEngine: StoreKitEngineProtocol, @unchecked Sendable {
    /// A transaction kept until it is finished, with the JWS StoreKit verified it from.
    private struct Retained {
        let transaction: Transaction
        let jwsRepresentation: String

        var info: StoreKitTransactionInfo {
            return StoreKitTransactionInfo(
                transaction: transaction, jwsRepresentation: jwsRepresentation)
        }
    }

    private let transactions = TransactionRetentionStore<Retained>()
    private let lock = NSLock()
    private var productStore: ProductStore?
    private var onTransactionListener: StoreKitTransactionListener?
    private var transactionUpdatesTask: Task<Void, Never>?
    private let onUnverified: @Sendable (_ operation: String, _ message: String) -> Void
    private var reportedUnverifiedIds: Set<String> = []

    #if canImport(UIKit)
        private let windowSceneProvider: WindowSceneProviding

        /// - Parameter onUnverified: Told, once per transaction, of one StoreKit could not
        ///   verify: the operation that met it and what happened. A plain closure, so this
        ///   folder builds on its own, without the SDK's diagnostics.
        public init(
            windowSceneProvider: WindowSceneProviding = DefaultWindowSceneProvider(),
            onUnverified: @escaping @Sendable (_ operation: String, _ message: String) -> Void = {
                _, _ in
            }
        ) {
            self.windowSceneProvider = windowSceneProvider
            self.onUnverified = onUnverified
        }
    #else
        /// - Parameter onUnverified: Told, once per transaction, of one StoreKit could not
        ///   verify: the operation that met it and what happened.
        public init(
            onUnverified: @escaping @Sendable (_ operation: String, _ message: String) -> Void = {
                _, _ in
            }
        ) {
            self.onUnverified = onUnverified
        }
    #endif

    public func initConnection(onTransaction: StoreKitTransactionListener?) async throws -> Bool {
        let previousUpdatesTask = lock.withLock {
            self.productStore = ProductStore()
            self.onTransactionListener = onTransaction
            let previous = transactionUpdatesTask
            transactionUpdatesTask = nil
            return previous
        }
        previousUpdatesTask?.cancel()
        startObservingTransactionUpdates()
        return AppStore.canMakePayments
    }

    @discardableResult
    public func endConnection() async throws -> Bool {
        guard let productStore = currentProductStore else {
            return false
        }
        await productStore.removeAll()
        transactions.removeAll()
        let updatesTask = lock.withLock {
            self.productStore = nil
            self.onTransactionListener = nil
            let task = transactionUpdatesTask
            transactionUpdatesTask = nil
            return task
        }
        updatesTask?.cancel()
        return true
    }

    /// Subscribes to `Transaction.updates` for the lifetime of the connection so transactions
    /// such as renewals and Ask to Buy approvals are retained and reported to the listener.
    ///
    /// Transactions still unfinished when the connection opens (completed while the app was not
    /// running, or before the listener attached) are reported first. Purchases already finished
    /// by the host are discovered by scanning current entitlements.
    private func startObservingTransactionUpdates() {
        let task = Task { [weak self] in
            for await verification in Transaction.unfinished {
                guard let self, !Task.isCancelled else {
                    return
                }
                self.observe(verification)
            }
            for await verification in Transaction.updates {
                guard let self, !Task.isCancelled else {
                    return
                }
                self.observe(verification)
            }
        }
        lock.withLock {
            transactionUpdatesTask = task
        }
    }

    public func retainUnfinishedTransaction(_ transactionId: String) async
        -> StoreKitTransactionInfo?
    {
        for await verification in Transaction.unfinished {
            guard let retained = verified(verification, operation: "transactions.observe"),
                String(retained.transaction.id) == transactionId
            else {
                continue
            }
            transactions.retain(id: transactionId, value: retained)
            return retained.info
        }
        return nil
    }

    /// Reads the transaction the engine holds, else the device's purchase history, which lists
    /// every transaction but finished consumables.
    public func signedTransaction(transactionId: String) async -> String? {
        if let retained = transactions.value(for: transactionId) {
            return retained.jwsRepresentation
        }
        for await verification in Transaction.all {
            guard case .verified(let transaction) = verification,
                String(transaction.id) == transactionId
            else {
                continue
            }
            return verification.jwsRepresentation
        }
        return nil
    }

    private func observe(_ verification: VerificationResult<Transaction>) {
        guard let retained = verified(verification, operation: "transactions.observe") else {
            return
        }
        transactions.retain(id: String(retained.transaction.id), value: retained)
        currentTransactionListener?(retained.info)
    }

    /// The transaction StoreKit verified; `nil` for one it could not verify, which is neither
    /// sent to Voidhash nor finished, and is reported.
    private func verified(_ verification: VerificationResult<Transaction>, operation: String)
        -> Retained?
    {
        switch verification {
        case .verified(let transaction):
            return Retained(
                transaction: transaction, jwsRepresentation: verification.jwsRepresentation)
        case .unverified(let transaction, let error):
            reportUnverified(
                transactionId: String(transaction.id), productId: transaction.productID,
                error: error, operation: operation)
            return nil
        }
    }

    /// Reports a transaction StoreKit could not verify, once per transaction: the store hands
    /// the same one over on every launch and every history read.
    func reportUnverified(
        transactionId: String, productId: String, error: any Error, operation: String
    ) {
        guard lock.withLock({ reportedUnverifiedIds.insert(transactionId).inserted }) else {
            return
        }
        onUnverified(
            operation,
            "StoreKit could not verify transaction \(transactionId) of \(productId), so it is neither sent to Voidhash nor finished: \(error.localizedDescription)"
        )
    }

    /// Asks the App Store once per subscription group whether the user can have its
    /// introductory offer. Their subscription status in the group is read once as well, for a
    /// group with win-back offers (iOS 18), whose renewal information lists the ones they can
    /// have, and for a group with promotional offers whose introductory offer the user can
    /// still have, as a subscriber who never redeemed one can.
    public func getItems(skus: [String], appAccountToken: String?) async throws
        -> [StoreKitProductInfo]
    {
        guard let productStore = currentProductStore else {
            throw VoidhashStoreError.storeKitNotInitialized
        }
        let fetchedProducts: [Product]
        do {
            fetchedProducts = try await Product.products(for: skus)
        } catch {
            throw Self.storeError(
                error, code: "FAILED_TO_GET_PRODUCTS",
                message: "Could not load products from the App Store")
        }
        for product in fetchedProducts {
            await productStore.addProduct(product)
        }

        var introEligibility: [String: Bool] = [:]
        var winBackEligibility: [String: Set<String>] = [:]
        var subscribedGroups: Set<String> = []
        for groupId in Set(fetchedProducts.compactMap { $0.subscription?.subscriptionGroupID }) {
            let subscriptions = fetchedProducts.compactMap(\.subscription).filter {
                $0.subscriptionGroupID == groupId
            }
            let isEligibleForIntroOffer = await Product.SubscriptionInfo.isEligibleForIntroOffer(
                for: groupId)
            introEligibility[groupId] = isEligibleForIntroOffer
            var hasWinBackOffers = false
            if #available(iOS 18.0, macOS 15.0, visionOS 2.0, *) {
                hasWinBackOffers = subscriptions.contains { !$0.winBackOffers.isEmpty }
            }
            let asksWhetherSubscribed =
                isEligibleForIntroOffer && subscriptions.contains { !$0.promotionalOffers.isEmpty }
            guard hasWinBackOffers || asksWhetherSubscribed else {
                continue
            }
            // None when the App Store cannot say: no promotional and no win-back offer.
            let statuses =
                (try? await subscriptionStatuses(
                    groupId: groupId, appAccountToken: appAccountToken)) ?? []
            if !statuses.isEmpty {
                subscribedGroups.insert(groupId)
            }
            if hasWinBackOffers {
                winBackEligibility[groupId] = Set(
                    statuses.first?.renewalInfo?.eligibleWinBackOfferIds ?? [])
            }
        }
        return fetchedProducts.map { product in
            let groupId = product.subscription?.subscriptionGroupID
            return StoreKitProductInfo(
                product: product,
                isEligibleForIntroOffer: groupId.flatMap { introEligibility[$0] },
                eligibleWinBackOfferIds: groupId.flatMap { winBackEligibility[$0] } ?? [],
                isCurrentOrFormerSubscriber: groupId.map(subscribedGroups.contains) ?? false)
        }
    }

    /// Refreshes App Store data for an explicit user action; may prompt for authentication.
    ///
    /// Throws `USER_CANCELLED` when the user dismisses the App Store sign-in, and
    /// `FAILED_TO_RESTORE_PURCHASES` when the App Store cannot be reached.
    public func syncStore() async throws {
        do {
            try await AppStore.sync()
        } catch {
            throw Self.storeError(
                error, code: "FAILED_TO_RESTORE_PURCHASES",
                message: "Could not refresh the App Store purchase history")
        }
    }

    /// The SDK's error for a StoreKit call that failed with `error`, so no StoreKit error reaches
    /// the host: a cancelled App Store sign-in is `USER_CANCELLED`, any other failure `code`
    /// with StoreKit's description in the message.
    static func storeError(_ error: any Error, code: String, message: String)
        -> VoidhashStoreError
    {
        if let storeError = error as? VoidhashStoreError {
            return storeError
        }
        if let storeKitError = error as? StoreKitError, case .userCancelled = storeKitError {
            return VoidhashStoreError(
                code: VoidhashStoreError.userCancelled.code,
                message: "The user cancelled the App Store sign-in")
        }
        return VoidhashStoreError(code: code, message: "\(message) - \(error.localizedDescription)")
    }

    public func getPurchasedItems(onlyIncludeActiveItems: Bool) async throws
        -> [StoreKitTransactionInfo]
    {
        guard currentProductStore != nil else {
            throw VoidhashStoreError.storeKitNotInitialized
        }

        var purchasedItems: [StoreKitTransactionInfo] = []
        for await verification in onlyIncludeActiveItems
            ? Transaction.currentEntitlements
            : Transaction.all
        {
            guard let retained = verified(verification, operation: "transactions.history"),
                retained.transaction.productType != .consumable
            else {
                continue
            }
            // Retained so that it can be finished, not as pending: a read of the history says
            // nothing about a transaction still awaiting a finish.
            transactions.retain(
                id: String(retained.transaction.id), value: retained, pending: false)
            purchasedItems.append(retained.info)
        }
        return purchasedItems
    }

    public func buyProduct(sku: String, request: StoreKitPurchaseRequest) async throws
        -> StoreKitPurchaseResult
    {
        guard let productStore = currentProductStore else {
            throw VoidhashStoreError.storeKitNotInitialized
        }
        guard let product = await productStore.getProduct(productID: sku) else {
            throw VoidhashStoreError.invalidProductId
        }
        guard request.quantity >= 1 else {
            throw VoidhashStoreError.invalidArgument("\(request.quantity) is not a quantity to buy")
        }

        var options: Set<Product.PurchaseOption> = []
        if let appAccountUUID = UUID(uuidString: request.appAccountToken) {
            options.insert(.appAccountToken(appAccountUUID))
        }
        if request.quantity > 1 {
            options.insert(.quantity(request.quantity))
        }
        if request.simulatesAskToBuyInSandbox {
            options.insert(.simulatesAskToBuyInSandbox(true))
        }
        switch request.offer {
        case nil:
            break
        case .promotional(let offer)?:
            options.formUnion(
                try Self.promotionalOfferOptions(
                    offer, of: product, appAccountToken: request.appAccountToken))
        case .winBack(let offerId)?:
            options.insert(try Self.winBackOfferOption(offerId, of: product))
        }

        let result: Product.PurchaseResult
        do {
            #if canImport(UIKit)
                result = try await purchase(
                    product: product, options: options, confirmIn: request.confirmIn)
            #else
                result = try await product.purchase(options: options)
            #endif
        } catch {
            throw Self.purchaseError(error, withOffer: request.offer != nil)
        }

        switch result {
        case .success(let verification):
            guard let retained = verified(verification, operation: "purchase") else {
                throw VoidhashStoreError.transactionVerificationFailed
            }
            transactions.retain(id: String(retained.transaction.id), value: retained)
            return .purchased(retained.info)
        case .userCancelled:
            return .cancelled
        case .pending:
            return .pending
        @unknown default:
            throw VoidhashStoreError.purchaseUnknownResult
        }
    }

    /// The purchase options applying `offer`, signed for `appAccountToken`.
    ///
    /// - Throws: `OFFER_UNAVAILABLE` when the product has no such promotional offer, or the
    ///   purchase carries no account token for the signature to cover.
    static func promotionalOfferOptions(
        _ offer: StoreKitPromotionalOffer, of product: Product, appAccountToken: String
    ) throws -> Set<Product.PurchaseOption> {
        guard
            product.subscription?.promotionalOffers.contains(where: {
                $0.id == offer.offerIdentifier
            }) == true
        else {
            throw VoidhashStoreError.offerUnavailable(
                "\(product.id) has no promotional offer \(offer.offerIdentifier)")
        }
        // The signature covers the account token; StoreKit rejects the offer without it.
        guard UUID(uuidString: appAccountToken) != nil else {
            throw VoidhashStoreError.offerUnavailable(
                "A promotional offer needs the app account token it was signed for")
        }
        switch offer.signature {
        case .compactJWS(let jws):
            // The compact-JWS option ships in the iOS 26 SDK (Swift 6.2); an app built with an
            // older Xcode never asks for it, since `PurchaseOrchestrator.storeKitChecksOfferJWS` is
            // false there and the legacy signature is applied instead.
            #if compiler(>=6.2)
                return Set(
                    Product.PurchaseOption.promotionalOffer(offer.offerIdentifier, compactJWS: jws))
            #else
                throw VoidhashStoreError.offerUnavailable(
                    "Applying a promotional offer's JWS needs an app built with Xcode 26 or later")
            #endif
        case .legacy(let keyIdentifier, let nonce, let signature, let timestamp):
            return [
                .promotionalOffer(
                    offerID: offer.offerIdentifier, keyID: keyIdentifier, nonce: nonce,
                    signature: signature, timestamp: timestamp)
            ]
        }
    }

    /// The purchase option applying the win-back offer `offerId` of `product`.
    ///
    /// - Throws: `OFFER_UNAVAILABLE` before iOS 18 and when the product has no such offer.
    static func winBackOfferOption(_ offerId: String, of product: Product) throws
        -> Product.PurchaseOption
    {
        guard #available(iOS 18.0, macOS 15.0, visionOS 2.0, *) else {
            throw VoidhashStoreError.offerUnavailable("Win-back offers need iOS 18")
        }
        guard let offer = product.subscription?.winBackOffers.first(where: { $0.id == offerId })
        else {
            throw VoidhashStoreError.offerUnavailable(
                "\(product.id) has no win-back offer \(offerId)")
        }
        return .winBackOffer(offer)
    }

    /// The SDK's error for a purchase that failed with `error`.
    ///
    /// The App Store refusing the offer itself (signature, eligibility, identifier) is the offer
    /// being unavailable, as the SDK documents, rather than a failed purchase; refused as the
    /// user is not eligible for it, it has the reason `ineligibleForOffer`, as Google Play's
    /// refusal has on Android. A cancel StoreKit reports by throwing, such as a dismissed App
    /// Store sign-in, is `USER_CANCELLED`; anything else is `PURCHASE_FAILED`.
    static func purchaseError(_ error: any Error, withOffer: Bool) -> VoidhashStoreError {
        if withOffer, let purchaseError = error as? Product.PurchaseError {
            switch purchaseError {
            case .ineligibleForOffer:
                return VoidhashStoreError.ineligibleForOffer(purchaseError.localizedDescription)
            case .invalidOfferIdentifier, .invalidOfferPrice, .invalidOfferSignature,
                .missingOfferParameters:
                return VoidhashStoreError.offerUnavailable(purchaseError.localizedDescription)
            default:
                break
            }
        }
        return storeError(error, code: "PURCHASE_FAILED", message: "Purchase operation failed")
    }

    public func finishTransaction(transactionId: String) async throws {
        guard let retained = transactions.value(for: transactionId) else {
            throw VoidhashStoreError.transactionNotFound
        }
        await retained.transaction.finish()
        transactions.remove(id: transactionId)
    }

    public func getPendingTransactions() throws -> [StoreKitTransactionInfo] {
        return transactions.pendingValues().map(\.info)
    }

    public func presentCodeRedemption() async throws -> StoreKitTransactionInfo? {
        #if os(iOS) || os(visionOS)
            // The sheet that returns the redeemed transaction ships in the iOS 27 SDK (Swift 6.4);
            // an app built with an older Xcode shows the iOS 16 sheet, whose redemptions arrive
            // through the transaction observer.
            #if compiler(>=6.4)
            if #available(iOS 27.0, visionOS 27.0, *) {
                guard let viewController = await topViewController() else {
                    throw VoidhashStoreError.paywallPresenterNotAvailable
                }
                let verification: VerificationResult<Transaction>
                do {
                    verification = try await AppStore.presentOfferCodeRedeemSheet(
                        from: viewController)
                } catch let error as StoreKitError {
                    if case .userCancelled = error {
                        return nil
                    }
                    throw Self.storeError(
                        error, code: "FAILED_TO_PRESENT_CODE_REDEMPTION",
                        message: "Could not show the offer code redemption sheet")
                }
                guard let retained = verified(verification, operation: "offerCode.redeem") else {
                    throw VoidhashStoreError.transactionVerificationFailed
                }
                transactions.retain(id: String(retained.transaction.id), value: retained)
                return retained.info
            }
            #endif
            if #available(iOS 16.0, *) {
                guard let scene = await windowSceneProvider.currentWindowScene() else {
                    throw VoidhashStoreError.windowSceneNotFound
                }
                do {
                    try await AppStore.presentOfferCodeRedeemSheet(in: scene)
                } catch {
                    throw Self.storeError(
                        error, code: "FAILED_TO_PRESENT_CODE_REDEMPTION",
                        message: "Could not show the offer code redemption sheet")
                }
                return nil
            }
            throw VoidhashStoreError.methodNotAvailableOnPlatform(
                "Offer code redemption needs iOS 16")
        #else
            throw VoidhashStoreError.methodNotAvailableOnPlatform(
                "Offer code redemption is not available on this platform")
        #endif
    }

    public func showManageSubscriptions(subscriptionGroupId: String?) async throws {
        #if os(iOS) || os(visionOS)
            guard let scene = await windowSceneProvider.currentWindowScene() else {
                throw VoidhashStoreError.windowSceneNotFound
            }
            do {
                if #available(iOS 17.0, *), let subscriptionGroupId {
                    try await AppStore.showManageSubscriptions(
                        in: scene, subscriptionGroupID: subscriptionGroupId)
                } else {
                    try await AppStore.showManageSubscriptions(in: scene)
                }
            } catch {
                throw Self.storeError(
                    error, code: "FAILED_TO_SHOW_MANAGE_SUBSCRIPTIONS",
                    message: "Could not show the subscription management sheet")
            }
        #else
            throw VoidhashStoreError.methodNotAvailableOnPlatform(
                "showManageSubscriptions is not available on this platform")
        #endif
    }

    public func storefront() async -> VoidhashStorefront? {
        guard let storefront = await Storefront.current,
            let countryCode = CountryCodes.alpha2(storefront.countryCode)
        else {
            return nil
        }
        var currencyCode: String?
        if #available(iOS 17.0, macOS 14.0, *) {
            currencyCode = storefront.currency?.identifier
        }
        return VoidhashStorefront(countryCode: countryCode, currencyCode: currencyCode)
    }

    public func canMakePayments() -> Bool {
        return AppStore.canMakePayments
    }

    public func beginRefundRequest(transactionId: String) async throws
        -> VoidhashRefundRequestStatus
    {
        #if os(iOS) || os(visionOS)
            guard let id = UInt64(transactionId) else {
                throw VoidhashStoreError.invalidArgument(
                    "\(transactionId) is not an App Store transaction id")
            }
            guard let scene = await windowSceneProvider.currentWindowScene() else {
                throw VoidhashStoreError.windowSceneNotFound
            }
            let status: Transaction.RefundRequestStatus
            do {
                status = try await Transaction.beginRefundRequest(for: id, in: scene)
            } catch {
                throw Self.storeError(
                    error, code: "REFUND_REQUEST_FAILED",
                    message: "Could not request a refund of transaction \(transactionId)")
            }
            switch status {
            case .success: return .success
            case .userCancelled: return .userCancelled
            @unknown default: return .userCancelled
            }
        #else
            throw VoidhashStoreError.methodNotAvailableOnPlatform(
                "Refund requests are not available on this platform")
        #endif
    }

    public func subscriptionStatuses(groupId: String, appAccountToken: String?) async throws
        -> [StoreKitSubscriptionStatusInfo]
    {
        let statuses: [Product.SubscriptionInfo.Status]
        do {
            statuses = try await Product.SubscriptionInfo.status(for: groupId)
        } catch {
            throw Self.storeError(
                error, code: "FAILED_TO_GET_SUBSCRIPTION_STATUS",
                message: "Could not read the status of subscription group \(groupId)")
        }
        let mapped = statuses.compactMap { status -> StoreKitSubscriptionStatusInfo? in
            guard let retained = verified(status.transaction, operation: "subscription.status")
            else {
                return nil
            }
            var renewalInfo: VoidhashAppStoreRenewalInfo?
            if case .verified(let info) = status.renewalInfo {
                renewalInfo = VoidhashAppStoreRenewalInfo(
                    info, jwsRepresentation: status.renewalInfo.jwsRepresentation)
            }
            return StoreKitSubscriptionStatusInfo(
                state: StoreKitSubscriptionStatusInfo.State(status.state),
                transaction: retained.info, renewalInfo: renewalInfo)
        }
        return SubscriptionStatusRanking.currentUserFirst(
            mapped, appAccountToken: appAccountToken
        ) { status in
            SubscriptionStatusRanking.Candidate(
                appAccountToken: status.transaction.appAccountToken,
                ownershipType: status.transaction.appStore.ownershipType,
                purchaseDate: status.transaction.purchaseDate)
        }
    }

    public func currentEntitlements() async throws -> [StoreKitTransactionInfo] {
        var entitlements: [StoreKitTransactionInfo] = []
        for await verification in Transaction.currentEntitlements {
            if let retained = verified(verification, operation: "transactions.entitlements") {
                entitlements.append(retained.info)
            }
        }
        return entitlements
    }

    public func appTransaction() async throws -> VoidhashAppTransaction {
        guard #available(iOS 16.0, *) else {
            throw VoidhashStoreError.methodNotAvailableOnPlatform("The app transaction needs iOS 16")
        }
        let verification: VerificationResult<AppTransaction>
        do {
            verification = try await AppTransaction.shared
        } catch {
            throw Self.storeError(
                error, code: "FAILED_TO_GET_APP_TRANSACTION",
                message: "Could not read the app transaction")
        }
        guard case .verified(let appTransaction) = verification else {
            throw VoidhashStoreError.transactionVerificationFailed
        }
        let originalPlatform: String
        if #available(iOS 18.4, macOS 15.4, visionOS 2.4, *) {
            originalPlatform = appTransaction.originalPlatform.rawValue
        } else {
            originalPlatform = appTransaction.originalPlatformStringRepresentation
        }
        let appTransactionId = appTransaction.appTransactionID
        return VoidhashAppTransaction(
            originalAppVersion: appTransaction.originalAppVersion,
            originalPurchaseDate: appTransaction.originalPurchaseDate,
            environment: VoidhashEnvironment(appStoreRawValue: appTransaction.environment.rawValue),
            appTransactionId: appTransactionId.isEmpty ? nil : appTransactionId,
            originalPlatform: originalPlatform.isEmpty ? nil : originalPlatform,
            jwsRepresentation: verification.jwsRepresentation)
    }

    // MARK: - Helper Methods

    private var currentProductStore: ProductStore? {
        return lock.withLock { productStore }
    }

    private var currentTransactionListener: StoreKitTransactionListener? {
        return lock.withLock { onTransactionListener }
    }

    #if canImport(UIKit)
        /// Buys `product`, confirming in `target` where the OS lets a purchase name one.
        private func purchase(
            product: Product, options: Set<Product.PurchaseOption>,
            confirmIn target: StoreKitConfirmationTarget?
        ) async throws -> Product.PurchaseResult {
            if case .viewController(let viewController)? = target,
                #available(iOS 18.2, visionOS 2.2, *)
            {
                return try await product.purchase(confirmIn: viewController, options: options)
            }
            let scene: UIWindowScene?
            switch target {
            case .scene(let targetScene)?:
                scene = targetScene
            case .viewController(let viewController)?:
                scene = await MainActor.run { viewController.view.window?.windowScene }
            case nil:
                scene = await windowSceneProvider.currentWindowScene()
            }
            #if os(visionOS)
                guard let scene else {
                    throw VoidhashStoreError.windowSceneNotFound
                }
                return try await product.purchase(confirmIn: scene, options: options)
            #else
                if #available(iOS 17.0, tvOS 17.0, *), let scene {
                    return try await product.purchase(confirmIn: scene, options: options)
                }
                // Before iOS 17 no purchase names a scene, and from iOS 17 one that has none to
                // name (an app extension, a provider that found none) leaves the choice to
                // StoreKit too.
                return try await product.purchase(options: options)
            #endif
        }

        /// The view controller at the top of the scene the user is looking at.
        @MainActor
        private func topViewController() -> UIViewController? {
            let window = windowSceneProvider.currentWindowScene()?.windows.first {
                $0.isKeyWindow
            }
            guard var top = window?.rootViewController else {
                return nil
            }
            while let presented = top.presentedViewController, !presented.isBeingDismissed {
                top = presented
            }
            return top
        }
    #endif
}
