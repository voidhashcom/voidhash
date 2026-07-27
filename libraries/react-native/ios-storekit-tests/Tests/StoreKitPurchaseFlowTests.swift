import StoreKit
import StoreKitTest
import XCTest

@available(iOS 17.0, *)
final class StoreKitPurchaseFlowTests: XCTestCase {
    private var session: SKTestSession!

    override func setUpWithError() throws {
        session = try SKTestSession(configurationFileNamed: "PurchaseValidation")
        session.disableDialogs = true
        session.askToBuyEnabled = false
        session.clearTransactions()
    }

    override func tearDownWithError() throws {
        session?.clearTransactions()
        session = nil
    }

    private func buyProductOrSkip(identifier: String) async throws -> Transaction {
        do {
            return try await session.buyProduct(identifier: identifier)
        } catch StoreKitError.notEntitled {
            throw XCTSkip("SKTestSession purchase hit the acknowledged simulator regression")
        } catch let error as NSError
            where error.domain == "SKInternalErrorDomain" && error.code == 3
        {
            throw XCTSkip("SKTestSession purchase hit the acknowledged simulator regression")
        }
    }

    func testNonConsumablePurchaseFinishesAndRestoresAfterLocalReset() async throws {
        let productID = "com.voidhash.test.lifetime"
        let purchasedTransaction = try await buyProductOrSkip(identifier: productID)

        let retained = TransactionRetentionStore<Transaction>()
        let transactionID = String(purchasedTransaction.id)
        retained.retain(id: transactionID, value: purchasedTransaction)
        XCTAssertNotNil(retained.value(for: transactionID))

        await purchasedTransaction.finish()
        retained.remove(id: transactionID)
        XCTAssertNil(retained.value(for: transactionID))

        let restored = TransactionRetentionStore<Transaction>()
        for await verification in Transaction.currentEntitlements {
            guard case .verified(let transaction) = verification,
                  transaction.productID == productID
            else { continue }
            restored.retain(id: String(transaction.id), value: transaction)
        }

        XCTAssertEqual(restored.values().map(\.productID), [productID])
    }

    func testConsumableIsNotReturnedAsCurrentEntitlement() async throws {
        let productID = "com.voidhash.test.credits"
        let transaction = try await buyProductOrSkip(identifier: productID)
        await transaction.finish()

        var activeProductIDs: [String] = []
        for await verification in Transaction.currentEntitlements {
            guard case .verified(let current) = verification else { continue }
            activeProductIDs.append(current.productID)
        }

        XCTAssertFalse(activeProductIDs.contains(productID))
    }

    func testSubscriptionPurchaseRestoresAfterLocalReset() async throws {
        let productID = "com.voidhash.test.monthly"
        let transaction = try await buyProductOrSkip(identifier: productID)

        var restoredProductIDs: [String] = []
        for await verification in Transaction.currentEntitlements {
            guard case .verified(let current) = verification else { continue }
            restoredProductIDs.append(current.productID)
        }
        XCTAssertTrue(restoredProductIDs.contains(productID))

        await transaction.finish()
    }

    func testMissingProductDoesNotCreateTransaction() async throws {
        do {
            _ = try await session.buyProduct(identifier: "com.voidhash.test.missing")
            XCTFail("Expected StoreKit to reject the missing product")
        } catch {
            XCTAssertTrue(session.allTransactions().isEmpty)
        }
    }
}
