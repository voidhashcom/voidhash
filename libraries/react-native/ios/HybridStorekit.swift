import Foundation
import NitroModules
import VoidhashCore

/// Runs a core operation, translating ``VoidhashStoreError`` into the `"CODE: message"` runtime
/// errors the TypeScript layer branches on.
private func mappingStoreErrors<T>(_ operation: () async throws -> T) async throws -> T {
    do {
        return try await operation()
    } catch let error as VoidhashStoreError {
        throw RuntimeError.error(withMessage: error.description)
    }
}

/// Runs a synchronous core operation with the same error translation.
private func mappingStoreErrors<T>(_ operation: () throws -> T) throws -> T {
    do {
        return try operation()
    } catch let error as VoidhashStoreError {
        throw RuntimeError.error(withMessage: error.description)
    }
}

class HybridStorekit: HybridStorekitSpec {
    private let engine: StoreKitEngineProtocol = StoreKitEngine()

    func initConnection(onTransaction: ((any HybridStorekitTransactionSpec) -> Void)?) throws
        -> NitroModules.Promise<Bool>
    {
        let listener: StoreKitTransactionListener? = onTransaction.map { callback in
            { @Sendable transaction in
                callback(HybridStorekitTransaction(transaction: transaction))
            }
        }
        return Promise.async {
            try await mappingStoreErrors {
                try await self.engine.initConnection(onTransaction: listener)
            }
        }
    }

    func endConnection() throws -> Promise<Bool> {
        return Promise.async {
            try await mappingStoreErrors {
                try await self.engine.endConnection()
            }
        }
    }

    func getItems(skus: [String]) throws -> Promise<[any HybridStorekitProductSpec]> {
        return Promise.async {
            let products = try await mappingStoreErrors {
                try await self.engine.getItems(skus: skus)
            }
            return products.map { HybridStorekitProduct(product: $0) }
        }
    }

    func getPurchasedItems(onlyIncludeActiveItems: Bool) throws
        -> NitroModules.Promise<[any HybridStorekitTransactionSpec]>
    {
        return Promise.async {
            let transactions = try await mappingStoreErrors {
                try await self.engine.getPurchasedItems(
                    onlyIncludeActiveItems: onlyIncludeActiveItems)
            }
            return transactions.map { HybridStorekitTransaction(transaction: $0) }
        }
    }

    func buyProduct(sku: String, appAccountToken: String, quantity: Double) throws -> Promise<
        any HybridStorekitTransactionSpec
    > {
        return Promise.async {
            let transaction = try await mappingStoreErrors {
                try await self.engine.buyProduct(
                    sku: sku, appAccountToken: appAccountToken, quantity: quantity)
            }
            return HybridStorekitTransaction(transaction: transaction)
        }
    }

    func finishTransaction(transactionId: String) throws -> Promise<Void> {
        return Promise.async {
            try await mappingStoreErrors {
                try await self.engine.finishTransaction(transactionId: transactionId)
            }
        }
    }

    func getPendingTransactions() throws -> [any HybridStorekitTransactionSpec] {
        let transactions = try mappingStoreErrors {
            try engine.getPendingTransactions()
        }
        return transactions.map { HybridStorekitTransaction(transaction: $0) }
    }

    func presentCodeRedemptionSheet() throws {
        try mappingStoreErrors {
            try engine.presentCodeRedemptionSheet()
        }
    }

    func showManageSubscriptions() throws -> Promise<Void> {
        return Promise.async {
            try await mappingStoreErrors {
                try await self.engine.showManageSubscriptions()
            }
        }
    }
}
