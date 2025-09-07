import Foundation
import NitroModules
import StoreKit

class HybridStorekitTransaction: HybridStorekitTransactionSpec {

    private let transaction: Transaction

    init(transaction: Transaction) {
        self.transaction = transaction
    }

    // MARK: - HybridStorekitTransactionSpec Properties

    var id: String {
        return transaction.productID
    }

    var ids: [String] {
        return [transaction.productID]
    }

    var transactionId: String {
        return String(transaction.id)
    }

    var transactionDate: Double {
        return transaction.purchaseDate.timeIntervalSince1970 * 1000
    }

    var transactionReceipt: String {
        let jsonRep = transaction.jsonRepresentation
        return String(data: jsonRep, encoding: .utf8) ?? ""
    }

    var quantityIos: Double {
        return Double(transaction.purchasedQuantity)
    }

    var originalTransactionDateIos: Double {
        return transaction.originalPurchaseDate.timeIntervalSince1970 * 1000
    }

    var originalTransactionIdentifierIos: String {
        return String(transaction.originalID)
    }

    var appAccountToken: String? {
        return transaction.appAccountToken?.uuidString
    }

    var appBundleIdIos: String {
        return transaction.appBundleID
    }

    var productTypeIos: String {
        return transaction.productType.rawValue
    }

    var subscriptionGroupIdIos: String? {
        return transaction.subscriptionGroupID
    }

    var webOrderLineItemIdIos: Double? {
        let jsonRep = transaction.jsonRepresentation
        do {
            if let jsonObj = try JSONSerialization.jsonObject(with: jsonRep) as? [String: Any],
                let webOrderId = jsonObj["webOrderLineItemID"] as? NSNumber
            {
                return webOrderId.doubleValue
            }
        } catch {
            print("Error parsing JSON representation: \(error)")
        }
        return nil
    }

    var expirationDateIos: Double? {
        guard let expirationDate = transaction.expirationDate else {
            return nil
        }
        return expirationDate.timeIntervalSince1970 * 1000
    }

    var isUpgradedIos: Bool? {
        return transaction.isUpgraded
    }

    var ownershipTypeIos: String {
        return transaction.ownershipType.rawValue
    }

    var revocationDateIos: Double? {
        guard let revocationDate = transaction.revocationDate else {
            return nil
        }
        return revocationDate.timeIntervalSince1970 * 1000
    }

    var revocationReasonIos: String? {
        return transaction.revocationReason?.rawValue.description
    }

    var transactionReasonIos: String? {
        let jsonRep = transaction.jsonRepresentation
        do {
            if let jsonObj = try JSONSerialization.jsonObject(with: jsonRep) as? [String: Any] {
                return jsonObj["transactionReason"] as? String
            }
        } catch {
            print("Error parsing JSON representation: \(error)")
        }
        return nil
    }

    var jwsRepresentationIos: String? {
        // This would need to be passed in during initialization or set separately
        // as it's not available from the Transaction object itself
        return nil
    }

    var environmentIos: String? {
        if #available(iOS 16.0, *) {
            return transaction.environment.rawValue
        }
        return nil
    }

    var storefrontCountryCodeIos: String? {
        if #available(iOS 17.0, *) {
            return transaction.storefront.countryCode
        }
        return nil
    }

    var reasonIos: String? {
        if #available(iOS 17.0, *) {
            return transaction.reason.rawValue
        }
        return nil
    }

    var offerIos: StorekitProductPurchaseOffer? {
        if #available(iOS 17.2, *), let offer = transaction.offer {
            return StorekitProductPurchaseOffer(
                id: offer.id ?? "",
                type: Double(offer.type.rawValue),
                paymentMode: offer.paymentMode?.rawValue ?? ""
            )
        }
        return nil
    }

    var priceIos: Double? {
        if #available(iOS 15.4, *) {
            let jsonRep = transaction.jsonRepresentation
            do {
                if let jsonObj = try JSONSerialization.jsonObject(with: jsonRep) as? [String: Any],
                    let price = jsonObj["price"] as? NSNumber
                {
                    return price.doubleValue
                }
            } catch {
                print("Error parsing JSON representation: \(error)")
            }
        }
        return nil
    }

    var currencyIos: String? {
        if #available(iOS 15.4, *) {
            let jsonRep = transaction.jsonRepresentation
            do {
                if let jsonObj = try JSONSerialization.jsonObject(with: jsonRep) as? [String: Any] {
                    return jsonObj["currency"] as? String
                }
            } catch {
                print("Error parsing JSON representation: \(error)")
            }
        }
        return nil
    }

    var type: PurchasedItemType {
        // Determine type based on product type and expiration date
        let isSubscription =
            transaction.productType.rawValue.lowercased().contains("renewable")
            || transaction.expirationDate != nil
        return isSubscription ? .subscription : .inapp
    }

    var sku: String {
        return transaction.productID
    }
}
