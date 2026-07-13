import Foundation
import NitroModules
import StoreKit
import UIKit

class HybridStorekit: HybridStorekitSpec {
    private let transactions = TransactionRetentionStore<Transaction>()
    private var productStore: ProductStore?
    private var onTransactionListener: ((any HybridStorekitTransactionSpec) -> Void)?
    private var subscriptionPollingTask: Task<Void, Error>?
    private var pollingSkus: Set<String> = []

    func initConnection(onTransaction: ((any HybridStorekitTransactionSpec) -> Void)?) throws
        -> NitroModules.Promise<Bool>
    {
        self.productStore = ProductStore()
        self.onTransactionListener = onTransaction
        return Promise.async {
            return AppStore.canMakePayments
        }
    }

    func endConnection() throws -> Promise<Bool> {
        return Promise.async {
            guard let productStore = self.productStore else {
                return false
            }
            await productStore.removeAll()
            self.transactions.removeAll()
            self.productStore = nil
            self.onTransactionListener = nil
            return true
        }
    }

    func getItems(skus: [String]) throws -> Promise<[any HybridStorekitProductSpec]> {
        return Promise.async {
            guard let productStore = self.productStore else {
                throw RuntimeError.error(
                    withMessage: "STOREKIT_NOT_INITIALIZED: StoreKit connection not initialized")
            }
            let fetchedProducts = try await Product.products(for: skus)
            await productStore.performOnActor { isolatedStore in
                fetchedProducts.forEach { product in
                    isolatedStore.addProduct(product)
                }
            }
            let products = await productStore.getAllProducts()
            return products.map { HybridStorekitProduct(product: $0) }.compactMap { $0 }
        }
    }

    func getPurchasedItems(onlyIncludeActiveItems: Bool) throws
        -> NitroModules.Promise<[any HybridStorekitTransactionSpec]>
    {
        return Promise.async {
            guard let productStore = self.productStore else {
                throw RuntimeError.error(
                    withMessage: "STOREKIT_NOT_INITIALIZED: StoreKit connection not initialized")
            }

            var purchasedItems: [any HybridStorekitTransactionSpec] = []

            func addTransaction(transaction: Transaction) {
                self.transactions.retain(id: String(transaction.id), value: transaction)
                let hybridTransaction = HybridStorekitTransaction(transaction: transaction)
                purchasedItems.append(hybridTransaction)

                // Notify listener if available
                // TODO: ADD IF REQUIRED
                // self.onTransactionListener?(hybridTransaction)
            }

            for await verification in onlyIncludeActiveItems
                ? Transaction.currentEntitlements
                : Transaction.all
            {
                do {
                    let transaction = try self.checkVerified(verification)

                    if !onlyIncludeActiveItems {
                        if transaction.productType != .consumable {
                            addTransaction(transaction: transaction)
                        }
                        continue
                    }

                    switch transaction.productType {
                    case .nonConsumable, .autoRenewable:
                        addTransaction(transaction: transaction)
                    case .consumable:
                        continue
                    case .nonRenewable:
                        let currentDate = Date()
                        let expirationDate = Calendar(identifier: .gregorian).date(
                            byAdding: DateComponents(year: 1),
                            to: transaction.purchaseDate
                        )!
                        if currentDate < expirationDate {
                            addTransaction(transaction: transaction)
                        }
                    default:
                        break
                    }
                } catch {
                    // Log error but continue processing other transactions
                    print("Error processing transaction: \(error.localizedDescription)")
                }
            }

            return purchasedItems
        }
    }

    func buyProduct(sku: String, appAccountToken: String, quantity: Double) throws -> Promise<
        any HybridStorekitTransactionSpec
    > {
        return Promise.async {
            guard let productStore = self.productStore else {
                throw RuntimeError.error(
                    withMessage: "STOREKIT_NOT_INITIALIZED: StoreKit connection not initialized")
            }

            let product: Product? = await productStore.getProduct(productID: sku)
            guard let product = product else {
                throw RuntimeError.error(
                    withMessage: "INVALID_PRODUCT_ID: Product not found in store")
            }

            do {
                var options: Set<Product.PurchaseOption> = []

                if quantity > 0 {
                    options.insert(.quantity(Int(quantity)))
                }

                if let appAccountUUID = UUID(uuidString: appAccountToken) {
                    options.insert(.appAccountToken(appAccountUUID))
                }

                guard let windowScene = await self.currentWindowScene() else {
                    throw RuntimeError.error(
                        withMessage:
                            "WINDOW_SCENE_NOT_FOUND: Could not find window scene for UI presentation"
                    )
                }

                let result: Product.PurchaseResult
                #if swift(>=5.9)
                    if #available(iOS 17.0, tvOS 17.0, *) {
                        result = try await product.purchase(
                            confirmIn: windowScene, options: options)
                    } else {
                        #if !os(visionOS)
                            result = try await product.purchase(options: options)
                        #endif
                    }
                #elseif !os(visionOS)
                    result = try await product.purchase(options: options)
                #endif

                switch result {
                case .success(let verification):
                    let transaction = try self.checkVerified(verification)
                    self.transactions.retain(id: String(transaction.id), value: transaction)
                    let hybridTransaction = HybridStorekitTransaction(transaction: transaction)
                    self.onTransactionListener?(hybridTransaction)
                    return hybridTransaction

                case .userCancelled:
                    throw RuntimeError.error(
                        withMessage: "USER_CANCELLED: User cancelled the purchase")

                case .pending:
                    throw RuntimeError.error(
                        withMessage: "PURCHASE_PENDING: The payment was deferred")

                @unknown default:
                    throw RuntimeError.error(
                        withMessage: "PURCHASE_UNKNOWN_RESULT: Unknown purchase result")
                }
            } catch {
                if error is RuntimeError {
                    throw error
                }
                throw RuntimeError.error(
                    withMessage:
                        "PURCHASE_FAILED: Purchase operation failed - \(error.localizedDescription)"
                )
            }
        }
    }

    func finishTransaction(transactionId: String) throws -> Promise<Void> {
        return Promise.async {
            guard let transaction = self.transactions.value(for: transactionId) else {
                throw RuntimeError.error(
                    withMessage: "TRANSACTION_NOT_FOUND: Transaction not found")
            }

            await transaction.finish()
            self.transactions.remove(id: transactionId)
            return
        }
    }

    func getPendingTransactions() throws -> [any HybridStorekitTransactionSpec] {
        return self.transactions.values().map { HybridStorekitTransaction(transaction: $0) }
    }

    func presentCodeRedemptionSheet() throws {
        #if !os(tvOS)
            SKPaymentQueue.default().presentCodeRedemptionSheet()
            return
        #else
            throw RuntimeError.error(
                withMessage:
                    "METHOD_NOT_AVAILABLE_TVOS: presentCodeRedemptionSheet is not available on this platform"
            )
        #endif
    }

    func showManageSubscriptions() throws -> Promise<Void> {
        return Promise.async {
            #if !os(tvOS)
                guard let windowScene = await self.currentWindowScene() else {
                    throw RuntimeError.error(
                        withMessage:
                            "WINDOW_SCENE_NOT_FOUND: Could not find window scene for UI presentation"
                    )
                }
                // Get all subscription products before showing the management UI
                let subscriptionSkus = await self.getAllSubscriptionProductIds()
                self.pollingSkus = Set(subscriptionSkus)
                // Show the management UI
                try await AppStore.showManageSubscriptions(in: windowScene)
                // Start polling for status changes
                self.pollForSubscriptionStatusChanges()
                return
            #else
                throw RuntimeError.error(
                    withMessage:
                        "METHOD_NOT_AVAILABLE_TVOS: presentCodeRedemptionSheet is not available on this platform"
                )
            #endif
        }
    }

    // MARK: - Helper Methods

    private func pollForSubscriptionStatusChanges() {
        subscriptionPollingTask?.cancel()
        subscriptionPollingTask = Task {
            try? await Task.sleep(nanoseconds: 1_500_000_000)  // 1.5 seconds

            var previousStatuses: [String: Bool] = [:]  // Track auto-renewal state with Bool

            for sku in self.pollingSkus {
                guard let product = await self.productStore?.getProduct(productID: sku),
                    let status = try? await product.subscription?.status.first
                else { continue }

                // Track willAutoRenew as a bool value
                var willAutoRenew = false
                if case .verified(let info) = status.renewalInfo {
                    willAutoRenew = info.willAutoRenew
                }
                previousStatuses[sku] = willAutoRenew
            }

            for _ in 1...5 {
                try? await Task.sleep(nanoseconds: 2_000_000_000)  // 2 seconds
                if Task.isCancelled {
                    return
                }

                for sku in self.pollingSkus {
                    guard let product = await self.productStore?.getProduct(productID: sku),
                        let status = try? await product.subscription?.status.first,
                        let result = await product.latestTransaction
                    else { continue }
                    // Try to verify the transaction
                    let transaction: Transaction
                    do {
                        transaction = try self.checkVerified(result)
                    } catch {
                        continue  // Skip if verification fails
                    }

                    // Track current auto-renewal state
                    var currentWillAutoRenew = false
                    if case .verified(let info) = status.renewalInfo {
                        currentWillAutoRenew = info.willAutoRenew
                    }

                    // Compare with previous state
                    if let previousWillAutoRenew = previousStatuses[sku],
                        previousWillAutoRenew != currentWillAutoRenew
                    {

                        var hybridTransaction = HybridStorekitTransaction(transaction: transaction)

                        // TODO: Store newal info
                        /* if case .verified(let renewalInfo) = status.renewalInfo {
                            if let renewalInfoDict = serializeRenewalInfo(.verified(renewalInfo)) {
                                purchaseMap["renewalInfo"] = renewalInfoDict
                            }
                        } */

                        self.onTransactionListener?(hybridTransaction)
                        previousStatuses[sku] = currentWillAutoRenew
                    }
                }
            }
            self.pollingSkus.removeAll()
        }
    }

    private func getAllSubscriptionProductIds() async -> [String] {
        guard let productStore = self.productStore else { return [] }
        let products = await productStore.getAllProducts()
        return products.compactMap { product in
            if product.subscription != nil {
                return product.id
            }
            return nil
        }
    }

    private func currentWindowScene() async -> UIWindowScene? {
        return await MainActor.run {
            return UIApplication.shared.connectedScenes.first as? UIWindowScene
        }
    }

    private func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .unverified:
            throw RuntimeError.error(
                withMessage: "TRANSACTION_VERIFICATION_FAILED: Transaction verification failed")
        case .verified(let safe):
            return safe
        }
    }
}
